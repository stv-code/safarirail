import { validSchedule, PortalError, getLiveDirectory } from '../../../src/lib/sgr/live'

export const onRequest = async ({ request }: { request: Request }) => {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  const service = new URL(request.url).searchParams.get('service') || 'inter_county'
  if (!validSchedule(service)) return Response.json({ message: 'Choose a valid train service.' }, { status: 400 })
  try {
    const directory = await getLiveDirectory(fetch, service)
    return Response.json(directory, { headers: { 'Cache-Control': 'public, max-age=300' } })
  } catch (error) {
    const code = error instanceof PortalError ? error.code : 'unexpected'
    const stage = error instanceof PortalError ? error.stage : 'stations'
    console.error('[sgr] station provider failure', { stage, code })
    return Response.json({ message: 'Station information is temporarily unavailable.' }, {
      status: error instanceof PortalError && error.code === 'rate_limited' ? 429 : 503,
      headers: {
        'Cache-Control': 'no-store',
        ...(error instanceof PortalError && error.code === 'rate_limited' ? { 'Retry-After': '60' } : {}),
      },
    })
  }
}
