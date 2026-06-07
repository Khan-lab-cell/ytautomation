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
  const mimeType = getSupportedMimeType()

  console.log('[Clipper] Using MIME type:', mimeType)
  console.log('[Clipper] Loading video via proxy...')

  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'auto'
  video.src = proxyUrl
  document.body.appendChild(video)

  let timeout = setTimeout(() => {
    throw new Error('Video loading timed out (60s)')
  }, 60000)

  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => {
      console.log('[Clipper] Video loaded, duration:', video.duration)
      clearTimeout(timeout)
      resolve()
    }
    video.onerror = () => {
      clearTimeout(timeout)
      reject(new Error(`Video load error: ${video.error?.message || 'unknown'}`))
    }
  })

  timeout = setTimeout(() => {
    throw new Error('First frame timed out')
  }, 30000)

  await new Promise((resolve, reject) => {
    video.onloadeddata = () => {
      clearTimeout(timeout)
      resolve()
    }
    video.onerror = () => {
      clearTimeout(timeout)
      reject(new Error(`First frame error: ${video.error?.message || 'unknown'}`))
    }
    video.load()
  })

  const clips = []

  for (let i = 0; i < clipPoints.length; i++) {
    const { start, end } = clipPoints[i]
    const duration = end - start

    console.log(`[Clipper] Clip ${i + 1}: seeking to ${start}s (current: ${video.currentTime})`)

    if (Math.abs(video.currentTime - start) > 0.5) {
      video.currentTime = start
      await new Promise((resolve) => {
        video.onseeked = resolve
      })
    }

    console.log(`[Clipper] Clip ${i + 1}: starting recording (${duration}s)`)

    const stream = video.captureStream()
    const recorder = new MediaRecorder(stream, { mimeType })
    const chunks = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data)
    }

    const recorded = await new Promise((resolve) => {
      recorder.onstop = () => {
        clearInterval(checkInterval)
        clearTimeout(safetyTimer)
        resolve(chunks)
      }
      recorder.start()

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

    const blob = new Blob(recorded, { type: mimeType })
    const url = URL.createObjectURL(blob)
    clips.push({ blob, url, start, end })
    console.log(`[Clipper] Clip ${i + 1} done: ${(blob.size / 1024 / 1024).toFixed(1)}MB`)

    if (onProgress) onProgress(Math.round(((i + 1) / clipPoints.length) * 100))
  }

  video.remove()

  if (clips.length === 0) {
    throw new Error('No clips were created')
  }

  return clips
}
