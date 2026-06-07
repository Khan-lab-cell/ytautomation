import { useState } from 'react'
import Hero from '../components/Hero'
import UrlInput from '../components/UrlInput'
import ProcessingStatus from '../components/ProcessingStatus'
import ClipGrid from '../components/ClipGrid'
import Dashboard from '../components/Dashboard'
import { supabase } from '../lib/supabase'
import { getVideoInfo } from '../lib/rapidapi'
import { detectAndCaptionClips } from '../lib/openrouter'
import { cutVideoIntoClips } from '../lib/ffmpeg'
import { postClipToSocial } from '../lib/zernio'

export default function Home({ user }) {
  const [processing, setProcessing] = useState(false)
  const [step, setStep] = useState(null)
  const [progress, setProgress] = useState(0)
  const [clips, setClips] = useState([])
  const [jobId, setJobId] = useState(null)
  const [error, setError] = useState('')

  const handleSubmit = async (url, clipCount) => {
    setProcessing(true)
    setStep('downloading')
    setProgress(0)
    setClips([])
    setError('')

    try {
      let job = null
      if (user) {
        const { data } = await supabase
          .from('jobs')
          .insert({ user_id: user.id, youtube_url: url, status: 'processing' })
          .select()
          .single()
        job = data
        setJobId(job?.id)
      }

      setProgress(10)
      const videoInfo = await getVideoInfo(url)

      setStep('analyzing')
      setProgress(20)

      const clipsData = await detectAndCaptionClips(videoInfo.title, videoInfo.durationSeconds, clipCount)

      setProgress(40)

      setStep('cutting')
      setProgress(60)

      if (!videoInfo.downloadUrl) {
        throw new Error('No downloadable video URL found')
      }

      const cutClips = await cutVideoIntoClips(videoInfo.downloadUrl, clipsData, (p) => {
        setProgress(60 + Math.round((p * 30) / 100))
      })

      const finalClips = cutClips.map((clip, i) => ({
        ...clip,
        caption: clipsData[i]?.caption || videoInfo.title,
        hashtags: clipsData[i]?.hashtags || '#viral #shorts',
      }))

      setClips(finalClips)
      setProgress(100)
      setStep('ready')

      if (job?.id && user) {
        await supabase
          .from('jobs')
          .update({ status: 'done', video_title: videoInfo.title })
          .eq('id', job.id)
      }
    } catch (err) {
      setError(err.message)
      if (jobId && user) {
        await supabase
          .from('jobs')
          .update({ status: 'failed' })
          .eq('id', jobId)
      }
    } finally {
      setProcessing(false)
    }
  }

  const handlePostClip = async (clip, platforms) => {
    if (!clip.blob) return
    const result = await postClipToSocial(clip.blob, clip.caption, clip.hashtags, platforms)

    if (jobId && user) {
      await supabase.from('clips').insert({
        job_id: jobId,
        clip_number: clips.indexOf(clip) + 1,
        start_time: clip.start,
        end_time: clip.end,
        caption: clip.caption,
        hashtags: clip.hashtags,
        platforms,
        post_status: 'posted',
        zernio_post_id: result?.id || null,
      })
    }
  }

  const handlePostAll = async (platforms) => {
    for (const clip of clips) {
      if (!clip.blob) continue
      await handlePostClip(clip, platforms)
    }
  }

  return (
    <div className="min-h-screen bg-dark">
      <Hero />
      <UrlInput onSubmit={handleSubmit} loading={processing} />

      {error && (
        <div className="max-w-2xl mx-auto px-4 pb-8">
          <div className="rounded-2xl bg-red-400/10 border border-red-400/20 p-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        </div>
      )}

      {step && step !== 'ready' && (
        <ProcessingStatus currentStep={step} progress={progress} />
      )}

      {user && <Dashboard user={user} />}

      {clips.length > 0 && (
        <ClipGrid clips={clips} onPostClip={handlePostClip} onPostAll={handlePostAll} />
      )}
    </div>
  )
}
