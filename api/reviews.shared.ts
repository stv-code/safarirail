import {
  REVIEW_COUNTRIES,
  REVIEW_COUNTRY_MAX_LENGTH,
  REVIEW_EMAIL_MAX_LENGTH,
  REVIEW_MAX_LENGTH,
  REVIEW_NAME_MAX_LENGTH,
  REVIEW_ROUTE_MAX_LENGTH,
  REVIEW_ROUTES,
  REVIEW_TRAVEL_MONTH_MAX_LENGTH,
  REVIEW_TRAVEL_MONTHS,
  REVIEW_TRAVELLER_TYPE_MAX_LENGTH,
  REVIEW_TRAVELLER_TYPES,
} from '../src/config/reviews'

const SPAM_PATTERN = /(https?:\/\/|www\.|<a\s|<\/a>|casino|viagra|crypto\s+airdrop)/i
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
  country: string
  travelMonth: string
  travellerType: string
  reviewText: string
  createdAt: string
  verifiedTraveller: boolean
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
  country?: unknown
  travelMonth?: unknown
  travellerType?: unknown
  reviewText?: unknown
  bookingEmail?: unknown
  website?: unknown
}

type NormalizedReview = {
  name: string
  rating: number
  route: string
  country: string
  travelMonth: string
  travellerType: string
  reviewText: string
  bookingEmail: string
}

