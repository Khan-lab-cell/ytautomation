import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export default function History({ user }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    loadJobs()
  }, [user])

  const loadJobs = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const jobsWithCounts = await Promise.all(
      (data || []).map(async (job) => {
        const { count } = await supabase
          .from('clips')
          .select('*', { count: 'exact', head: true })
          .eq('job_id', job.id)

        const { data: clipData } = await supabase
          .from('clips')
          .select('platforms')
          .eq('job_id', job.id)

        const allPlatforms = [
          ...new Set((clipData || []).flatMap((c) => c.platforms || [])),
        ]

        return { ...job, clipCount: count || 0, platforms: allPlatforms }
      })
    )

    setJobs(jobsWithCounts)
    setLoading(false)
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-dark pt-24 flex items-center justify-center">
        <p className="text-gray-400">Please log in to view your history.</p>
      </div>
    )
  }

  const statusColor = {
    pending: 'bg-yellow-400/10 text-yellow-400',
    processing: 'bg-blue-400/10 text-blue-400',
    done: 'bg-green-400/10 text-green-400',
    failed: 'bg-red-400/10 text-red-400',
  }

  return (
    <div className="min-h-screen bg-dark pt-24 pb-16">
      <div className="max-w-7xl mx-auto px-4">
        <h1 className="text-3xl font-heading font-bold text-white mb-8">
          History
        </h1>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <svg className="animate-spin h-8 w-8 text-accent" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500">No jobs yet. Process your first video!</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Date</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Video</th>
                  <th className="text-center px-6 py-4 text-gray-400 font-medium">Clips</th>
                  <th className="text-center px-6 py-4 text-gray-400 font-medium">Status</th>
                  <th className="text-left px-6 py-4 text-gray-400 font-medium">Platforms</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4 text-gray-300 whitespace-nowrap">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-gray-300 max-w-xs truncate">
                      {job.video_title || job.youtube_url}
                    </td>
                    <td className="px-6 py-4 text-gray-300 text-center">{job.clipCount}</td>
                    <td className="px-6 py-4 text-center">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColor[job.status] || 'bg-gray-400/10 text-gray-400'}`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-300">
                      {job.platforms.length > 0
                        ? job.platforms.join(', ')
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
