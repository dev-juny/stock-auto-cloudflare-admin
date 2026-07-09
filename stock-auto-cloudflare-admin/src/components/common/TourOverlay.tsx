import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import type { TourStep } from '../../hooks/useTour'

interface TourOverlayProps {
  step: TourStep
  currentStep: number
  totalSteps: number
  onNext: () => void
  onPrev: () => void
  onFinish: () => void
}

export function TourOverlay({ step, currentStep, totalSteps, onNext, onPrev, onFinish }: TourOverlayProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false)

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60">
      <div className="bg-surface-card border border-surface-border rounded-2xl p-5 max-w-sm w-full mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">
            {currentStep + 1} / {totalSteps}
          </span>
          <button onClick={onFinish} className="p-1 text-text-muted hover:text-text transition-colors">
            <X size={14} />
          </button>
        </div>

        <h3 className="text-sm font-bold text-text mb-2">{step.title}</h3>
        <p className="text-xs text-text-muted leading-relaxed mb-4">{step.description}</p>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentStep ? 'bg-primary' : 'bg-surface-border'}`} />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            {currentStep > 0 && (
              <button onClick={onPrev}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg bg-surface text-text-muted hover:text-text transition-colors">
                <ChevronLeft size={12} /> 이전
              </button>
            )}
            <button onClick={onNext}
              className="flex items-center gap-1 text-[11px] px-3 py-1.5 rounded-lg bg-primary text-white font-medium hover:bg-primary/90 transition-colors">
              {currentStep < totalSteps - 1 ? '다음' : '완료'} <ChevronRight size={12} />
            </button>
          </div>
        </div>

        <label className="flex items-center gap-1.5 mt-3 text-[10px] text-text-muted cursor-pointer">
          <input type="checkbox" checked={dontShowAgain} onChange={e => {
            setDontShowAgain(e.target.checked)
            if (e.target.checked) {
              try { sessionStorage.setItem('tour_completed', 'true') } catch {}
            }
          }}
            className="rounded border-surface-border bg-surface text-primary focus:ring-primary/40" />
          다시 보지 않기
        </label>
      </div>
    </div>
  )
}
