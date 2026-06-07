# yt-dlp worker

Tiny FastAPI service that wraps `yt-dlp` for use as a video download backend
by the main Vercel app at `api/proxy-video.js`.

## Why
- YouTube signs `googlevideo.com` download URLs to the IP that requested them
  (via the `ip=` query param). Vercel's serverless IPs get 403'd.
- Running `yt-dlp` on a long-lived VPS means the IP that fetches the URL
  matches the IP that originally got the URL signed.

## Routes
- `GET  /health` — `{ok, ytDlpVersion, ffmpegVersion}`
- `GET  /version` — yt-dlp version info
- `POST /download` — body `{url, quality}` → streams `video/mp4`
  - Headers: `X-API-Key: <WORKER_API_KEY>`

## Local dev
```bash
docker build -t yt-dlp-worker .
docker run --rm -p 8000:8000 -e WORKER_API_KEY=test123 yt-dlp-worker

# In another shell:
curl http://localhost:8000/health
curl -H "X-API-Key: test123" -X POST http://localhost:8000/download \
     -H "Content-Type: application/json" \
     -d '{"url":"https://www.youtube.com/watch?v=dQw4w9WgXcQ","quality":360}' \
     -o /tmp/test.mp4
file /tmp/test.mp4
```

## Deploy to Railway
```bash
npm i -g @railway/cli
cd worker
railway login
railway init
railway variables set WORKER_API_KEY=$(openssl rand -hex 32)
railway up
railway domain          # returns https://<name>.up.railway.app
```

Then in Vercel dashboard, add:
- `WORKER_URL` = the Railway URL
- `WORKER_API_KEY` = same value

## Updating yt-dlp
Bump version in `requirements.txt` and `railway up`. YouTube breaks the
extractor every few weeks; expect to redeploy monthly.
