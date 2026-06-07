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
          try {
            const qs = new URL(req.url, `http://${req.headers.host}`).searchParams
            const videoUrl = qs.get('url')
            if (!videoUrl) {
              res.statusCode = 400
              res.end('Missing "url" param')
              return
            }
            const remoteResp = await fetch(decodeURIComponent(videoUrl))
            if (!remoteResp.ok) {
              res.statusCode = remoteResp.status
              res.end(await remoteResp.text())
              return
            }
            res.setHeader('Content-Type', remoteResp.headers.get('content-type') || 'video/mp4')
            const contentLength = remoteResp.headers.get('content-length')
            if (contentLength) res.setHeader('Content-Length', contentLength)
            Readable.fromWeb(remoteResp.body).on('error', () => res.end()).pipe(res)
          } catch (err) {
            res.statusCode = 500
            res.end(err.message)
          }
        })
      }
    }
  ],
})
