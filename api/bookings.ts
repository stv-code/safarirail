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

type ValidationResult =
  | { ok: true; value: NormalizedBooking }
  | { ok: false; errors: string[] }

type NormalizedBooking = {
  reference: string
  travelClass: 'Economy' | 'First Class' | 'Premium'
  travelDate: string
  departure: 'Morning (08:00)' | 'Afternoon (15:00)' | 'Night (22:00)'
  adults: number
  children: number
  totalAmount: number
  passenger: {
    fullName: string
    passportId: string
    gender: 'Male' | 'Female'
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

const TRAVEL_CLASSES = {
  Economy: { adult: 2000, child: 1250 },
  'First Class': { adult: 5500, child: 3250 },
  Premium: { adult: 13500, child: 7500 },
} as const

const DEPARTURES = new Set(['Morning (08:00)', 'Afternoon (15:00)', 'Night (22:00)'])
const GENDERS = new Set(['Male', 'Female'])
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_REQUESTS = 5
const rateLimits = new Map<string, { count: number; resetAt: number }>()

function sendJson(res: any, statusCode: number, body: ApiResponse) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function getClientIp(req: any) {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return forwardedFor.split(',')[0].trim()
  }
  return req.socket?.remoteAddress || 'unknown'
}

function isRateLimited(ip: string) {
  const now = Date.now()
  const current = rateLimits.get(ip)

  if (!current || current.resetAt <= now) {
    rateLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return false
  }

  current.count += 1
  return current.count > RATE_LIMIT_MAX_REQUESTS
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
  const random = crypto.randomUUID().replace(/-/g, '').slice(0, 8).toUpperCase()
  return `SR-${stamp}-${random}`
}

function validatePayload(payload: BookingPayload): ValidationResult {
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

  if (!(travelClass in TRAVEL_CLASSES)) errors.push('Select a valid class.')
  if (!DEPARTURES.has(departure)) errors.push('Select a valid departure.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(travelDate) || Number.isNaN(Date.parse(`${travelDate}T00:00:00Z`))) {
    errors.push('Enter a valid travel date.')
  } else {
    const today = new Date()
    today.setUTCHours(0, 0, 0, 0)
    const selectedDate = new Date(`${travelDate}T00:00:00Z`)
    if (selectedDate < today) errors.push('Travel date cannot be in the past.')
  }
  if (adults < 1 || adults > 6) errors.push('Adults must be between 1 and 6.')
  if (children < 0 || children > 4) errors.push('Children must be between 0 and 4.')
  if (fullName.length < 2) errors.push('Full name is required.')
  if (passportId.length < 3) errors.push('Passport or ID number is required.')
  if (!GENDERS.has(gender)) errors.push('Select a valid gender.')
  if (!/^[A-Z]{2}$/.test(countryCode)) errors.push('Select a valid country.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Enter a valid email address.')
  if (payload.consent !== true) errors.push('Consent is required before submitting.')

  if (errors.length > 0 || !(travelClass in TRAVEL_CLASSES)) return { ok: false, errors }

  const prices = TRAVEL_CLASSES[travelClass as keyof typeof TRAVEL_CLASSES]
  return {
    ok: true,
    value: {
      reference: generateBookingReference(),
      travelClass: travelClass as NormalizedBooking['travelClass'],
      travelDate,
      departure: departure as NormalizedBooking['departure'],
      adults,
      children,
      totalAmount: adults * prices.adult + children * prices.child,
      passenger: {
        fullName,
        passportId,
        gender: gender as NormalizedBooking['passenger']['gender'],
        countryCode,
        email,
      },
    },
  }
}

async function persistBooking(booking: NormalizedBooking) {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase environment variables are not configured.')
  }

  const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/create_booking`, {
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
      p_full_name: booking.passenger.fullName,
      p_passport_id: booking.passenger.passportId,
      p_gender: booking.passenger.gender,
      p_country_code: booking.passenger.countryCode,
      p_email: booking.passenger.email,
    }),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Supabase booking insert failed: ${response.status} ${detail}`)
  }
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { message: 'Method not allowed.' })
    return
  }

  const ip = getClientIp(req)
  if (isRateLimited(ip)) {
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
      whatsappUrl: `https://wa.me/254769869503?text=${encodeURIComponent(whatsappMessage)}`,
    })
  } catch (error) {
    console.error(error)
    sendJson(res, 500, { message: 'We could not submit your booking right now. Please try again later.' })
  }
}
