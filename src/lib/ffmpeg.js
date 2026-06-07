import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

let ffmpeg = null

export async function loadFFmpeg() {
  if (ffmpeg) return ffmpeg
  ffmpeg = new FFmpeg()
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
  const ff = await loadFFmpeg()
  const videoData = await fetchFile(videoUrl)
  await ff.writeFile('input.mp4', videoData)

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

    if (onProgress) onProgress(Math.round(((i + 1) / clipPoints.length) * 100))
  }

  return clips
}
