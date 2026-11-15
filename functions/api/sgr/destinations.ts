import { validSchedule, PortalError, getLiveDestinations } from '../../../src/lib/sgr/live'

export const onRequest = async ({ request }: { request: Request }) => {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  const origin = new URL(request.url).searchParams.get('origin') || ''
  const service = new URL(request.url).searchParams.get('service') || 'inter_county'
  if (!validSchedule(service)) return Response.json({ message: 'Choose a valid train service.' }, { status: 400 })
  try {
    const destinations = await getLiveDestinations(origin, fetch, service)
    return Response.json({ destinations }, { headers: { 'Cache-Control': 'public, max-age=300' } })
  } catch (error) {
    const code = error instanceof PortalError ? error.code : 'unexpected'
    const stage = error instanceof PortalError ? error.stage : 'destinations'
    console.error('[sgr] destination provider failure', { stage, code })
    const invalid = code.startsWith('invalid_')
    return Response.json({
      message: invalid ? 'Choose a valid origin station.' : 'Destination information is temporarily unavailable.',
      destinations: [],
    }, {
      status: invalid ? 400 : code === 'rate_limited' ? 429 : 503,
      headers: {
        'Cache-Control': 'no-store',
        ...(code === 'rate_limited' ? { 'Retry-After': '60' } : {}),
      },
    })
  }
}
