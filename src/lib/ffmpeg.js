import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg = null

export async function loadFFmpeg(onLog) {
  if (ffmpeg) return ffmpeg
  ffmpeg = new FFmpeg()
  if (onLog) ffmpeg.on('log', onLog)
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd'
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(
      `${baseURL}/ffmpeg-core.wasm`,
      'application/wasm'
    ),
  })
  return ffmpeg
}

export async function cutVideoIntoClips(videoUrl, clipPoints, onProgress) {
  const ff = await loadFFmpeg((msg) => console.log('[FFmpeg]', msg))

  const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(videoUrl)}`

  console.log('[FFmpeg] Downloading video...')
  const resp = await fetch(proxyUrl)
  if (!resp.ok) throw new Error(`Video download failed: ${resp.status}`)

  const contentLen = resp.headers.get('content-length')
  const total = contentLen ? parseInt(contentLen) : 0
  const reader = resp.body.getReader()
  const chunks = []

  let downloaded = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    downloaded += value.length
    if (total && onProgress) {
      onProgress(Math.round((downloaded / total) * 60))
    }
  }

  onProgress(60)

  const videoBlob = new Blob(chunks, { type: 'video/mp4' })
  await ff.writeFile('input.mp4', await fetchFile(videoBlob))

  onProgress(65)

  const clips = []

  for (let i = 0; i < clipPoints.length; i++) {
    const { start, end } = clipPoints[i]
    const outputName = `clip_${i}.mp4`

    await ff.exec([
      '-i',
      'input.mp4',
      '-ss',
      String(start),
      '-to',
      String(end),
      '-c',
      'copy',
      outputName,
    ])

    const data = await ff.readFile(outputName)
    const blob = new Blob([data.buffer], { type: 'video/mp4' })
    const url = URL.createObjectURL(blob)
    clips.push({ blob, url, start, end })

    if (onProgress) onProgress(65 + Math.round(((i + 1) / clipPoints.length) * 35))
  }

  return clips
}
