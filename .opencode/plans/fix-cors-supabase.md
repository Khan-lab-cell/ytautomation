# Plan: Fix CORS Blocking Video Download + Supabase 404

## Issue 1: Video download blocked by CORS

### Root Cause
`src/lib/ffmpeg.js` calls `fetchFile(videoUrl)` where `videoUrl` is a `googlevideo.com` CDN URL from RapidAPI. This CDN doesn't set CORS headers → browser blocks the fetch → FFmpeg never gets the video → hangs silently on "cutting" step.

### Fix: Wrap URL through corsproxy.io

**File: `src/lib/ffmpeg.js`**
- Before calling `fetchFile(videoUrl)`, wrap the URL: `https://corsproxy.io/?url=${encodeURIComponent(videoUrl)}`
- corsproxy.io adds CORS headers to the proxied response
- No other changes needed — FFmpeg.wasm world doesn't care about the proxy

```js
const proxyUrl = `https://corsproxy.io/?url=${encodeURIComponent(videoUrl)}`
const videoData = await fetchFile(proxyUrl)
```

Edge cases:
- corsproxy.io has ~10MB limit on free tier. 360p videos should be fine.
- If the proxy is down / video too large, the error will now surface properly (instead of silent hang)
- Can later swap to self-hosted Vercel proxy if needed

## Issue 2: Supabase 404

### Root Cause
Supabase tables `jobs` and `clips` exist but likely have **RLS (Row Level Security)** enabled without proper policies. Even though anon key can query, RLS blocks access unless there's a matching policy.

### Fix: Check RLS policies on Supabase dashboard

The user needs to verify in Supabase Dashboard → Authentication → Policies that these policies exist:

- `jobs`: Enable INSERT for authenticated users, SELECT for own user_id, UPDATE for own user_id
- `clips`: Enable INSERT for own job_id (via related jobs), SELECT for own job_id

This is a Supabase config fix, not a code change.
