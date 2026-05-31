'use client'

import type { WorkflowStep } from '@/lib/types'
import { formatDate } from '@/lib/utils'

type StageState = 'done' | 'current' | 'future'

type Props = {
  steps: WorkflowStep[]
  currentStepId: string
  stepTimestamps: Record<string, string>   // step name → ISO timestamp
  result?: string                          // 'Won' | 'Lost' | 'Cancelled' etc.
  onStageClick: (step: WorkflowStep, state: StageState) => void
  onResultClick: () => void
  selectedStepId?: string                  // for checklist preview without moving
  onStepSelect?: (stepId: string) => void
}

export default function StagePipeline({
  steps, currentStepId, stepTimestamps, result,
  onStageClick, onResultClick, selectedStepId, onStepSelect,
}: Props) {
  const currentIdx = steps.findIndex(s => s.id === currentStepId)

  function getState(idx: number): StageState {
    if (idx < currentIdx) return 'done'
    if (idx === currentIdx) return 'current'
    return 'future'
  }

  const isResultActive = result === 'Won' || result === 'Lost' || result === 'Cancelled'

  // Clip label at 18 chars to keep chevrons compact
  const label = (s: WorkflowStep) => s.name.length > 18 ? s.name.slice(0, 16) + '…' : s.name

  const stageColors = (state: StageState, isSelected: boolean) => {
    if (state === 'done') return isSelected
      ? 'bg-green-600 text-white border-green-600'
      : 'bg-green-500 text-white border-green-500 hover:bg-green-600'
    if (state === 'current') return 'bg-blue-600 text-white border-blue-600 shadow-sm'
    return isSelected
      ? 'bg-blue-50 text-blue-700 border-blue-300'
      : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 hover:text-gray-700'
  }

  // Chevron clip-path SVG approach via pseudo-CSS is tricky without Tailwind JIT;
  // use a trapezoid via inline style with border trick or simpler arrow shape
  const chevronStyle = (isLast: boolean): React.CSSProperties =>
    isLast ? {} : {
      clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%, 12px 50%)',
    }
  const firstChevronStyle: React.CSSProperties = {
    clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 50%, calc(100% - 12px) 100%, 0 100%)',
  }

  return (
    <div className="w-full overflow-x-auto">
      <div className="flex min-w-max">
        {steps.map((step, idx) => {
          const state = getState(idx)
          const ts = stepTimestamps[step.name]
          const isSelected = selectedStepId === step.id
          const isFirst = idx === 0
          const isLast = idx === steps.length - 1
          const colors = stageColors(state, isSelected)

          return (
            <button
              key={step.id}
              onClick={() => {
                onStepSelect?.(step.id)
                onStageClick(step, state)
              }}
              style={isFirst ? firstChevronStyle : chevronStyle(false)}
              className={`
                relative flex flex-col items-center justify-center
                px-5 py-3 min-w-[120px] border transition-all
                ${isFirst ? 'rounded-l-lg' : '-ml-2'}
                ${colors}
                focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
              `}
            >
              {/* Step number + checkmark */}
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`w-4 h-4 rounded-full text-xs font-bold flex items-center justify-center shrink-0 ${
                  state === 'done' ? 'bg-white/30 text-white' :
                  state === 'current' ? 'bg-white/20 text-white' :
                  'bg-gray-200 text-gray-400'
                }`}>
                  {state === 'done' ? '✓' : idx + 1}
                </span>
                <span className="text-xs font-semibold leading-tight text-left">{label(step)}</span>
              </div>
              {/* Date stamp */}
              <span className={`text-xs leading-none ${
                state === 'done' ? 'text-green-100' :
                state === 'current' ? 'text-blue-200' :
                'text-gray-400'
              }`}>
                {ts ? formatDate(ts.split('T')[0]) : (state === 'current' ? 'Now' : '—')}
              </span>
            </button>
          )
        })}

        {/* Result end-cap */}
        <button
          onClick={onResultClick}
          style={{ clipPath: 'polygon(0 0, 100% 0, 100% 100%, 0 100%, 12px 50%)' }}
          className={`
            relative flex flex-col items-center justify-center
            px-5 py-3 min-w-[100px] border transition-all -ml-2 rounded-r-lg
            focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-1
            ${isResultActive
              ? result === 'Won' ? 'bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600'
              : result === 'Lost' ? 'bg-red-500 text-white border-red-500 hover:bg-red-600'
              : 'bg-slate-500 text-white border-slate-500 hover:bg-slate-600'
              : 'bg-gray-100 text-gray-400 border-gray-200 hover:bg-gray-200 hover:text-gray-600'
            }
          `}
        >
          <span className="text-xs font-bold">
            {isResultActive ? result : 'Set Result'}
          </span>
          {isResultActive && (
            <span className="text-xs opacity-70 mt-0.5">Click to edit</span>
          )}
        </button>
      </div>
    </div>
  )
}
