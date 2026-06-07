import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function Dashboard({ user }) {
  const [stats, setStats] = useState({ totalJobs: 0, totalClips: 0, postedClips: 0 })

  useEffect(() => {
    if (!user) return
    loadStats()
  }, [user])

  const loadStats = async () => {
    const { data: jobs } = await supabase
      .from('jobs')
      .select('id')
      .eq('user_id', user.id)

    const { count: clipsCount } = await supabase
      .from('clips')
      .select('*', { count: 'exact', head: true })
      .in(
        'job_id',
        (jobs || []).map((j) => j.id)
      )

    const { count: postedCount } = await supabase
      .from('clips')
      .select('*', { count: 'exact', head: true })
      .in(
        'job_id',
        (jobs || []).map((j) => j.id)
      )
      .eq('post_status', 'posted')

    setStats({
      totalJobs: jobs?.length || 0,
      totalClips: clipsCount || 0,
      postedClips: postedCount || 0,
    })
  }

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
