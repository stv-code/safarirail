import { REVIEW_MAX_LENGTH, REVIEW_NAME_MAX_LENGTH, REVIEW_ROUTE_MAX_LENGTH } from '../src/config/reviews'

const SPAM_PATTERN = /(https?:\/\/|www\.|<a\s|<\/a>|casino|viagra|crypto\s+airdrop)/i

type Env = NodeJS.ProcessEnv
type Fetcher = typeof fetch

export type ReviewRequest = {
  method?: string
  headers: Record<string, string | string[] | undefined>
  socket?: {
    remoteAddress?: string
  }
  body?: unknown
}

export type ReviewResponse = {
  statusCode?: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

export type PublicReview = {
  name: string
  rating: number
  route: string
  reviewText: string
  createdAt: string
}

export type ApiResponse = {
  message?: string
  errors?: string[]
  reviews?: PublicReview[]
}

type ReviewPayload = {
  name?: unknown
  rating?: unknown
  route?: unknown
  reviewText?: unknown
  website?: unknown
}

type NormalizedReview = {
  name: string
  rating: number
  route: string
  reviewText: string
}

type ModerationPayload = {
  id?: unknown
  status?: unknown
}

type ModerationStatus = 'approved' | 'rejected'
type ExistingReview = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
}

type ValidationResult<T> = { ok: true; value: T } | { ok: false; errors: string[] }

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function parseRating(value: unknown) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : 0
}

function isModerationStatus(value: string): value is ModerationStatus {
  return value === 'approved' || value === 'rejected'
}

function getSupabaseConfig(env: Env) {
  const supabaseUrl = env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables are not configured.')
  }

  return {
    baseUrl: supabaseUrl.replace(/\/$/, ''),
    serviceRoleKey,
  }
}

function supabaseHeaders(serviceRoleKey: string) {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    'Content-Type': 'application/json',
  }
}

export function validateReviewPayload(payload: ReviewPayload): ValidationResult<NormalizedReview> {
  const errors: string[] = []
  const name = cleanText(payload.name, REVIEW_NAME_MAX_LENGTH)
  const rating = parseRating(payload.rating)
  const route = cleanText(payload.route, REVIEW_ROUTE_MAX_LENGTH)
  const reviewText = cleanText(payload.reviewText, REVIEW_MAX_LENGTH)
  const website = cleanText(payload.website, 200)

  if (!name) errors.push('Name is required.')
  if (rating < 1 || rating > 5) errors.push('Rating must be between 1 and 5.')
  if (!reviewText) errors.push('Review text is required.')
  if (typeof payload.name === 'string' && payload.name.trim().length > REVIEW_NAME_MAX_LENGTH) errors.push('Name is too long.')
  if (typeof payload.route === 'string' && payload.route.trim().length > REVIEW_ROUTE_MAX_LENGTH) errors.push('Route is too long.')
  if (typeof payload.reviewText === 'string' && payload.reviewText.trim().length > REVIEW_MAX_LENGTH) errors.push('Review is too long.')
  if (website) errors.push('Review could not be submitted.')
  if (SPAM_PATTERN.test(`${name} ${route} ${reviewText}`)) errors.push('Review appears to contain spam.')

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      name,
      rating,
      route: route || 'Madaraka Express',
      reviewText,
    },
  }
}

export function validateModerationPayload(payload: ModerationPayload): ValidationResult<{ id: string; status: ModerationStatus }> {
  const errors: string[] = []
  const id = cleanText(payload.id, 80)
  const status = cleanText(payload.status, 20)

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    errors.push('Valid review id is required.')
  }
  if (!isModerationStatus(status)) {
    errors.push('Status must be approved or rejected.')
  }

  if (errors.length > 0) return { ok: false, errors }
  return { ok: true, value: { id, status: status as ModerationStatus } }
}

