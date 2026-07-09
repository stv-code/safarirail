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

function sendJson(res: ReviewResponse, statusCode: number, body: ApiResponse) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

export default async function handler(req: ReviewRequest, res: ReviewResponse) {
  try {
    if (req.method === 'GET') {
      const reviews = await listApprovedReviews()
      sendJson(res, 200, { reviews })
      return
    }

    if (req.method === 'POST') {
      const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
      const result = await submitReview(payload || {})

      if (!result.ok) {
        sendJson(res, 400, { message: 'Please correct your review.', errors: result.errors })
        return
      }

      sendJson(res, 201, {
        message: 'Thank you. Your review has been submitted and will appear after approval.',
      })
      return
    }

    res.setHeader('Allow', 'GET, POST')
    sendJson(res, 405, { message: 'Method not allowed.' })
  } catch (error) {
    const isSyntaxError = error instanceof SyntaxError
    sendJson(res, isSyntaxError ? 400 : 500, {
      message: isSyntaxError ? 'Invalid JSON payload.' : 'We could not process reviews right now.',
    })
  }
}

export { REVIEW_MAX_LENGTH, REVIEW_NAME_MAX_LENGTH, REVIEW_ROUTE_MAX_LENGTH }
