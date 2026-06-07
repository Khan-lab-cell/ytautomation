const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions'
const MODELS = [
  'google/gemma-4-31b-it:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'qwen/qwen3-next-80b-a3b-instruct:free',
  'openai/gpt-oss-20b:free',
  'openrouter/free',
]
const MAX_RETRIES_PER_MODEL = 2
const TIMEOUT_MS = 60000

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

async function callModel(model, prompt, retry = 0) {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY
  if (!apiKey) throw new Error('Missing VITE_OPENROUTER_API_KEY environment variable.')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let res
  try {
    res = await fetch(OPENROUTER_URL, {
      signal: controller.signal,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': typeof window !== 'undefined' ? window.location.origin : '',
        'X-Title': 'ClipFlow',
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: prompt }],
        reasoning: { exclude: true, effort: 'low' },
        temperature: 0.3,
        max_tokens: 1500,
      }),
    })
  } finally {
    clearTimeout(timer)
  }

  if (res.status === 429 && retry < MAX_RETRIES_PER_MODEL) {
    const retryAfter = res.headers.get('Retry-After')
    const wait = retryAfter
      ? parseInt(retryAfter) * 1000 + Math.random() * 500
      : (2 ** retry + 1) * 1000 + Math.random() * 500
    await sleep(wait)
    return callModel(model, prompt, retry + 1)
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    const err = new Error(`OpenRouter ${res.status} (${model}): ${text.slice(0, 200) || res.statusText}`)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content || ''
}

async function callOpenRouter(prompt) {
  let lastErr
  for (const model of MODELS) {
    try {
      const out = await callModel(model, prompt)
      if (out && out.trim()) return out
      lastErr = new Error(`Empty response from ${model}`)
    } catch (err) {
      lastErr = err
      if (err.name === 'AbortError') continue
      if (err.status === 402 || err.status === 401 || err.status === 403) throw err
    }
  }
  throw lastErr || new Error('All OpenRouter free models failed.')
}

function fallbackClips(videoTitle, videoDurationSeconds, clipCount) {
  const clips = []
  const usable = Math.max(60, videoDurationSeconds)
  const step = Math.max(60, Math.floor(usable / clipCount))
  for (let i = 0; i < clipCount; i++) {
    const start = Math.min(i * step, Math.max(0, usable - 60))
    clips.push({
      start,
      end: Math.min(start + 60, usable),
      reason: `Clip ${i + 1}`,
      caption: videoTitle,
      hashtags: '#viral #shorts #trending #foryou #fyp',
    })
  }
  return clips
}

export async function detectAndCaptionClips(videoTitle, videoDurationSeconds, clipCount = 4) {
  const prompt = `You are a viral video clip detector and social media caption writer.
Video title: "${videoTitle}"
Video duration: ${videoDurationSeconds} seconds

Select ${clipCount} best moments from this video that would make great 60-second viral short clips.
Each clip must be exactly 60 seconds.
Space them out across the video duration.
For each moment, write an engaging caption (max 150 chars) and 5 relevant hashtags.

Respond ONLY with a valid JSON array, no explanation, no markdown:
[
  {
    "start": 0,
    "end": 60,
    "reason": "intro hook",
    "caption": "This is an engaging caption for the clip",
    "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5"
  }
]`

  let raw
  try {
    raw = await callOpenRouter(prompt)
  } catch (err) {
    console.warn('[openrouter] All models failed, using fallback:', err.message)
    return fallbackClips(videoTitle, videoDurationSeconds, clipCount)
  }

  try {
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const match = cleaned.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(match ? match[0] : cleaned)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.slice(0, clipCount).map((c, i) => ({
        start: Math.max(0, Math.min(Number(c.start) || 0, videoDurationSeconds - 1)),
        end: Math.max(60, Math.min(Number(c.end) || (Number(c.start) || 0) + 60, videoDurationSeconds)),
        reason: c.reason || `Clip ${i + 1}`,
        caption: (c.caption || videoTitle).slice(0, 280),
        hashtags: c.hashtags || '#viral #shorts #trending',
      }))
    }
  } catch (err) {
    console.warn('[openrouter] JSON parse failed, using fallback:', err.message)
  }
  return fallbackClips(videoTitle, videoDurationSeconds, clipCount)
}
