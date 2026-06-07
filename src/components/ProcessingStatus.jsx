const STEPS = [
  { key: 'downloading', label: 'Downloading' },
  { key: 'analyzing', label: 'AI Analysis' },
  { key: 'cutting', label: 'Cutting Clips' },
  { key: 'ready', label: 'Ready' },
]

const LABEL_MAP = {
  cutting: 'Downloading & processing video...',
}

export default function ProcessingStatus({ currentStep, progress }) {
  const stepIndex = STEPS.findIndex((s) => s.key === currentStep)

  return (
    <div className="max-w-2xl mx-auto px-4 pb-16">
      <div className="rounded-2xl bg-white/5 border border-white/10 p-8">
        <div className="flex items-center justify-between mb-8">
          {STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
                    i <= stepIndex
                      ? 'bg-accent text-white'
                      : 'bg-white/5 text-gray-500'
                  }`}
                >
                  {i < stepIndex ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span
                  className={`text-xs mt-2 ${
                    i <= stepIndex ? 'text-gray-300' : 'text-gray-600'
                  }`}
                >
                  {step.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`w-12 sm:w-20 h-0.5 mx-2 sm:mx-4 transition-all ${
                    i < stepIndex ? 'bg-accent' : 'bg-white/10'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {progress > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-400">
              <span>{LABEL_MAP[currentStep] || 'Processing'}</span>
              <span>{progress}%</span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-accent to-cyan transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
