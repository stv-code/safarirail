import { describe, expect, it, vi } from 'vitest'
import {
  listApprovedReviews,
  moderateReview,
  submitReview,
  validateModerationPayload,
  validateReviewPayload,
} from '../api/reviews.shared'

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
}

describe('review validation', () => {
  it('accepts a valid review', () => {
    const result = validateReviewPayload({
      name: 'Amina',
      rating: 5,
      route: 'Nairobi to Mombasa',
      reviewText: 'Helpful booking support and clear instructions.',
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rating).toBe(5)
  })

  it('rejects missing fields and invalid ratings', () => {
    const result = validateReviewPayload({
      name: '',
      rating: 6,
      reviewText: '',
    })

    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors).toContain('Name is required.')
    expect(result.errors).toContain('Rating must be between 1 and 5.')
    expect(result.errors).toContain('Review text is required.')
  })

  it('rejects spam and honeypot submissions', () => {
    const result = validateReviewPayload({
      name: 'Bot',
      rating: 5,
      route: 'www.spam.test',
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

    const result = await submitReview(
      {
        name: 'Amina',
        rating: 5,
        route: 'Nairobi to Mombasa',
        reviewText: 'Clear instructions.',
      },
      env,
      fetcher,
    )

    expect(result.ok).toBe(true)
    const request = fetcher.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body)) as { status: string }
    expect(body.status).toBe('pending')
  })

  it('lists only approved reviews', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL) => {
      expect(String(input)).toContain('status=eq.approved')
      return new Response(JSON.stringify([
        {
          id: '8ad4a700-07a5-4a22-a4d5-111111111111',
          name: 'Amina',
          rating: 5,
          route: 'Nairobi to Mombasa',
          review_text: 'Excellent support.',
          created_at: '2099-01-01T00:00:00Z',
        },
      ]), { status: 200 })
    })

    const reviews = await listApprovedReviews(env, fetcher)

    expect(reviews).toHaveLength(1)
    expect(reviews[0]?.reviewText).toBe('Excellent support.')
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
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(null, { status: 204 }))

    const result = await moderateReview(
      {
        id: '8ad4a700-07a5-4a22-a4d5-111111111111',
        status: 'approved',
      },
      env,
      fetcher,
    )

    expect(result.ok).toBe(true)
    const request = fetcher.mock.calls[0]?.[1]
    const body = JSON.parse(String(request?.body)) as { status: string; approved_at: string | null }
    expect(body.status).toBe('approved')
    expect(typeof body.approved_at).toBe('string')
  })
})
