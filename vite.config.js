import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { Readable } from 'node:stream'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'proxy-video',
      configureServer(server) {
        server.middlewares.use('/api/proxy-video', async (req, res) => {
          let decodedUrl
          try {
            const qs = new URL(req.url, `http://${req.headers.host}`).searchParams
            const videoUrl = qs.get('url')
            if (!videoUrl) {
              res.statusCode = 400
              res.end('Missing "url" param')
              return
            }
            decodedUrl = decodeURIComponent(videoUrl)
            const controller = new AbortController()
            const timeout = setTimeout(() => controller.abort(), 30000)
            const remoteResp = await fetch(decodedUrl, {
              signal: controller.signal,
              headers: {
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
                'Referer': 'https://www.youtube.com/',
                'Accept': 'video/mp4,video/webm,video/ogg,*/*',
              },
            })
            clearTimeout(timeout)
            if (!remoteResp.ok) {
              const body = await remoteResp.text()
              console.error(`[proxy-video] YouTube CDN returned ${remoteResp.status}: ${body.slice(0, 200)}`)
              res.statusCode = remoteResp.status
              res.end(body)
              return
            }
            res.setHeader('Content-Type', remoteResp.headers.get('content-type') || 'video/mp4')
            const contentLength = remoteResp.headers.get('content-length')
            if (contentLength) res.setHeader('Content-Length', contentLength)
            Readable.fromWeb(remoteResp.body).on('error', () => res.end()).pipe(res)
          } catch (err) {
            console.error('[proxy-video] Error:', err.name, '-', err.message)
            console.error('[proxy-video] URL (first 200 chars):', decodedUrl?.slice(0, 200))
            res.statusCode = 500
            res.end(`${err.name}: ${err.message}`)
          }
        })
      }
    }
  ],
})
