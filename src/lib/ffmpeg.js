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

async function getProxyUrl(videoUrl) {
  const encoded = encodeURIComponent(videoUrl)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      if (reg.active && !navigator.serviceWorker.controller) {
        await new Promise((r) => {
          navigator.serviceWorker.addEventListener('controllerchange', r, { once: true })
          setTimeout(r, 1500)
        })
      }
      if (navigator.serviceWorker.controller) return `/api/sw-proxy?url=${encoded}`
    } catch {
      // fall through to server proxy
    }
  }
  return `/api/proxy-video?url=${encoded}`
}

function waitForEvent(target, event, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs)
    const onOk = (e) => {
      clearTimeout(t)
      target.removeEventListener('error', onErr)
      resolve(e)
    }
    const onErr = () => {
      clearTimeout(t)
      target.removeEventListener(event, onOk)
      reject(new Error(`Event error before ${event}`))
    }
    target.addEventListener(event, onOk, { once: true })
    target.addEventListener('error', onErr, { once: true })
  })
}

export async function cutVideoIntoClips(videoUrl, clipPoints, onProgress) {
  if (typeof MediaRecorder === 'undefined') {
    throw new Error('Your browser does not support MediaRecorder. Try Chrome or Firefox.')
  }
  const mimeType = getSupportedMimeType()
  if (!mimeType) {
    throw new Error('No supported video MIME type for MediaRecorder.')
  }

  const proxyUrl = await getProxyUrl(videoUrl)
  console.log('[Clipper] Downloading via', proxyUrl.includes('sw-proxy') ? 'ServiceWorker' : 'Server')

  const resp = await fetch(proxyUrl)
  if (!resp.ok) {
    const body = await resp.text().catch(() => '')
    throw new Error(`Video download failed (${resp.status}): ${body.slice(0, 200)}`)
  }

  const totalSize = Number(resp.headers.get('content-length')) || 0
  const reader = resp.body.getReader()
  const chunks = []
  let downloaded = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    downloaded += value.length
    if (onProgress && totalSize > 0) {
      onProgress(Math.min(60, Math.round((downloaded / totalSize) * 60)))
    }
  }

  console.log('[Clipper] Download complete:', (downloaded / 1024 / 1024).toFixed(1), 'MB')

  const contentType = resp.headers.get('content-type') || 'video/mp4'
  const videoBlob = new Blob(chunks, { type: contentType })
  const blobUrl = URL.createObjectURL(videoBlob)

  const video = document.createElement('video')
  video.muted = false
  video.volume = 1
  video.playsInline = true
  video.preload = 'auto'
  video.crossOrigin = 'anonymous'
  video.src = blobUrl
  video.style.position = 'fixed'
  video.style.left = '-9999px'
  video.style.top = '0'
  video.style.width = '320px'
  video.style.height = '180px'
  document.body.appendChild(video)

  try {
    await waitForEvent(video, 'loadedmetadata', 20000)
  } catch (err) {
    video.remove()
    URL.revokeObjectURL(blobUrl)
    throw new Error('Failed to load downloaded video. The source may be blocked or invalid.', { cause: err })
  }

  const clips = []
  try {
    for (let i = 0; i < clipPoints.length; i++) {
      const { start, end } = clipPoints[i]
      const safeStart = Math.max(0, Math.min(start, (video.duration || start) - 1))
      const safeEnd = Math.max(safeStart + 1, Math.min(end, video.duration || end))
      const duration = safeEnd - safeStart

      if (Math.abs(video.currentTime - safeStart) > 0.25) {
        video.currentTime = safeStart
        try {
          await waitForEvent(video, 'seeked', 10000)
        } catch {
          // continue best-effort
        }
      }

      const stream =
        typeof video.captureStream === 'function'
          ? video.captureStream(30)
          : typeof video.mozCaptureStream === 'function'
            ? video.mozCaptureStream(30)
            : null
      if (!stream) throw new Error('Browser does not support video.captureStream().')

      const recorder = new MediaRecorder(stream, { mimeType })
      const recordedChunks = []

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunks.push(e.data)
      }

      await new Promise((resolve, reject) => {
        let stopped = false
        const safetyTimer = setTimeout(() => {
          if (!stopped) finish()
        }, (duration + 30) * 1000)

        let checkInterval = null

        const finish = () => {
          if (stopped) return
          stopped = true
          clearInterval(checkInterval)
          clearTimeout(safetyTimer)
          try {
            video.pause()
          } catch {
            // ignore
          }
          if (recorder.state !== 'inactive') {
            try {
              recorder.stop()
            } catch {
              resolve()
            }
          } else {
            resolve()
          }
        }

        recorder.onstop = () => resolve()
        recorder.onerror = (e) => {
          stopped = true
          clearInterval(checkInterval)
          clearTimeout(safetyTimer)
          reject(e.error || new Error('MediaRecorder error'))
        }

        try {
          recorder.start(1000)
        } catch (err) {
          clearTimeout(safetyTimer)
          reject(err)
          return
        }

        video
          .play()
          .then(() => {
            const clipStartTime = video.currentTime
            checkInterval = setInterval(() => {
              if (video.ended || video.currentTime >= clipStartTime + duration) {
                finish()
              }
            }, 200)
          })
          .catch((err) => {
            clearTimeout(safetyTimer)
            reject(err)
          })
      })

      const clipBlob = new Blob(recordedChunks, { type: mimeType })
      const clipUrl = URL.createObjectURL(clipBlob)
      clips.push({ blob: clipBlob, url: clipUrl, start: safeStart, end: safeEnd })

      if (onProgress) onProgress(60 + Math.round(((i + 1) / clipPoints.length) * 40))
    }
  } finally {
    video.pause()
    video.remove()
    URL.revokeObjectURL(blobUrl)
  }

  return clips
}
