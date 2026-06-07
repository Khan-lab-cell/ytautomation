function extractVideoId(url) {
  if (!url) return null
  const trimmed = url.trim()
  const idPattern = /^[a-zA-Z0-9_-]{11}$/
  if (idPattern.test(trimmed)) return trimmed

  try {
    const u = new URL(trimmed)
    const host = u.hostname.replace(/^www\./, '')
    if (host === 'youtu.be') {
      const id = u.pathname.slice(1).split('/')[0]
      if (idPattern.test(id)) return id
    }
    if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      const v = u.searchParams.get('v')
      if (v && idPattern.test(v)) return v
      const parts = u.pathname.split('/').filter(Boolean)
      const known = ['shorts', 'embed', 'live', 'v']
      if (parts.length >= 2 && known.includes(parts[0]) && idPattern.test(parts[1])) {
        return parts[1]
      }
    }
  } catch {
    const m = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/)
    if (m) return m[1]
  }
  return null
}

export async function getVideoInfo(youtubeUrl) {
  const videoId = extractVideoId(youtubeUrl)
  if (!videoId) throw new Error('Invalid YouTube URL. Please paste a full youtube.com or youtu.be link.')

  const apiKey = import.meta.env.VITE_RAPIDAPI_KEY
  if (!apiKey) throw new Error('Missing VITE_RAPIDAPI_KEY environment variable.')

  const params = new URLSearchParams({
    videoId,
    urlAccess: 'normal',
    videos: 'auto',
    audios: 'auto',
  })

  const response = await fetch(
    `https://youtube-media-downloader.p.rapidapi.com/v2/video/details?${params.toString()}`,
    {
      headers: {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'youtube-media-downloader.p.rapidapi.com',
      },
    }
  )

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`RapidAPI error ${response.status}: ${body.slice(0, 200) || response.statusText}`)
  }

  const data = await response.json()
  if (data?.errorId && data.errorId !== 'Success') {
    throw new Error(`RapidAPI: ${data.errorId} - ${data.reason || 'unknown'}`)
  }

  const items = data?.videos?.items || []
  const progressive = items.filter((v) => v.hasAudio === true && v.extension === 'mp4')
  const sorted = progressive.sort((a, b) => (a.height || 0) - (b.height || 0))
  const chosen =
    sorted.find((v) => (v.height || 0) >= 360) ||
    sorted[sorted.length - 1] ||
    items.find((v) => v.extension === 'mp4')

  if (!chosen?.url) {
    throw new Error('No downloadable progressive MP4 stream available for this video.')
  }

  return {
    title: data.title || 'Untitled',
    durationSeconds: Number(data.lengthSeconds) || 600,
    downloadUrl: chosen.url,
    quality: chosen.quality || 'unknown',
    hasAudio: chosen.hasAudio === true,
  }
}
