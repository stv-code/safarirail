import {
  REVIEW_MAX_LENGTH,
  REVIEW_NAME_MAX_LENGTH,
  REVIEW_ROUTE_MAX_LENGTH,
  listApprovedReviews,
  submitReview,
  type ApiResponse,
  type ReviewRequest,
  type ReviewResponse,
} from '../reviews.shared'
import { createRateLimiter, getClientIp } from '../rate-limit'

const reviewSubmitLimiter = createRateLimiter(process.env, {
  namespace: 'reviews:submit',
  windowMs: 60_000,
  maxRequests: 3,
})

function sendJson(res: ReviewResponse, statusCode: number, body: ApiResponse) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function getReviewErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : ''

  if (/Supabase environment variables are not configured/i.test(message)) {
    return 'Review storage is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the production environment.'
  }

  if (/Rate limiter failed|Rate limiter command failed/i.test(message)) {
    return 'Review submissions are temporarily unavailable because rate limiting is not reachable.'
  }

  if (/Supabase review insert failed|Supabase booking lookup failed/i.test(message)) {
    return 'Review storage is temporarily unavailable. Please try again later.'
  }

  return 'We could not save your review right now. Please try again later.'
}

export default async function handler(req: ReviewRequest, res: ReviewResponse) {
  if (req.method === 'GET') {
    try {
      const reviews = await listApprovedReviews()
      sendJson(res, 200, { reviews })
    } catch (error) {
      console.error('Review listing failed', error)
      sendJson(res, 200, { reviews: [] })
    }
    return
  }

  if (req.method === 'POST') {
    try {
      const ip = getClientIp(req)
      const rateLimit = await reviewSubmitLimiter.check(ip)
      if (rateLimit.limited) {
        sendJson(res, 429, { message: 'Too many review submissions. Please wait a minute and try again.' })
        return
      }

      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const result = await submitReview(payload || {})

      if (!result.ok) {
        sendJson(res, 400, { message: 'Please correct your review.', errors: result.errors })
        return
      }

      sendJson(res, 201, {
        message: 'Thank you. Your review has been submitted and will appear after approval.',
      })
    } catch (error) {
      const isSyntaxError = error instanceof SyntaxError
      console.error('Review submission failed', error)
      sendJson(res, isSyntaxError ? 400 : 503, {
        message: isSyntaxError ? 'Invalid JSON payload.' : getReviewErrorMessage(error),
      })
    }
    return
  }

  res.setHeader('Allow', 'GET, POST')
  sendJson(res, 405, { message: 'Method not allowed.' })
}

export { REVIEW_MAX_LENGTH, REVIEW_NAME_MAX_LENGTH, REVIEW_ROUTE_MAX_LENGTH }
