export async function getVideoInfo(youtubeUrl) {
  const encoded = encodeURIComponent(youtubeUrl)
  const response = await fetch(`/api/video-info?url=${encoded}`)

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`Video info error ${response.status}: ${body.slice(0, 200) || response.statusText}`)
  }

  const data = await response.json()

  if (!data.title || !data.durationSeconds) {
    throw new Error('Invalid response from video info service')
  }

  return {
    title: data.title,
    durationSeconds: Number(data.durationSeconds) || 600,
    thumbnail: data.thumbnail || null,
    videoId: data.videoId || null,
  }
}
