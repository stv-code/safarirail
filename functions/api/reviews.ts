interface PagesContext {
  request: Request
}

const json = (body: unknown, status = 200) => Response.json(body, {
  status,
  headers: { 'Cache-Control': 'no-store' },
})

// Public review reads safely return an empty collection until a public review
// store is configured. This endpoint never reads or requires private secrets.
export const onRequest = async ({ request }: PagesContext): Promise<Response> => {
  if (request.method === 'GET') return json({ reviews: [] })

  if (request.method === 'POST') {
    return json({ message: 'Review submissions are temporarily unavailable.' }, 503)
  }

  return new Response(null, { status: 405, headers: { Allow: 'GET, POST' } })
}
