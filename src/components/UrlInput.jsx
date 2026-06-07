import { useState } from 'react'

const CLIP_OPTIONS = [1, 2, 3, 4, 5]

export default function UrlInput({ onSubmit, loading }) {
  const [url, setUrl] = useState('')
  const [clipCount, setClipCount] = useState(4)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!url.trim()) return
    onSubmit(url.trim(), clipCount)
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto px-4 pb-16">
      <div className="flex items-center justify-center gap-2 mb-4">
        <span className="text-sm text-gray-400">Clips:</span>
        {CLIP_OPTIONS.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setClipCount(n)}
            disabled={loading}
            className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
              clipCount === n
                ? 'bg-accent text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {n}
          </button>
        ))}
      </div>

      <div className="relative flex items-center">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Paste YouTube URL here..."
          disabled={loading}
          className="w-full px-6 py-4 pr-40 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-accent/50 focus:ring-2 focus:ring-accent/20 transition-all text-lg disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="absolute right-2 px-6 py-2.5 rounded-xl bg-accent hover:bg-accent/80 disabled:bg-accent/40 text-white font-medium transition-all text-sm"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              Processing
            </span>
          ) : (
            'Process Video'
          )}
        </button>
      </div>
    </form>
  )
}
