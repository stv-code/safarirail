import { moderateReview, type ApiResponse, type ReviewRequest, type ReviewResponse } from '../reviews.shared'

function sendJson(res: ReviewResponse, statusCode: number, body: ApiResponse) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function getBearerToken(req: ReviewRequest) {
  const authorization = req.headers.authorization
  if (typeof authorization !== 'string') return ''
  const [scheme, token] = authorization.split(' ')
  return scheme?.toLowerCase() === 'bearer' ? token || '' : ''
}

export default async function handler(req: ReviewRequest, res: ReviewResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    sendJson(res, 405, { message: 'Method not allowed.' })
    return
  }

  const adminToken = process.env.REVIEWS_ADMIN_TOKEN
  if (!adminToken || getBearerToken(req) !== adminToken) {
    sendJson(res, 401, { message: 'Unauthorized.' })
    return
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body
    const result = await moderateReview(payload || {})

    if (!result.ok) {
      sendJson(res, 400, { message: 'Please correct the moderation request.', errors: result.errors })
      return
    }

    sendJson(res, 200, { message: `Review ${result.value.status}.` })
  } catch (error) {
    const isSyntaxError = error instanceof SyntaxError
    sendJson(res, isSyntaxError ? 400 : 500, {
      message: isSyntaxError ? 'Invalid JSON payload.' : 'We could not moderate the review right now.',
    })
  }
}
