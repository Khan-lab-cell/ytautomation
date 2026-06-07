self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => event.waitUntil(clients.claim()))

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (url.pathname === '/api/sw-proxy') {
    event.respondWith(proxyVideo(event.request, url))
  }
})

async function proxyVideo(request, url) {
  try {
    const videoUrl = url.searchParams.get('url')
    if (!videoUrl) return new Response('Missing "url" param', { status: 400 })

    const decoded = decodeURIComponent(videoUrl)
    const resp = await fetch(decoded, {
      headers: {
        'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
        'Referer': 'https://www.youtube.com/',
        'Accept': 'video/mp4,video/webm,video/ogg,*/*',
      },
    })

    if (!resp.ok) {
      const body = await resp.text()
      console.error('[SW-proxy] CDN returned', resp.status, body.slice(0, 200))
      return new Response(body, { status: resp.status })
    }

    const headers = new Headers()
    headers.set('Content-Type', resp.headers.get('content-type') || 'video/mp4')
    const cl = resp.headers.get('content-length')
    if (cl) headers.set('Content-Length', cl)
    return new Response(resp.body, { status: 200, headers })
  } catch (err) {
    console.error('[SW-proxy] Error:', err.name, err.message)
    return new Response(err.message, { status: 500 })
  }
}
