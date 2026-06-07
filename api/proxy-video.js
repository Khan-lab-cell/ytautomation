import { Readable } from 'node:stream'

export const config = { maxDuration: 60 }

export default async function handler(req, res) {
  const videoUrl = req.query?.url
  if (!videoUrl) {
    res.status(400).json({ error: 'Missing "url" param' })
    return
  }

  let decodedUrl
  try {
    decodedUrl = decodeURIComponent(videoUrl)
  } catch {
    res.status(400).json({ error: 'Invalid url encoding' })
    return
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55000)

  try {
    const remoteResp = await fetch(decodedUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          req.headers['user-agent'] ||
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        Referer: 'https://www.youtube.com/',
        Accept: 'video/mp4,video/webm,video/ogg,*/*',
      },
    })
    clearTimeout(timeout)

    if (!remoteResp.ok) {
      const body = await remoteResp.text().catch(() => '')
      console.error(`[proxy-video] CDN returned ${remoteResp.status}: ${body.slice(0, 200)}`)
      res.status(remoteResp.status).send(body || `Upstream ${remoteResp.status}`)
      return
    }

    res.setHeader('Content-Type', remoteResp.headers.get('content-type') || 'video/mp4')
    const cl = remoteResp.headers.get('content-length')
    if (cl) res.setHeader('Content-Length', cl)
    res.setHeader('Cache-Control', 'no-store')

    if (!remoteResp.body) {
      res.end()
      return
    }
    Readable.fromWeb(remoteResp.body)
      .on('error', (e) => {
        console.error('[proxy-video] Stream error:', e?.message)
        try {
          res.end()
        } catch {
          // ignore
        }
      })
      .pipe(res)
  } catch (err) {
    clearTimeout(timeout)
    console.error('[proxy-video] Error:', err.name, '-', err.message)
    console.error('[proxy-video] URL (first 200 chars):', decodedUrl?.slice(0, 200))
    if (!res.headersSent) {
      res.status(500).send(`${err.name}: ${err.message}`)
    } else {
      res.end()
    }
  }
}
