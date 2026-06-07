# Plan: Add Clip Count Selector

## Goal
Allow user to choose how many clips to generate (1-5, default 4). Clicking "1" is useful for testing.

## Files to Change

### 1. `src/components/UrlInput.jsx`
- Add `clipCount` state (default 4)
- Add a row of numbered buttons (1-5) above the URL input
- Pass `clipCount` as second arg to `onSubmit(url, clipCount)`

### 2. `src/lib/openrouter.js`
- `detectBestMoments(title, duration, clipCount)` — use `clipCount` in prompt and fallback

### 3. `src/pages/Home.jsx`
- `handleSubmit(url, clipCount)` — accept the new param
- Pass `clipCount` to `detectBestMoments()`

## Edge Cases
- Clips must not exceed video duration — fallback already handles this with `Math.min()`
- Rate limiting: fewer clips = fewer API calls (good for testing with 1)
- If user picks 5 but video is short (< 300s), clips will overlap/truncate naturally via FFmpeg

## What doesn't change
- `ProcessingStatus`, `ClipGrid`, `ClipCard` — they render whatever clips they receive
- Database schema — `jobs` table already has all needed fields
