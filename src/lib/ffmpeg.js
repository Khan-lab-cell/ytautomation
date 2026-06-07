function getSupportedMimeType() {
  const types = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/webm',
    'video/mp4',
  ]
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || ''
}

export async function cutVideoIntoClips(videoUrl, clipPoints, onProgress) {
  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(videoUrl)}`

  console.log('[Clipper] Downloading video...')
  const resp = await fetch(proxyUrl)
  if (!resp.ok) throw new Error(`Video download failed (${resp.status})`)

  const reader = resp.body.getReader()
  const chunks = []
  let downloaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    downloaded += value.length
    if (onProgress) onProgress(Math.round((downloaded / resp.headers.get('content-length') || 1) * 60))
  }

  console.log('[Clipper] Download complete:', (downloaded / 1024 / 1024).toFixed(1), 'MB')

  const mimeType = getSupportedMimeType()
  const videoBlob = new Blob(chunks, { type: resp.headers.get('content-type') || 'video/mp4' })
  const blobUrl = URL.createObjectURL(videoBlob)

  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = blobUrl
  document.body.appendChild(video)

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = resolve
    video.onerror = () => reject(new Error('Failed to load downloaded video'))
  })

  const clips = []

  for (let i = 0; i < clipPoints.length; i++) {
    const { start, end } = clipPoints[i]
    const duration = end - start

    if (Math.abs(video.currentTime - start) > 0.5) {
      video.currentTime = start
      await new Promise((resolve) => { video.onseeked = resolve })
    }

    const stream = video.captureStream(30)
    const recorder = new MediaRecorder(stream, { mimeType })
    const recordedChunks = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) recordedChunks.push(e.data)
    }

    await new Promise((resolve) => {
      recorder.onstop = () => {
        clearInterval(checkInterval)
        clearTimeout(safetyTimer)
        resolve()
      }
      recorder.start(1000)
      video.play()

      const clipStartTime = video.currentTime
      const checkInterval = setInterval(() => {
        if (video.currentTime >= clipStartTime + duration) {
          recorder.stop()
          video.pause()
        }
      }, 200)

      const safetyTimer = setTimeout(() => {
        recorder.stop()
        video.pause()
      }, (duration + 30) * 1000)
    })

    const clipBlob = new Blob(recordedChunks, { type: mimeType })
    const clipUrl = URL.createObjectURL(clipBlob)
    clips.push({ blob: clipBlob, url: clipUrl, start, end })

    if (onProgress) onProgress(60 + Math.round(((i + 1) / clipPoints.length) * 40))
  }

  video.remove()
  URL.revokeObjectURL(blobUrl)
  return clips
}
