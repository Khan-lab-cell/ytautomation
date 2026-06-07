const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'meta-llama/llama-3.3-70b-instruct:free'
const MAX_RETRIES = 3

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function callOpenRouter(prompt, retry = 0) {
  const res = await fetch(OPENROUTER_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: prompt }],
    }),
  })

  if (res.status === 429 && retry < MAX_RETRIES) {
    const wait = (2 ** retry + Math.random()) * 1000
    await sleep(wait)
    return callOpenRouter(prompt, retry + 1)
  }

  if (!res.ok) {
    throw new Error(`OpenRouter error: ${res.status}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function detectBestMoments(videoTitle, videoDurationSeconds, clipCount = 4) {
  const prompt = `You are a viral video clip detector.
Video title: "${videoTitle}"
Video duration: ${videoDurationSeconds} seconds

Select ${clipCount} best moments from this video that would make great 60-second viral short clips.
Each clip must be exactly 60 seconds.
Space them out across the video duration.

Respond ONLY with valid JSON array, no explanation:
[
  { "start": 0, "end": 60, "reason": "intro hook" },
  { "start": 120, "end": 180, "reason": "key insight" }
]`

  const raw = await callOpenRouter(prompt)
  try {
    const json = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(json)
  } catch {
    const clips = []
    const step = Math.floor(videoDurationSeconds / clipCount)
    for (let i = 0; i < clipCount; i++) {
      clips.push({
        start: i * step,
        end: Math.min(i * step + 60, videoDurationSeconds),
        reason: `Clip ${i + 1}`,
      })
    }
    return clips
  }
}

export async function generateCaptionAndHashtags(videoTitle, clipReason) {
  const prompt = `Generate a viral social media caption and hashtags for this video clip.
Video: "${videoTitle}"
Clip topic: "${clipReason}"

Respond ONLY with valid JSON, no explanation:
{
  "caption": "Your engaging caption here (max 150 chars)",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5"
}`

  const raw = await callOpenRouter(prompt)
  try {
    const json = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(json)
  } catch {
    return { caption: videoTitle, hashtags: '#viral #shorts #trending' }
  }
}
