import { useState } from 'react'
import ClipCard from './ClipCard'

export default function ClipGrid({ clips, onPostClip, onPostAll }) {
  const [postingClip, setPostingClip] = useState(null)
  const [postingAll, setPostingAll] = useState(false)
  const allPlatforms = ['instagram', 'tiktok', 'youtube', 'facebook']

  const handlePostClip = async (clip, platforms) => {
    setPostingClip(clip.start)
    try {
      await onPostClip(clip, platforms)
    } finally {
      setPostingClip(null)
    }
  }

  const handlePostAll = async () => {
    setPostingAll(true)
    try {
      await onPostAll(allPlatforms)
    } finally {
      setPostingAll(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 pb-16">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-heading font-bold text-white">
          Your Clips
        </h2>
        <button
          onClick={handlePostAll}
          disabled={postingAll}
          className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-accent to-cyan hover:opacity-90 disabled:opacity-40 text-white font-medium transition-all text-sm"
        >
          {postingAll ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Posting All...
            </span>
          ) : (
            'Post All to All Platforms'
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {clips.map((clip, i) => (
          <ClipCard
            key={i}
            clip={clip}
            onPost={handlePostClip}
            posting={postingClip === clip.start}
          />
        ))}
      </div>
    </div>
  )
}