type PassengerLookup = {
  id: string
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

function isReviewRoute(value: string) {
  return (REVIEW_ROUTES as readonly string[]).includes(value)
}

function isReviewCountry(value: string) {
  return (REVIEW_COUNTRIES as readonly string[]).includes(value)
}

function isReviewTravelMonth(value: string) {
  return (REVIEW_TRAVEL_MONTHS as readonly string[]).includes(value)
}

function isReviewTravellerType(value: string) {
  return (REVIEW_TRAVELLER_TYPES as readonly string[]).includes(value)
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
  const country = cleanText(payload.country, REVIEW_COUNTRY_MAX_LENGTH)
  const travelMonth = cleanText(payload.travelMonth, REVIEW_TRAVEL_MONTH_MAX_LENGTH)
  const travellerType = cleanText(payload.travellerType, REVIEW_TRAVELLER_TYPE_MAX_LENGTH)
  const reviewText = cleanText(payload.reviewText, REVIEW_MAX_LENGTH)
  const bookingEmail = cleanText(payload.bookingEmail, REVIEW_EMAIL_MAX_LENGTH).toLowerCase()
  const website = cleanText(payload.website, 200)

  if (!name) errors.push('Name is required.')
  if (rating < 1 || rating > 5) errors.push('Rating must be between 1 and 5.')
  if (!route) errors.push('Route is required.')
  if (route && !isReviewRoute(route)) errors.push('Route must be Nairobi to Mombasa, Mombasa to Nairobi, or Round trip.')
  if (!country) errors.push('Country is required.')
  if (country && !isReviewCountry(country)) errors.push('Country must be selected from the list.')
  if (!travelMonth) errors.push('Travel month is required.')
  if (travelMonth && !isReviewTravelMonth(travelMonth)) errors.push('Travel month must be selected from the list.')
  if (!travellerType) errors.push('Traveller type is required.')
  if (travellerType && !isReviewTravellerType(travellerType)) errors.push('Traveller type must be selected from the list.')
  if (!reviewText) errors.push('Review text is required.')
  if (bookingEmail && !EMAIL_PATTERN.test(bookingEmail)) errors.push('Booking email must be a valid email address.')
  if (typeof payload.name === 'string' && payload.name.trim().length > REVIEW_NAME_MAX_LENGTH) errors.push('Name is too long.')
  if (typeof payload.route === 'string' && payload.route.trim().length > REVIEW_ROUTE_MAX_LENGTH) errors.push('Route is too long.')
  if (typeof payload.country === 'string' && payload.country.trim().length > REVIEW_COUNTRY_MAX_LENGTH) errors.push('Country is too long.')
  if (typeof payload.travelMonth === 'string' && payload.travelMonth.trim().length > REVIEW_TRAVEL_MONTH_MAX_LENGTH) errors.push('Travel month is too long.')
  if (typeof payload.travellerType === 'string' && payload.travellerType.trim().length > REVIEW_TRAVELLER_TYPE_MAX_LENGTH) errors.push('Traveller type is too long.')
  if (typeof payload.reviewText === 'string' && payload.reviewText.trim().length > REVIEW_MAX_LENGTH) errors.push('Review is too long.')
  if (typeof payload.bookingEmail === 'string' && payload.bookingEmail.trim().length > REVIEW_EMAIL_MAX_LENGTH) errors.push('Booking email is too long.')
  if (website) errors.push('Review could not be submitted.')
  if (SPAM_PATTERN.test(`${name} ${route} ${country} ${travelMonth} ${travellerType} ${reviewText}`)) errors.push('Review appears to contain spam.')

  if (errors.length > 0) return { ok: false, errors }

  return {
    ok: true,
    value: {
      name,
      rating,
      route,
      country,
      travelMonth,
      travellerType,
      reviewText,
      bookingEmail,
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

async function findPassengerByEmail(email: string, baseUrl: string, serviceRoleKey: string, fetcher: Fetcher) {
  if (!email) return null

  const query = new URLSearchParams({
    select: 'id',
    email: `eq.${email}`,
    limit: '1',
  })
  const response = await fetcher(`${baseUrl}/rest/v1/passengers?${query.toString()}`, {
    method: 'GET',
    headers: supabaseHeaders(serviceRoleKey),
  })

  if (!response.ok) throw new Error(`Supabase passenger lookup failed: ${response.status}`)
  const rows = (await response.json()) as PassengerLookup[]
  return rows[0] || null
}

function isMissingReviewContextColumnError(response: Response, body: string) {
  return response.status === 400 && /(country|travel_month|traveller_type|booking_email|verified_traveller|schema cache|column)/i.test(body)
}

async function getResponseBody(response: Response) {
  try {
    return await response.text()
  } catch {
    return ''
  }
}

function reviewInsertBody(review: NormalizedReview, verifiedTraveller: boolean, includeContextColumns: boolean) {
  const body: Record<string, string | number | boolean | null> = {
    name: review.name,
    rating: review.rating,
    route: review.route,
    review_text: review.reviewText,
    status: 'pending',
  }

  if (includeContextColumns) {
    body.country = review.country
    body.travel_month = review.travelMonth
    body.traveller_type = review.travellerType
    body.booking_email = review.bookingEmail || null
    body.verified_traveller = verifiedTraveller
  }

  return body
}

async function insertReview(
  review: NormalizedReview,
  verifiedTraveller: boolean,
  includeContextColumns: boolean,
  baseUrl: string,
  serviceRoleKey: string,
  fetcher: Fetcher,
) {
  return fetcher(`${baseUrl}/rest/v1/reviews`, {
    method: 'POST',
    headers: {
      ...supabaseHeaders(serviceRoleKey),
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(reviewInsertBody(review, verifiedTraveller, includeContextColumns)),
  })
}

async function safelyFindPassengerByEmail(email: string, baseUrl: string, serviceRoleKey: string, fetcher: Fetcher) {
  try {
    return await findPassengerByEmail(email, baseUrl, serviceRoleKey, fetcher)
  } catch (error) {
    console.error('Optional review traveller verification failed', error)
    return null
  }
}
export async function submitReview(payload: ReviewPayload, env: Env = process.env, fetcher: Fetcher = fetch): Promise<ValidationResult<NormalizedReview>> {
  const validation = validateReviewPayload(payload)
  if (!validation.ok) return validation

  const { baseUrl, serviceRoleKey } = getSupabaseConfig(env)
  const matchedPassenger = await safelyFindPassengerByEmail(validation.value.bookingEmail, baseUrl, serviceRoleKey, fetcher)
  let response = await insertReview(validation.value, Boolean(matchedPassenger), true, baseUrl, serviceRoleKey, fetcher)

  if (!response.ok) {
    const body = await getResponseBody(response)
    if (isMissingReviewContextColumnError(response, body)) {
      response = await insertReview(validation.value, false, false, baseUrl, serviceRoleKey, fetcher)
    }
  }

  if (!response.ok) throw new Error(`Supabase review insert failed: ${response.status}`)
  return validation
}

async function fetchApprovedReviews(baseUrl: string, serviceRoleKey: string, fetcher: Fetcher, includeContextColumns: boolean) {
  const query = new URLSearchParams({
    select: includeContextColumns
      ? 'name,rating,route,country,travel_month,traveller_type,review_text,created_at,verified_traveller'
      : 'name,rating,route,review_text,created_at',
    status: 'eq.approved',
    order: 'created_at.desc',
    limit: '24',
  })
  return fetcher(`${baseUrl}/rest/v1/reviews?${query.toString()}`, {
    method: 'GET',
    headers: supabaseHeaders(serviceRoleKey),
  })
}

export async function listApprovedReviews(env: Env = process.env, fetcher: Fetcher = fetch) {
  const { baseUrl, serviceRoleKey } = getSupabaseConfig(env)
  let response = await fetchApprovedReviews(baseUrl, serviceRoleKey, fetcher, true)
  let includesContextColumns = true

  if (!response.ok) {
    const body = await getResponseBody(response)
    if (isMissingReviewContextColumnError(response, body)) {
      response = await fetchApprovedReviews(baseUrl, serviceRoleKey, fetcher, false)
      includesContextColumns = false
    }
  }

  if (!response.ok) throw new Error(`Supabase review list failed: ${response.status}`)
  const rows = (await response.json()) as Array<{
    name: string
    rating: number
    route: string
    country?: string | null
    travel_month?: string | null
    traveller_type?: string | null
    review_text: string
    created_at: string
    verified_traveller?: boolean | null
  }>

  return rows.map((row) => ({
    name: row.name,
    rating: row.rating,
    route: row.route,
    country: includesContextColumns ? row.country || '' : '',
    travelMonth: includesContextColumns ? row.travel_month || '' : '',
    travellerType: includesContextColumns ? row.traveller_type || '' : '',
    reviewText: row.review_text,
    createdAt: row.created_at,
    verifiedTraveller: includesContextColumns && row.verified_traveller === true,
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

export {
  REVIEW_COUNTRIES,
  REVIEW_EMAIL_MAX_LENGTH,
  REVIEW_MAX_LENGTH,
  REVIEW_NAME_MAX_LENGTH,
  REVIEW_ROUTE_MAX_LENGTH,
  REVIEW_ROUTES,
  REVIEW_TRAVEL_MONTHS,
  REVIEW_TRAVELLER_TYPES,
}