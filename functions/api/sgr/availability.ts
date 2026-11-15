import { checkedResult, cachedResult, limited } from '../../../src/lib/sgr/cache'
import { routeQuery } from '../../../src/lib/sgr/calendar'
import { isValidDate } from '../../../src/lib/sgr/provider'

export const onRequest = async ({ request }: { request: Request }) => {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  const headers = { 'Cache-Control': 'no-store' }
  if (limited(request, 'day', 20)) return Response.json({ status: 'unavailable', message: 'Please wait a minute before checking more dates.' }, {
    status: 429, headers: { ...headers, 'Retry-After': '60' },
  })
  const url = new URL(request.url)
  let query
  const date = url.searchParams.get('date') || ''
  try { query = routeQuery(url); if (!isValidDate(date)) throw new Error('Choose a valid travel date.') }
  catch (error) { return Response.json({ status: 'unavailable', message: (error as Error).message }, { status: 400, headers }) }
  const refresh = url.searchParams.get('refresh') === '1'
  const cached = !refresh ? await cachedResult(query, date) : undefined
  const result = cached || await checkedResult(query, date, refresh)
  return Response.json({ ...result, cached: Boolean(cached), cacheSeconds: 120 }, { status: result.status === 'unavailable' ? 503 : 200, headers })
}
