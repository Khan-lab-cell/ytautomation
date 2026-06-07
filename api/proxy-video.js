import { Readable } from 'node:stream'

export default async function handler(req, res) {
  const { url: videoUrl } = req.query
  if (!videoUrl) {
    return res.status(400).json({ error: 'Missing "url" param' })
  }
  try {
    const remoteResp = await fetch(decodeURIComponent(videoUrl))
    if (!remoteResp.ok) {
      return res.status(remoteResp.status).send(await remoteResp.text())
    }
    res.setHeader('Content-Type', remoteResp.headers.get('content-type') || 'video/mp4')
    const contentLength = remoteResp.headers.get('content-length')
    if (contentLength) res.setHeader('Content-Length', contentLength)
    Readable.fromWeb(remoteResp.body).on('error', () => res.end()).pipe(res)
  } catch (err) {
    res.status(500).send(err.message)
  }
}
