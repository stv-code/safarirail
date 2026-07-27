import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  listApprovedReviews,
  moderateReview,
  submitReview,
  validateModerationPayload,
  validateReviewPayload,
} from '../api/reviews.shared'
import reviewsHandler from '../api/reviews/index'

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
}

const validReview = {
  name: 'Amina',
  rating: 5,
  route: 'Nairobi to Mombasa',
  country: 'United States',
  travelMonth: 'July',
  travellerType: 'Family',
  reviewText: 'Helpful booking support and clear instructions.',
}

describe('review validation', () => {
  it('accepts a valid review with traveller context', () => {
    const result = validateReviewPayload({
      ...validReview,
      bookingEmail: ' AMINA@EXAMPLE.COM ',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rating).toBe(5)
    expect(result.value.country).toBe('United States')
    expect(result.value.travelMonth).toBe('July')
    expect(result.value.travellerType).toBe('Family')
    expect(result.value.bookingEmail).toBe('amina@example.com')
  })

  it('rejects missing fields and invalid ratings', () => {
    const result = validateReviewPayload({
      name: '',
      rating: 6,
      route: '',
      country: '',
      travelMonth: '',
      travellerType: '',
      reviewText: '',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Name is required.')
    expect(result.errors).toContain('Rating must be between 1 and 5.')
    expect(result.errors).toContain('Route is required.')
    expect(result.errors).toContain('Country is required.')
    expect(result.errors).toContain('Travel month is required.')
    expect(result.errors).toContain('Traveller type is required.')
    expect(result.errors).toContain('Review text is required.')
  })

  it('rejects custom routes and context outside the supported options', () => {
    const result = validateReviewPayload({
      ...validReview,
      route: 'Nairobi to Kisumu',
      country: 'Atlantis',
      travelMonth: 'Rainy season',
      travellerType: 'Influencer',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Route must be Nairobi to Mombasa, Mombasa to Nairobi, or Round trip.')
    expect(result.errors).toContain('Country must be selected from the list.')
    expect(result.errors).toContain('Travel month must be selected from the list.')
    expect(result.errors).toContain('Traveller type must be selected from the list.')
  })

  it('rejects invalid booking emails', () => {
    const result = validateReviewPayload({
      ...validReview,
      bookingEmail: 'not-an-email',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Booking email must be a valid email address.')
  })

  it('rejects spam and honeypot submissions', () => {
    const result = validateReviewPayload({
      ...validReview,
      name: 'Bot',
      route: 'Round trip',
      reviewText: 'Great casino link',
      website: 'https://bot.test',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Review could not be submitted.')
    expect(result.errors).toContain('Review appears to contain spam.')
  })
})

describe('review persistence', () => {
  it('submits reviews as pending', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 201 }))

    const result = await submitReview(validReview, env, fetcher)

    expect(result.ok).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
    const request = fetcher.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body)) as {
      status: string
      country: string
      travel_month: string
      traveller_type: string
      booking_email: string | null
      verified_traveller: boolean
    }
    expect(body.status).toBe('pending')
    expect(body.country).toBe('United States')
    expect(body.travel_month).toBe('July')
    expect(body.traveller_type).toBe('Family')
    expect(body.booking_email).toBeNull()
    expect(body.verified_traveller).toBe(false)
  })

  it('marks submissions as verified when the booking email exists', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.includes('/rest/v1/passengers?')) {
        expect(url).toContain('email=eq.amina%40example.com')
        return new Response(JSON.stringify([{ id: 'passenger-id' }]), { status: 200 })
      }
      if (init?.method === 'POST' && url.includes('/rest/v1/reviews')) {
        return new Response(null, { status: 201 })
      }
      return new Response(null, { status: 500 })
    })

    const result = await submitReview(
      {
        ...validReview,
        bookingEmail: 'amina@example.com',
      },
      env,
      fetcher,
    )

    expect(result.ok).toBe(true)
    const request = fetcher.mock.calls.find((call) => call[1]?.method === 'POST')?.[1]
    const body = JSON.parse(String(request?.body)) as { booking_email: string; verified_traveller: boolean }
    expect(body.booking_email).toBe('amina@example.com')
    expect(body.verified_traveller).toBe(true)
  })

  it('still submits when optional booking email verification fails', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.includes('/rest/v1/passengers?')) {
        return new Response(JSON.stringify({ message: 'permission denied for table passengers' }), { status: 403 })
      }
      if (init?.method === 'POST' && url.includes('/rest/v1/reviews')) {
        return new Response(null, { status: 201 })
      }
      return new Response(null, { status: 500 })
    })

    const result = await submitReview(
      {
        ...validReview,
        bookingEmail: 'amina@example.com',
      },
      env,
      fetcher,
    )

    expect(result.ok).toBe(true)
    const request = fetcher.mock.calls.find((call) => call[1]?.method === 'POST')?.[1]
    const body = JSON.parse(String(request?.body)) as { booking_email: string; verified_traveller: boolean }
    expect(body.booking_email).toBe('amina@example.com')
    expect(body.verified_traveller).toBe(false)
  })
  it('falls back to legacy review insert columns when context columns are missing', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.includes('/rest/v1/passengers?')) {
        return new Response(JSON.stringify([{ id: 'passenger-id' }]), { status: 200 })
      }
      if (init?.method === 'POST' && url.includes('/rest/v1/reviews')) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>
        if ('verified_traveller' in body) {
          return new Response(JSON.stringify({ message: "Could not find the 'verified_traveller' column" }), { status: 400 })
        }
        return new Response(null, { status: 201 })
      }
      return new Response(null, { status: 500 })
    })

    const result = await submitReview(
      {
        ...validReview,
        route: 'Round trip',
        bookingEmail: 'amina@example.com',
      },
      env,
      fetcher,
    )

    expect(result.ok).toBe(true)
    const postBodies = fetcher.mock.calls
      .filter((call) => call[1]?.method === 'POST')
      .map((call) => JSON.parse(String(call[1]?.body)) as Record<string, unknown>)
    expect(postBodies).toHaveLength(2)
    expect(postBodies[0]).toHaveProperty('verified_traveller', true)
    expect(postBodies[1]).not.toHaveProperty('verified_traveller')
    expect(postBodies[1]).not.toHaveProperty('booking_email')
    expect(postBodies[1]).not.toHaveProperty('country')
  })

  it('lists only approved reviews without exposing private identifiers', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      expect(url).toContain('status=eq.approved')
      expect(url).not.toContain('id%2C')
      expect(url).not.toContain('booking_email')
      return new Response(JSON.stringify([
        {
          name: 'Amina',
          rating: 5,
          route: 'Nairobi to Mombasa',
          country: 'United States',
          travel_month: 'July',
          traveller_type: 'Family',
          review_text: 'Excellent support.',
          created_at: '2099-01-01T00:00:00Z',
          verified_traveller: true,
        },
      ]), { status: 200 })
    })

    const reviews = await listApprovedReviews(env, fetcher)

    expect(reviews).toHaveLength(1)
    expect(reviews[0]?.reviewText).toBe('Excellent support.')
    expect(reviews[0]?.country).toBe('United States')
    expect(reviews[0]?.travelMonth).toBe('July')
    expect(reviews[0]?.travellerType).toBe('Family')
    expect(reviews[0]?.verifiedTraveller).toBe(true)
    expect(reviews[0]).not.toHaveProperty('id')
    expect(reviews[0]).not.toHaveProperty('bookingEmail')
  })

  it('falls back to legacy approved review listing when context columns are missing', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('verified_traveller')) {
        return new Response(JSON.stringify({ message: "Could not find the 'verified_traveller' column" }), { status: 400 })
      }
      expect(url).toContain('select=name%2Crating%2Croute%2Creview_text%2Ccreated_at')
      return new Response(JSON.stringify([
        {
          name: 'Amina',
          rating: 5,
          route: 'Mombasa to Nairobi',
          review_text: 'Excellent support.',
          created_at: '2099-01-01T00:00:00Z',
        },
      ]), { status: 200 })
    })

    const reviews = await listApprovedReviews(env, fetcher)

    expect(reviews).toHaveLength(1)
    expect(reviews[0]?.country).toBe('')
    expect(reviews[0]?.verifiedTraveller).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})

