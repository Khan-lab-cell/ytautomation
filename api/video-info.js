export const config = { maxDuration: 30 }

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

  const workerUrl = process.env.WORKER_URL
  const workerKey = process.env.WORKER_API_KEY

  if (!workerUrl || !workerKey) {
    res.status(500).json({
      error: 'Worker not configured. Set WORKER_URL and WORKER_API_KEY env vars in Vercel.',
    })
    return
  }

  let target = `${workerUrl.replace(/\/+$/, '')}/info`
  if (!/^https?:\/\//i.test(target)) {
    target = `http://${target}`
  }

  try {
    const workerResp = await fetch(target, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': workerKey,
      },
      body: JSON.stringify({ url: decodedUrl }),
    })

    if (!workerResp.ok) {
      const body = await workerResp.text().catch(() => '')
      console.error(`[video-info] worker returned ${workerResp.status}: ${body.slice(0, 200)}`)
      res.status(workerResp.status).json({
        error: 'Worker error',
        detail: body.slice(0, 500),
      })
      return
    }

    const data = await workerResp.json()
    res.json(data)
  } catch (err) {
    console.error('[video-info] worker fetch failed:', err.message)
    res.status(502).json({ error: `Worker unreachable: ${err.message}` })
  }
}
