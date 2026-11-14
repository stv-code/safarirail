import { checkAvailability } from '../../../src/lib/sgr/provider'

export const onRequest = async ({ request }: { request: Request }) => {
  if (request.method !== 'GET') return new Response(null, { status: 405, headers: { Allow: 'GET' } })
  const url = new URL(request.url)
  try {
    const result = await checkAvailability(
      url.searchParams.get('origin') || '',
      url.searchParams.get('destination') || '',
      url.searchParams.get('date') || '',
    )
    return Response.json(result, {
      status: 503,
      headers: { 'Cache-Control': 'no-store', 'Retry-After': '0' },
    })
  } catch {
    return Response.json({ message: 'Invalid route or travel date.' }, {
      status: 400,
      headers: { 'Cache-Control': 'no-store' },
    })
  }
}
