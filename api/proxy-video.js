import { Readable } from 'node:stream'

export default async function handler(req, res) {
  const { url: videoUrl } = req.query
  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing "url" param' })
  }
  let decodedUrl
  try {
    decodedUrl = decodeURIComponent(videoUrl)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30000)
    const remoteResp = await fetch(decodedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'Referer': 'https://www.youtube.com/',
        'Accept': 'video/mp4,video/webm,video/ogg,*/*',
      },
    })
    clearTimeout(timeout)
    if (!remoteResp.ok) {
      const body = await remoteResp.text()
      console.error(`[proxy-video] YouTube CDN returned ${remoteResp.status}: ${body.slice(0, 200)}`)
      return res.status(remoteResp.status).send(body)
    }
    res.setHeader('Content-Type', remoteResp.headers.get('content-type') || 'video/mp4')
    const contentLength = remoteResp.headers.get('content-length')
    if (contentLength) res.setHeader('Content-Length', contentLength)
    Readable.fromWeb(remoteResp.body).on('error', () => res.end()).pipe(res)
  } catch (err) {
    console.error('[proxy-video] Error:', err.name, '-', err.message)
    console.error('[proxy-video] URL (first 200 chars):', decodedUrl?.slice(0, 200))
    res.status(500).send(`${err.name}: ${err.message}`)
  }
}
