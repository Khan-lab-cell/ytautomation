export const config = { maxDuration: 30 }

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

async function getInfoFromVercel(vid) {
  const result = { title: 'Untitled', durationSeconds: 600, thumbnail: null, videoId: vid }

  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`
  try {
    const oembedResp = await fetch(oembedUrl, {
      headers: { 'User-Agent': BROWSER_UA },
    })
    if (oembedResp.ok) {
      const data = await oembedResp.json()
      result.title = data.title || result.title
      result.thumbnail = data.thumbnail_url || result.thumbnail
    }
  } catch (e) {
    console.warn('[video-info] oembed failed:', e.message)
  }

  for (const pageUrl of [
    `https://www.youtube.com/embed/${vid}`,
    `https://www.youtube.com/watch?v=${vid}`,
  ]) {
    try {
      const pageResp = await fetch(pageUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          'Accept-Language': 'en-US,en;q=0.9',
        },
      })
      if (!pageResp.ok) continue

      const html = await pageResp.text()

      const match = html.match(/ytInitialPlayerResponse\s*=\s*({.*?});/)
      if (match) {
        let data
        try { data = JSON.parse(match[1]) } catch { continue }
        const dur = data?.videoDetails?.lengthSeconds
        if (dur) result.durationSeconds = parseInt(dur, 10)
        const thumb = data?.videoDetails?.thumbnail?.thumbnails
        if (thumb?.length) result.thumbnail = thumb[thumb.length - 1].url || result.thumbnail
        return result
      }

      const durMatch = html.match(/"lengthSeconds"\s*:\s*"?(\d+)"?/)
      if (durMatch) {
        result.durationSeconds = parseInt(durMatch[1], 10)
        return result
      }
    } catch {
      continue
    }
  }

  return result
}

async function getInfoFromWorker(vid) {
  const workerUrl = process.env.WORKER_URL
  const workerKey = process.env.WORKER_API_KEY
  if (!workerUrl || !workerKey) return null

  let target = `${workerUrl.replace(/\/+$/, '')}/info`
  if (!/^https?:\/\//i.test(target)) target = `http://${target}`

  const resp = await fetch(target, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': workerKey },
    body: JSON.stringify({ url: vid }),
  })
  if (!resp.ok) return null
  return resp.json()
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

  try {
    const vercelData = await getInfoFromVercel(vid)
    if (vercelData.title !== 'Untitled' || vercelData.durationSeconds !== 600) {
      res.json(vercelData)
      return
    }
  } catch (e) {
    console.warn('[video-info] Vercel extraction failed:', e.message)
  }

  const workerData = await getInfoFromWorker(vid)
  if (workerData) {
    res.json(workerData)
    return
  }

  res.status(502).json({ error: 'Failed to get video info from any source' })
}
