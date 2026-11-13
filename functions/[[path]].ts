interface PagesContext {
  request: Request
  next: () => Promise<Response>
}

export const onRequest = async ({ request, next }: PagesContext): Promise<Response> => {
  const url = new URL(request.url)
  const canonicalHost = 'www.safarirail.co.ke'

  if (url.hostname !== canonicalHost || url.protocol !== 'https:') {
    url.protocol = 'https:'
    url.hostname = canonicalHost
    return Response.redirect(url.href, 301)
  }

  if (!url.pathname.startsWith('/api/') && url.pathname !== '/' && !url.pathname.endsWith('/') && !/\.[^/]+$/.test(url.pathname)) {
    url.pathname += '/'
    return Response.redirect(url.href, 301)
  }

  return next()
}
