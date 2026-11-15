import { PortalError, checkLiveAvailability } from '../../../src/lib/sgr/live'

const rateWindowMs = 60_000
const maxChecksPerWindow = 6
const attempts = new Map<string, { count: number; resetAt: number }>()
let activeChecks = 0
const maxConcurrentChecks = 4

function isRateLimited(request: Request): boolean {
  const client = request.headers.get('CF-Connecting-IP') || 'unknown'
  const now = Date.now()
  const record = attempts.get(client)
  if (!record || record.resetAt <= now) {
    attempts.set(client, { count: 1, resetAt: now + rateWindowMs })
    if (attempts.size > 2048) {
      for (const [key, value] of attempts) {
        if (value.resetAt <= now || attempts.size > 2048) attempts.delete(key)
        if (attempts.size <= 1024) break
      }
    }
    return false
  }
  record.count += 1
  return record.count > maxChecksPerWindow
}

export const onRequest = async ({ request }: { request: Request }) => {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  if (isRateLimited(request)) {
    return Response.json({ status: 'unavailable', message: 'Please wait before checking more dates.' }, {
      status: 429,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' },
    })
  }
  if (activeChecks >= maxConcurrentChecks) {
    return Response.json({ status: 'unavailable', message: 'The availability checker is busy. Please try again shortly.' }, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '2' },
    })
  }
  activeChecks += 1
  const url = new URL(request.url)
  try {
    const result = await checkLiveAvailability(
      url.searchParams.get('origin') || '',
      url.searchParams.get('destination') || '',
      url.searchParams.get('date') || '',
    )
    return Response.json({ ...result, cached: false }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    // Log only a fixed provider stage/code. Never log upstream HTML, session
    // cookies, CSRF values, query URLs, or caller-supplied route values.
    if (error instanceof PortalError) {
      console.error('[sgr] availability provider failure', { stage: error.stage, code: error.code })
      const invalid = error.code.startsWith('invalid_')
      return Response.json({
        status: 'unavailable',
        message: invalid ? 'Choose a valid route and travel date.' : 'The official source could not provide a reliable result. Try again later.',
      }, {
        status: invalid ? 400 : error.code === 'rate_limited' ? 429 : 503,
        headers: {
          'Cache-Control': 'no-store',
          ...(error.code === 'rate_limited' ? { 'Retry-After': '60' } : {}),
        },
      })
    }
    console.error('[sgr] availability provider failure', { stage: 'unknown', code: 'unexpected' })
    return Response.json({
      status: 'unavailable',
      message: 'The official source could not provide a reliable result. Try again later.',
    }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  } finally {
    activeChecks = Math.max(0, activeChecks - 1)
  }
}