export async function submitReview(payload: ReviewPayload, env: Env = process.env, fetcher: Fetcher = fetch): Promise<ValidationResult<NormalizedReview>> {
  const validation = validateReviewPayload(payload)
  if (!validation.ok) return validation

  const { baseUrl, serviceRoleKey } = getSupabaseConfig(env)
  const response = await fetcher(`${baseUrl}/rest/v1/reviews`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(serviceRoleKey),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      name: validation.value.name,
      rating: validation.value.rating,
      route: validation.value.route,
      review_text: validation.value.reviewText,
      status: 'pending',
    }),
  })

  if (!response.ok) throw new Error(`Supabase review insert failed: ${response.status}`)
  return validation
}

export async function listApprovedReviews(env: Env = process.env, fetcher: Fetcher = fetch) {
  const { baseUrl, serviceRoleKey } = getSupabaseConfig(env)
  const query = new URLSearchParams({
    select: 'name,rating,route,review_text,created_at',
    status: 'eq.approved',
    order: 'created_at.desc',
    limit: '24',
  })
  const response = await fetcher(`${baseUrl}/rest/v1/reviews?${query.toString()}`, {
    method: 'GET',
    headers: supabaseHeaders(serviceRoleKey),
  })

  if (!response.ok) throw new Error(`Supabase review list failed: ${response.status}`)
  const rows = (await response.json()) as Array<{
    name: string
    rating: number
    route: string
    review_text: string
    created_at: string
  }>

  return rows.map((row) => ({
    name: row.name,
    rating: row.rating,
    route: row.route,
    reviewText: row.review_text,
    createdAt: row.created_at,
  }))
}

async function getReviewForModeration(id: string, baseUrl: string, serviceRoleKey: string, fetcher: Fetcher) {
  const query = new URLSearchParams({
    select: 'id,status',
    id: `eq.${id}`,
    limit: '1',
  })
  const response = await fetcher(`${baseUrl}/rest/v1/reviews?${query.toString()}`, {
    method: 'GET',
    headers: supabaseHeaders(serviceRoleKey),
  })

  if (!response.ok) throw new Error(`Supabase review lookup failed: ${response.status}`)
  const rows = (await response.json()) as ExistingReview[]
  return rows[0] || null
}

async function recordModerationEvent(
  review: ExistingReview,
  newStatus: ModerationStatus,
  actor: string,
  baseUrl: string,
  serviceRoleKey: string,
  fetcher: Fetcher,
) {
  const response = await fetcher(`${baseUrl}/rest/v1/review_moderation_events`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(serviceRoleKey),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({
      review_id: review.id,
      action: newStatus,
      previous_status: review.status,
      new_status: newStatus,
      actor,
    }),
  })

  if (!response.ok) throw new Error(`Supabase review moderation audit failed: ${response.status}`)
}

export async function moderateReview(payload: ModerationPayload, env: Env = process.env, fetcher: Fetcher = fetch): Promise<ValidationResult<{ id: string; status: ModerationStatus }>> {
  const validation = validateModerationPayload(payload)
  if (!validation.ok) return validation

  const { baseUrl, serviceRoleKey } = getSupabaseConfig(env)
  const existingReview = await getReviewForModeration(validation.value.id, baseUrl, serviceRoleKey, fetcher)
  if (!existingReview) {
    return { ok: false, errors: ['Review not found.'] }
  }

  const response = await fetcher(`${baseUrl}/rest/v1/reviews?id=eq.${encodeURIComponent(validation.value.id)}`, {
    method: 'PATCH',
    headers: {
      ...supabaseHeaders(serviceRoleKey),
      Prefer: 'return=representation',
    },
    body: JSON.stringify({
      status: validation.value.status,
      approved_at: validation.value.status === 'approved' ? new Date().toISOString() : null,
    }),
  })

  if (!response.ok) throw new Error(`Supabase review moderation failed: ${response.status}`)
  const updatedRows = (await response.json()) as Array<{ id: string }>
  if (updatedRows.length !== 1) {
    return { ok: false, errors: ['Review not found.'] }
  }

  await recordModerationEvent(existingReview, validation.value.status, 'admin-token', baseUrl, serviceRoleKey, fetcher)
  return validation
}

export { REVIEW_MAX_LENGTH, REVIEW_NAME_MAX_LENGTH, REVIEW_ROUTE_MAX_LENGTH }
