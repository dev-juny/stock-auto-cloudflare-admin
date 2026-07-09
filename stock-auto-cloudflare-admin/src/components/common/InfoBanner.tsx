import { Info } from 'lucide-react'

interface InfoBannerProps {
  title: string
  description: string
}

export function InfoBanner({ title, description }: InfoBannerProps) {
  return (
    <div className="flex items-start gap-2.5 bg-surface rounded-xl px-3 py-2.5 border border-surface-border">
      <Info size={14} className="text-primary mt-0.5 shrink-0" />
      <div className="text-[11px] text-text-muted leading-relaxed">
        <strong className="text-text">{title}</strong> — {description}
      </div>
    </div>
  )
}
