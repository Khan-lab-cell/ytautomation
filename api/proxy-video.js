import { Readable } from 'node:stream'

export const config = { maxDuration: 60 }

const YOUTUBE_ID_RE = /^[a-zA-Z0-9_-]{11}$/
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

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

function pickFormat(formats, quality) {
  const sorted = [...formats]
    .filter(f => f.url)
    .sort((a, b) => {
      const aMp4 = a.ext === 'mp4' ? 1 : 0
      const bMp4 = b.ext === 'mp4' ? 1 : 0
      if (aMp4 !== bMp4) return bMp4 - aMp4
      const aDelta = Math.abs((a.height || 360) - quality)
      const bDelta = Math.abs((b.height || 360) - quality)
      return aDelta - bDelta
    })
  return sorted[0] || null
}

async function extractStreamingUrl(vid, quality) {
  const pages = [
    `https://www.youtube.com/embed/${vid}`,
    `https://www.youtube.com/watch?v=${vid}`,
  ]

  for (const pageUrl of pages) {
    const resp = await fetch(pageUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    })
    if (!resp.ok) continue

    const html = await resp.text()
    const match = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/)
    if (!match) continue

    let data
    try {
      data = JSON.parse(match[1])
    } catch {
      continue
    }

    const formats = data?.streamingData?.formats
    if (!formats || !formats.length) continue

    const fmt = pickFormat(formats, quality)
    if (fmt?.url) return fmt.url
  }

  return null
}

async function streamFromVercel(streamingUrl, quality, req, res) {
  const videoResp = await fetch(streamingUrl, {
    headers: {
      'User-Agent': BROWSER_UA,
      'Referer': 'https://www.youtube.com/',
    },
  })

  if (!videoResp.ok) {
    const text = await videoResp.text().catch(() => '')
    console.error(`[proxy-video] CDN fetch returned ${videoResp.status}: ${text.slice(0, 200)}`)
    return false
  }

  const contentType = videoResp.headers.get('content-type') || 'video/mp4'
  const ext = contentType.includes('mp4') ? 'mp4' : 'webm'
  res.setHeader('Content-Type', contentType)
  res.setHeader('Content-Disposition', `attachment; filename="clip-${quality}p.${ext}"`)
  res.setHeader('Cache-Control', 'no-store')

  const cl = videoResp.headers.get('content-length')
  if (cl) res.setHeader('Content-Length', cl)

  if (!videoResp.body) {
    res.end()
    return true
  }

  let aborted = false
  req.on('close', () => { aborted = true })

  await new Promise((resolve, reject) => {
    Readable.fromWeb(videoResp.body)
      .on('error', (e) => {
        if (!aborted) console.error('[proxy-video] stream error:', e?.message)
        try { res.end() } catch {}
        resolve()
      })
      .on('end', resolve)
      .pipe(res)
  })

  return true
}

async function proxyViaWorker(decodedUrl, quality, req, res) {
  let workerUrl = process.env.WORKER_URL
  const workerKey = process.env.WORKER_API_KEY

  if (!workerUrl || !workerKey) {
    res.status(500).json({
      error: 'Vercel extraction failed and worker not configured. Set WORKER_URL and WORKER_API_KEY env vars, or export browser cookies from YouTube and upload to Railway.',
    })
    return
  }

  workerUrl = workerUrl.replace(/\/+$/, '')
  if (!/^https?:\/\//i.test(workerUrl)) {
    workerUrl = `http://${workerUrl}`
  }

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
      try { res.end() } catch {}
    }
    return
  }

  if (!workerResp.ok) {
    clearTimeout(timeout)
    const body = await workerResp.text().catch(() => '')
    console.error(`[proxy-video] worker returned ${workerResp.status}: ${body.slice(0, 300)}`)
    if (!res.headersSent) {
      res.status(workerResp.status).json({
        error: 'Worker error',
        status: workerResp.status,
        detail: body.slice(0, 500),
      })
    }
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
    if (!aborted) { aborted = true; controller.abort() }
  })

  await new Promise((resolve) => {
    Readable.fromWeb(workerResp.body)
      .on('error', (e) => {
        clearTimeout(timeout)
        if (!aborted) console.error('[proxy-video] stream error:', e?.message)
        try { res.end() } catch {}
        resolve()
      })
      .on('end', () => {
        clearTimeout(timeout)
        resolve()
      })
      .pipe(res)
  })
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

  const vid = extractVideoId(decodedUrl)
  if (!vid) {
    res.status(400).json({ error: 'Not a valid YouTube URL' })
    return
  }

  const quality = Math.max(144, Math.min(parseInt(req.query?.quality, 10) || 360, 1080))

  try {
    const streamingUrl = await extractStreamingUrl(vid, quality)
    if (streamingUrl) {
      console.log('[proxy-video] Vercel extraction OK, streaming from Vercel')
      const ok = await streamFromVercel(streamingUrl, quality, req, res)
      if (ok) return
    }
  } catch (err) {
    console.warn('[proxy-video] Vercel extraction failed:', err.message)
  }

  console.log('[proxy-video] Falling back to Railway worker')
  await proxyViaWorker(decodedUrl, quality, req, res)
}
