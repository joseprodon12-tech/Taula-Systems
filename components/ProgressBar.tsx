'use client'

interface Props {
  step: number
  totalSteps: number
}

const STEP_LABELS = ['Quan?', 'Dades', 'Extras']

export default function ProgressBar({ step, totalSteps }: Props) {
  return (
    <div className="px-6 pt-5 pb-4 border-b border-gray-100">
      <div className="flex items-center justify-between mb-3">
        {STEP_LABELS.map((label, i) => {
          const stepNum = i + 1
          const isActive = stepNum === step
          const isDone = stepNum < step
          return (
            <div key={label} className="flex flex-col items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold mb-1 transition-colors
                  ${isDone ? 'bg-blue-600 text-white' : isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-400'}`}
              >
                {isDone ? (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  stepNum
                )}
              </div>
              <span className={`text-xs font-medium ${isActive ? 'text-blue-600' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex gap-1">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${i + 1 <= step ? 'bg-blue-600' : 'bg-gray-100'}`}
          />
        ))}
      </div>
    </div>
  )
}
