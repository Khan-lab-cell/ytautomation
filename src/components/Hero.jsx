export default function Hero() {
  return (
    <div className="text-center pt-32 pb-16 px-4">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 text-accent text-sm mb-8">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        AI-Powered Video Clipping
      </div>

      <h1 className="text-5xl sm:text-6xl lg:text-7xl font-heading font-bold leading-tight mb-6">
        Turn Long Videos
        <br />
        Into{' '}
        <span className="bg-gradient-to-r from-accent to-cyan bg-clip-text text-transparent">
          Viral Clips
        </span>
      </h1>

      <p className="text-lg sm:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed">
        Paste a YouTube link. AI finds the best moments. Auto-posts to all
        platforms.
      </p>
    </div>
  )
}
