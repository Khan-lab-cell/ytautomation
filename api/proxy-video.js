import { Readable } from 'node:stream'

export const config = { maxDuration: 60 }

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/

function extractVideoId(url) {
  if (!url) return null
  const s = url.trim()
  if (YOUTUBE_ID_RE.test(s)) return s
  try {
    const u = new URL(s)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0]
      return YOUTUBE_ID_RE.test(id) ? id : null
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v')
      if (v && YOUTUBE_ID_RE.test(v)) return v
      const parts = u.pathname.split('/').filter(Boolean)
      if (parts.length >= 2 && ['shorts', 'embed', 'live', 'v'].includes(parts[0]) && YOUTUBE_ID_RE.test(parts[1])) {
        return parts[1]
      }
    }
  } catch {
    const m = s.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
    if (m) return m[1]
  }
  return null
}

export default async function handler(req, res) {
  const rawUrl = req.query?.url
  if (!rawUrl) {
    res.status(400).json({ error: 'Missing "url" param' })
    return
  }

  let decodedUrl
  try {
    decodedUrl = decodeURIComponent(rawUrl)
  } catch {
    res.status(400).json({ error: 'Invalid url encoding' })
    return
  }

  if (!extractVideoId(decodedUrl)) {
    res.status(400).json({ error: 'Not a valid YouTube URL' })
    return
  }

  let workerUrl = process.env.WORKER_URL
  const workerKey = process.env.WORKER_API_KEY

  if (!workerUrl || !workerKey) {
    res.status(500).json({
      error: 'Worker not configured. Set WORKER_URL and WORKER_API_KEY env vars in Vercel.',
    })
    return
  }

  workerUrl = workerUrl.replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(workerUrl)) {
    workerUrl = `http://${workerUrl}`
  }

  const quality = Math.max(144, Math.min(parseInt(req.query?.quality, 10) || 360, 1080))

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 55000)

  let workerResp
  try {
    const target = `${workerUrl.replace(/\/$/, '')}/download`
    workerResp = await fetch(target, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': workerKey,
      },
      body: JSON.stringify({ url: decodedUrl, quality }),
    })
  } catch (err) {
    clearTimeout(timeout)
    console.error('[proxy-video] worker fetch failed:', err.name, err.message)
    if (!res.headersSent) {
      res.status(502).json({ error: `Worker unreachable: ${err.message}` })
    } else {
      try { res.end() } catch (endErr) { /* connection already closed */ void endErr }
    }
    return
  }

  if (!workerResp.ok) {
    clearTimeout(timeout)
    const body = await workerResp.text().catch(() => '')
    console.error(`[proxy-video] worker returned ${workerResp.status}: ${body.slice(0, 300)}`)
    res.status(workerResp.status).json({
      error: 'Worker error',
      status: workerResp.status,
      detail: body.slice(0, 500),
    })
    return
  }

  res.setHeader('Content-Type', workerResp.headers.get('content-type') || 'video/mp4')
  const cl = workerResp.headers.get('content-length')
  if (cl) res.setHeader('Content-Length', cl)
  const cd = workerResp.headers.get('content-disposition')
  if (cd) res.setHeader('Content-Disposition', cd)
  res.setHeader('Cache-Control', 'no-store')

  if (!workerResp.body) {
    clearTimeout(timeout)
    res.end()
    return
  }

  let aborted = false
  req.on('close', () => {
    if (!aborted) {
      aborted = true
      controller.abort()
    }
  })

  Readable.fromWeb(workerResp.body)
    .on('error', (e) => {
      clearTimeout(timeout)
      console.error('[proxy-video] stream error:', e?.message)
      try { res.end() } catch (endErr) { /* connection already closed */ void endErr }
    })
    .on('end', () => {
      clearTimeout(timeout)
    })
    .pipe(res)
}
