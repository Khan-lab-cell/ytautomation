import { useState } from 'react'

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: 'hover:border-pink-500' },
  { id: 'tiktok', label: 'TikTok', color: 'hover:border-black' },
  { id: 'youtube', label: 'YouTube', color: 'hover:border-red-500' },
  { id: 'facebook', label: 'Facebook', color: 'hover:border-blue-500' },
]

export default function ClipCard({ clip, onPost, posting }) {
  const [selected, setSelected] = useState([])

  const togglePlatform = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    )
  }

  return (
    <div className="rounded-2xl bg-white/5 border border-white/10 overflow-hidden hover:border-accent/30 transition-all">
      <video
        src={clip.url}
        controls
        className="w-full aspect-video bg-black object-cover"
      />

      <div className="p-4 space-y-4">
        <div>
          <p className="text-sm text-gray-300 leading-relaxed line-clamp-2">
            {clip.caption}
          </p>
          <p className="text-xs text-cyan mt-1">{clip.hashtags}</p>
        </div>

        <div>
          <p className="text-xs text-gray-500 mb-2">Post to:</p>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                  selected.includes(p.id)
                    ? 'bg-accent/20 border-accent text-accent'
                    : 'border-white/10 text-gray-400 hover:text-white'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => onPost(clip, selected)}
          disabled={selected.length === 0 || posting}
          className="w-full px-4 py-2.5 rounded-xl bg-accent hover:bg-accent/80 disabled:bg-accent/40 text-white font-medium transition-all text-sm disabled:cursor-not-allowed"
        >
          {posting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Posting...
            </span>
          ) : (
            'Post Now'
          )}
        </button>
      </div>
    </div>
  )
}
