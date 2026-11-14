import { destinationsFor } from '../../../src/lib/sgr/provider'

export const onRequest = async ({ request }: { request: Request }) => {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  const origin = new URL(request.url).searchParams.get('origin') || ''
  if (!destinationsFor(origin).length) {
    return Response.json({ message: 'Choose a valid origin station.', destinations: [] }, { status: 400 })
  }
  return Response.json({ destinations: destinationsFor(origin) }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
