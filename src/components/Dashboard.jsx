import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard({ user }) {
  const [stats, setStats] = useState({ totalJobs: 0, totalClips: 0, postedClips: 0 })

  useEffect(() => {
    if (!user) return
    let cancelled = false

    const load = async () => {
      const { data: jobs } = await supabase
        .from('jobs')
        .select('id')
        .eq('user_id', user.id)
      if (cancelled) return

      const jobIds = (jobs || []).map((j) => j.id)
      let clipsCount = 0
      let postedCount = 0

      if (jobIds.length > 0) {
        const { count: cc } = await supabase
          .from('clips')
          .select('*', { count: 'exact', head: true })
          .in('job_id', jobIds)
        if (cancelled) return
        clipsCount = cc || 0

        const { count: pc } = await supabase
          .from('clips')
          .select('*', { count: 'exact', head: true })
          .in('job_id', jobIds)
          .eq('post_status', 'posted')
        if (cancelled) return
        postedCount = pc || 0
      }

      setStats({
        totalJobs: jobs?.length || 0,
        totalClips: clipsCount,
        postedClips: postedCount,
      })
    }

    load().catch((err) => {
      if (!cancelled) console.error('[Dashboard] loadStats failed:', err)
    })

    return () => {
      cancelled = true
    }
  }, [user])

  if (!user) return null

  const cards = [
    { label: 'Total Jobs', value: stats.totalJobs, color: 'from-accent to-purple-600' },
    { label: 'Clips Created', value: stats.totalClips, color: 'from-cyan to-blue-600' },
    { label: 'Clips Posted', value: stats.postedClips, color: 'from-green-500 to-emerald-600' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 pb-16">
      <h2 className="text-2xl font-heading font-bold text-white mb-6">Dashboard</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl bg-white/5 border border-white/10 p-6"
          >
            <p className="text-sm text-gray-400 mb-2">{card.label}</p>
            <p className="text-3xl font-heading font-bold text-white">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}
