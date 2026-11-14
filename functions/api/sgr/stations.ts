import { stations } from '../../../src/lib/sgr/provider'

export const onRequest = async ({ request }: { request: Request }) => {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  return Response.json({ stations }, { headers: { 'Cache-Control': 'public, max-age=3600' } })
}
