import { createCipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import {
  bookingLimits,
  calculateBookingTotal,
  departures,
  genders,
  getTicketClass,
  siteConfig,
  type Departure,
  type Gender,
  type TicketClassLabel,
} from '../src/config/business'

type BookingPayload = {
  travelClass?: unknown
  travelDate?: unknown
  departure?: unknown
  adults?: unknown
  children?: unknown
  fullName?: unknown
  passportId?: unknown
  gender?: unknown
  countryCode?: unknown
  email?: unknown
  consent?: unknown
}

export type ValidationResult =
  | { ok: true; value: NormalizedBooking }
  | { ok: false; errors: string[] }

export type NormalizedBooking = {
  reference: string
  travelClass: TicketClassLabel
  travelDate: string
  departure: Departure
  adults: number
  children: number
  totalAmount: number
  passenger: {
    fullName: string
    passportId: string
    gender: Gender
    countryCode: string
    email: string
  }
}

type ApiResponse = {
  bookingReference?: string
  whatsappUrl?: string
  message?: string
  errors?: string[]
}

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 5
const PASSPORT_ID_ENCRYPTION_KEY_ENV = 'PASSPORT_ID_ENCRYPTION_KEY'

type HeaderValue = string | string[] | undefined

type BookingRequest = {
  method?: string
  headers: Record<string, HeaderValue>
  socket?: {
    remoteAddress?: string
  }
  body?: unknown
}

type BookingResponse = {
  statusCode?: number
  setHeader(name: string, value: string): void
  end(body?: string): void
}

type RateLimitResult = {
  limited: boolean
}

type RateLimiter = {
  check(key: string): Promise<RateLimitResult>
}

type Env = NodeJS.ProcessEnv
type Fetcher = typeof fetch

class InMemoryRateLimiter implements RateLimiter {
  private readonly requests = new Map<string, { count: number; resetAt: number }>()

  async check(key: string) {
    const now = Date.now()
    const current = this.requests.get(key)

    if (!current || current.resetAt <= now) {
      this.requests.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
      return { limited: false }
    }

    current.count += 1
    return { limited: current.count > RATE_LIMIT_MAX_REQUESTS }
  }
}

class UpstashRateLimiter implements RateLimiter {
  constructor(
    private readonly restUrl: string,
    private readonly token: string,
    private readonly fetcher: Fetcher = fetch,
  ) {}

  async check(key: string) {
    const redisKey = `safarirail:bookings:${key}`
    const increment = await this.command<number>(['INCR', redisKey])
    if (increment === 1) {
      await this.command<number>(['PEXPIRE', redisKey, String(RATE_LIMIT_WINDOW_MS)])
    }
    return { limited: increment > RATE_LIMIT_MAX_REQUESTS }
  }

  private async command<T>(command: string[]) {
    const response = await this.fetcher(`${this.restUrl.replace(/\/$/, '')}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    })
    if (!response.ok) throw new Error(`Rate limiter failed with status ${response.status}`)
    const payload = (await response.json()) as { result?: T; error?: string }
    if (payload.error) throw new Error('Rate limiter command failed')
    return payload.result as T
  }
}

function createRateLimiter(env: Env): RateLimiter {
  if (env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN) {
    return new UpstashRateLimiter(env.UPSTASH_REDIS_REST_URL, env.UPSTASH_REDIS_REST_TOKEN)
  }

  return new InMemoryRateLimiter()
}

const rateLimiter = createRateLimiter(process.env)

function sendJson(res: BookingResponse, statusCode: number, body: ApiResponse) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function getClientIp(req: BookingRequest) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

function cleanText(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return ''
  return value.replace(/[\u0000-\u001f\u007f]/g, '').trim().replace(/\s+/g, ' ').slice(0, maxLength)
}

function cleanCode(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.trim().toUpperCase()
}

function parseInteger(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : fallback
}

function generateBookingReference() {
  const date = new Date()
  const stamp = [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('')
  const random = randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `SR-${stamp}-${random}`
}

function isDeparture(value: string): value is Departure {
  return (departures as readonly string[]).includes(value)
}

function isGender(value: string): value is Gender {
  return (genders as readonly string[]).includes(value)
}

function isTicketClassLabel(value: string): value is TicketClassLabel {
  return Boolean(getTicketClass(value))
}

function getEncryptionKey(env: Env) {
  const rawKey = env[PASSPORT_ID_ENCRYPTION_KEY_ENV]
  if (!rawKey) {
    throw new Error(`${PASSPORT_ID_ENCRYPTION_KEY_ENV} environment variable is not configured.`)
  }

  const trimmed = rawKey.trim()
  const decoded = Buffer.from(trimmed, 'base64')
  if (decoded.length === 32) return decoded

  const hexDecoded = Buffer.from(trimmed, 'hex')
  if (hexDecoded.length === 32) return hexDecoded

  return createHash('sha256').update(trimmed).digest()
}

export function encryptPassportId(passportId: string, env: Env = process.env) {
  const key = getEncryptionKey(env)
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const ciphertext = Buffer.concat([cipher.update(passportId, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  return [
    'v1',
    iv.toString('base64url'),
    authTag.toString('base64url'),
    ciphertext.toString('base64url'),
  ].join(':')
}

function prepareSensitivePassengerFields(passenger: NormalizedBooking['passenger'], env: Env) {
  return {
    fullName: passenger.fullName,
    passportId: encryptPassportId(passenger.passportId, env),
    gender: passenger.gender,
    countryCode: passenger.countryCode,
    email: passenger.email,
  }
}

export function validatePayload(payload: BookingPayload, referenceFactory = generateBookingReference): ValidationResult {
  const errors: string[] = []
  const travelClass = cleanText(payload.travelClass, 32)
  const departure = cleanText(payload.departure, 32)
  const travelDate = cleanText(payload.travelDate, 10)
  const fullName = cleanText(payload.fullName, 120)
  const passportId = cleanText(payload.passportId, 80)
  const gender = cleanText(payload.gender, 12)
  const countryCode = cleanCode(payload.countryCode)
  const email = cleanText(payload.email, 254).toLowerCase()
  const adults = parseInteger(payload.adults, 1)
  const children = parseInteger(payload.children, 0)

  if (!isTicketClassLabel(travelClass)) errors.push('Select a valid class.')
  if (!isDeparture(departure)) errors.push('Select a valid departure.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate) || Number.isNaN(Date.parse(`${travelDate}T00:00:00Z`))) {
    errors.push('Enter a valid travel date.')
  } else {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const selectedDate = new Date(`${travelDate}T00:00:00Z`)
    if (selectedDate < today) errors.push('Travel date cannot be in the past.')
  }
  if (adults < bookingLimits.minAdults || adults > bookingLimits.maxAdults) errors.push('Adults must be between 1 and 6.')
  if (children < bookingLimits.minChildren || children > bookingLimits.maxChildren) errors.push('Children must be between 0 and 4.')
  if (fullName.length < 2) errors.push('Full name is required.')
  if (passportId.length < 3) errors.push('Passport or ID number is required.')
  if (!isGender(gender)) errors.push('Select a valid gender.')
  if (!/^[A-Z]{2}$/.test(countryCode)) errors.push('Select a valid country.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Enter a valid email address.')
  if (payload.consent !== true) errors.push('Consent is required before submitting.')

  if (errors.length > 0 || !isTicketClassLabel(travelClass) || !isDeparture(departure) || !isGender(gender)) return { ok: false, errors }

  return {
    ok: true,
    value: {
      reference: referenceFactory(),
      travelClass,
      travelDate,
      departure,
      adults,
      children,
      totalAmount: calculateBookingTotal(travelClass, adults, children),
      passenger: {
        fullName,
        passportId,
        gender,
        countryCode,
        email,
      },
    },
  }
}

export async function persistBooking(booking: NormalizedBooking, env: Env = process.env, fetcher: Fetcher = fetch) {
  const supabaseUrl = env.SUPABASE_URL
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables are not configured.')
  }

  const sensitivePassengerFields = prepareSensitivePassengerFields(booking.passenger, env)

  const response = await fetcher(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/create_booking`, {
    method: 'POST',
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      p_reference: booking.reference,
      p_travel_class: booking.travelClass,
      p_travel_date: booking.travelDate,
      p_departure: booking.departure,
      p_adults: booking.adults,
      p_children: booking.children,
      p_total_amount: booking.totalAmount,
      p_full_name: sensitivePassengerFields.fullName,
      p_passport_id: sensitivePassengerFields.passportId,
      p_gender: sensitivePassengerFields.gender,
      p_country_code: sensitivePassengerFields.countryCode,
      p_email: sensitivePassengerFields.email,
    }),
  })

  if (!response.ok) {
    throw new Error(`Supabase booking insert failed: ${response.status}`)
  }
}

export default async function handler(req: BookingRequest, res: BookingResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { message: 'Method not allowed.' })
    return
  }

  const ip = getClientIp(req)
  const rateLimit = await rateLimiter.check(ip)
  if (rateLimit.limited) {
    sendJson(res, 429, { message: 'Too many booking attempts. Please wait a minute and try again.' })
    return
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const validation = validatePayload(payload || {})

    if (!validation.ok) {
      sendJson(res, 400, { message: 'Please correct the booking details.', errors: validation.errors })
      return
    }

    await persistBooking(validation.value)

    const whatsappMessage = `Hi SafariRail, my secure booking request reference is ${validation.value.reference}. Please confirm availability and payment details.`
    sendJson(res, 201, {
      bookingReference: validation.value.reference,
      whatsappUrl: `https://wa.me/${siteConfig.whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}`,
    })
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Unknown booking submission error')
    sendJson(res, 500, { message: 'We could not submit your booking right now. Please try again later.' })
  }
}
