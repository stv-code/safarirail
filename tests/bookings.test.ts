import { describe, expect, it, vi } from 'vitest'
import { calculateBookingTotal } from '../src/config/business'
import bookingHandler, { encryptPassportId, persistBooking, validatePayload, type NormalizedBooking } from '../api/bookings'

const encryptionEnv = {
  PASSPORT_ID_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
}

const validPayload = {
  travelClass: 'Economy',
  travelDate: '2099-07-20',
  departure: 'Morning (08:00)',
  adults: 2,
  children: 1,
  fullName: 'Amina Patel',
  passportId: 'P1234567',
  gender: 'Female',
  countryCode: 'KE',
  email: 'amina@example.com',
  consent: true,
}

function validBooking(): NormalizedBooking {
  const validation = validatePayload(validPayload, () => 'SR-TEST-00000001')
  if (!validation.ok) throw new Error('Expected valid booking fixture')
  return validation.value
}

describe('booking validation', () => {
  it('normalizes a valid payload and calculates the total', () => {
    const result = validatePayload(validPayload, () => 'SR-TEST-00000001')

    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.value.reference).toBe('SR-TEST-00000001')
    expect(result.value.passenger.email).toBe('amina@example.com')
    expect(result.value.totalAmount).toBe(5250)
  })

  it('rejects invalid passenger and trip fields', () => {
    const result = validatePayload({
      ...validPayload,
      travelClass: 'Business',
      departure: 'Midnight',
      adults: 7,
      children: -1,
      email: 'not-an-email',
      consent: false,
    })

    expect(result.ok).toBe(false)
    if (result.ok) return

    expect(result.errors).toContain('Select a valid class.')
    expect(result.errors).toContain('Select a valid departure.')
    expect(result.errors).toContain('Adults must be between 1 and 6.')
    expect(result.errors).toContain('Children must be between 0 and 4.')
    expect(result.errors).toContain('Enter a valid email address.')
    expect(result.errors).toContain('Consent is required before submitting.')
  })

  it('rejects past travel dates', () => {
    const result = validatePayload({ ...validPayload, travelDate: '2000-01-01' })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Travel date cannot be in the past.')
  })
})

describe('pricing totals', () => {
  it('uses the shared ticket class source for totals', () => {
    expect(calculateBookingTotal('Economy', 2, 1)).toBe(5250)
    expect(calculateBookingTotal('First Class', 1, 2)).toBe(12000)
    expect(calculateBookingTotal('Premium', 3, 0)).toBe(40500)
  })
})

describe('booking persistence', () => {
  it('encrypts passport or ID values before persistence', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 201 }))

    await persistBooking(
      validBooking(),
      {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        ...encryptionEnv,
      },
      fetcher,
    )

    const request = fetcher.mock.calls[0]?.[1]
    expect(request?.body).toEqual(expect.any(String))

    const body = JSON.parse(String(request?.body)) as { p_passport_id: string }
    expect(body.p_passport_id).not.toBe(validPayload.passportId)
    expect(body.p_passport_id).not.toContain(validPayload.passportId)
    expect(body.p_passport_id).toMatch(/^v1:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+:[A-Za-z0-9_-]+$/)
  })

  it('keeps encryption separate from validation', () => {
    const result = validatePayload(validPayload, () => 'SR-TEST-00000001')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.passenger.passportId).toBe(validPayload.passportId)
  })

  it('requires a configured passport encryption key before persistence', async () => {
    await expect(
      persistBooking(
        validBooking(),
        {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        },
        vi.fn(async () => new Response(null, { status: 201 })),
      ),
    ).rejects.toThrow('PASSPORT_ID_ENCRYPTION_KEY environment variable is not configured.')
  })

  it('produces different ciphertext for the same passport or ID value', () => {
    const first = encryptPassportId(validPayload.passportId, encryptionEnv)
    const second = encryptPassportId(validPayload.passportId, encryptionEnv)

    expect(first).not.toBe(second)
  })

  it('throws a sanitized error when Supabase rejects the write', async () => {
    const fetcher = vi.fn(async () => new Response('passport=P1234567 database detail', { status: 500 }))

    await expect(
      persistBooking(
        validBooking(),
        {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
          ...encryptionEnv,
        },
        fetcher,
      ),
    ).rejects.toThrow('Supabase booking insert failed: 500')

    await expect(
      persistBooking(
        validBooking(),
        {
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
          ...encryptionEnv,
        },
        fetcher,
      ),
    ).rejects.not.toThrow('P1234567')
  })
})

describe('booking API handler', () => {
  it('keeps valid booking leads moving to WhatsApp when persistence fails', async () => {
    const originalEnv = { ...process.env }
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key'
    process.env.PASSPORT_ID_ENCRYPTION_KEY = encryptionEnv.PASSPORT_ID_ENCRYPTION_KEY
    vi.stubGlobal('fetch', vi.fn(async () => new Response('database unavailable', { status: 500 })))

    const headers: Record<string, string> = {}
    let responseBody = ''
    const response = {
      statusCode: 0,
      setHeader(name: string, value: string) {
        headers[name] = value
      },
      end(body?: string) {
        responseBody = String(body || '')
      },
    }

    await bookingHandler(
      {
        method: 'POST',
        headers: { 'x-forwarded-for': '203.0.113.202' },
        body: validPayload,
      },
      response,
    )

    process.env = originalEnv
    vi.unstubAllGlobals()

    expect(response.statusCode).toBe(202)
    expect(headers['Content-Type']).toContain('application/json')

    const body = JSON.parse(responseBody) as { bookingReference: string; whatsappUrl: string; persistenceWarning: boolean; message: string }
    expect(body.bookingReference).toMatch(/^SR-/)
    expect(body.persistenceWarning).toBe(true)
    expect(body.message).toContain('Continue on WhatsApp')
    const whatsappMessage = decodeURIComponent(body.whatsappUrl)
    expect(whatsappMessage).toContain('Please confirm availability and payment details.')
    expect(whatsappMessage).toContain('Name: Amina Patel')
    expect(whatsappMessage).toContain('Passport/ID: P1234567')
    expect(whatsappMessage).toContain('Gender: Female')
    expect(whatsappMessage).toContain('Email: amina@example.com')
  })
})