describe('review moderation', () => {
  it('validates moderation status', () => {
    const result = validateModerationPayload({
      id: '8ad4a700-07a5-4a22-a4d5-111111111111',
      status: 'pending',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Status must be approved or rejected.')
  })

  it('approves reviews through the moderation API helper', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (init?.method === 'GET' && url.includes('/rest/v1/reviews?')) {
        return new Response(JSON.stringify([
          {
            id: '8ad4a700-07a5-4a22-a4d5-111111111111',
            status: 'pending',
          },
        ]), { status: 200 })
      }
      if (init?.method === 'PATCH') {
        return new Response(JSON.stringify([{ id: '8ad4a700-07a5-4a22-a4d5-111111111111' }]), { status: 200 })
      }
      if (init?.method === 'POST' && url.includes('/rest/v1/review_moderation_events')) {
        return new Response(null, { status: 201 })
      }
      return new Response(null, { status: 500 })
    })

    const result = await moderateReview(
      {
        id: '8ad4a700-07a5-4a22-a4d5-111111111111',
        status: 'approved',
      },
      env,
      fetcher,
    )

    expect(result.ok).toBe(true)
    const patchRequest = fetcher.mock.calls.find((call) => call[1]?.method === 'PATCH')?.[1]
    const body = JSON.parse(String(patchRequest?.body)) as { status: string; approved_at: string | null }
    expect(body.status).toBe('approved')
    expect(typeof body.approved_at).toBe('string')

    const auditRequest = fetcher.mock.calls.find((call) => String(call[0]).includes('review_moderation_events'))?.[1]
    const auditBody = JSON.parse(String(auditRequest?.body)) as {
      action: string
      previous_status: string
      new_status: string
      actor: string
    }
    expect(auditBody.action).toBe('approved')
    expect(auditBody.previous_status).toBe('pending')
    expect(auditBody.new_status).toBe('approved')
    expect(auditBody.actor).toBe('admin-token')
  })

  it('returns a validation error when a review does not exist', async () => {
    const fetcher = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }))

    const result = await moderateReview(
      {
        id: '8ad4a700-07a5-4a22-a4d5-111111111111',
        status: 'rejected',
      },
      env,
      fetcher,
    )

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Review not found.')
  })
})

describe('review API route', () => {
  const originalSupabaseUrl = process.env.SUPABASE_URL
  const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  afterEach(() => {
    if (originalSupabaseUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = originalSupabaseUrl

    if (originalServiceRoleKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY
    else process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey
  })

  function createResponse() {
    const headers = new Map<string, string>()
    return {
      statusCode: 0,
      body: '',
      setHeader(name: string, value: string) {
        headers.set(name, value)
      },
      end(body?: string) {
        this.body = body || ''
      },
      json<T>() {
        return JSON.parse(this.body) as T
      },
      headers,
    }
  }

  it('returns an empty approved review list when review storage is not configured', async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = createResponse()

    await reviewsHandler({ method: 'GET', headers: {} }, res)

    expect(res.statusCode).toBe(200)
    expect(res.json<{ reviews: unknown[] }>().reviews).toEqual([])
  })

  it('returns a setup message when review submission storage is not configured', async () => {
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_SERVICE_ROLE_KEY
    const res = createResponse()

    await reviewsHandler(
      {
        method: 'POST',
        headers: {},
        body: validReview,
      },
      res,
    )

    expect(res.statusCode).toBe(503)
    expect(res.json<{ message: string }>().message).toContain('SUPABASE_URL')
  })
})