export async function getVideoInfo(youtubeUrl) {
  const videoId = youtubeUrl.split('v=')[1]?.split('&')[0]
  if (!videoId) throw new Error('Invalid YouTube URL')

  const response = await fetch(
    `https://youtube-media-downloader.p.rapidapi.com/v2/video/details?videoId=${videoId}`,
    {
      headers: {
        'X-RapidAPI-Key': import.meta.env.VITE_RAPIDAPI_KEY,
        'X-RapidAPI-Host': 'youtube-media-downloader.p.rapidapi.com',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`RapidAPI error: ${response.status}`)
  }

  const data = await response.json()
  const videos = data.videos?.items || []
  const mp4 =
    videos.find((v) => v.extension === 'mp4' && v.quality === '360p') ||
    videos.find((v) => v.extension === 'mp4')

  return {
    title: data.title || 'Untitled',
    durationSeconds: data.lengthSeconds || 600,
    downloadUrl: mp4?.url || null,
  }
}
