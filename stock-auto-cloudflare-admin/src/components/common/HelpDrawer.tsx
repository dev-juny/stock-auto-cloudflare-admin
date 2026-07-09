import { useState } from 'react'
import { X, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react'
import type { HelpContent } from '../../utils/helpContent'

interface HelpDrawerProps {
  content: HelpContent
  open: boolean
  onClose: () => void
}

export function HelpDrawer({ content, open, onClose }: HelpDrawerProps) {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40"
      onClick={onClose}>
      <div className="bg-surface-card w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] overflow-y-auto border border-surface-border"
        onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-surface-card border-b border-surface-border px-4 py-3 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <HelpCircle size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-text">{content.title} 도움말</h3>
          </div>
          <button onClick={onClose} className="p-1 text-text-muted hover:text-text">
            <X size={16} />
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <Section title="화면 목적">
            <p className="text-text-muted leading-relaxed">{content.purpose}</p>
          </Section>

          <Section title="주요 기능">
            <ul className="space-y-1.5">
              {content.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-text-muted">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{f}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="사용 방법">
            <ol className="space-y-1.5 list-decimal list-inside text-text-muted">
              {content.howToUse.map((step, i) => (
                <li key={i}>{step}</li>
              ))}
            </ol>
          </Section>

          {content.indicators.length > 0 && (
            <Section title="주요 지표 설명">
              <div className="space-y-2">
                {content.indicators.map((ind, i) => (
                  <div key={i} className="bg-surface rounded-lg px-3 py-2">
                    <div className="text-text font-medium mb-0.5">{ind.name}</div>
                    <div className="text-text-muted leading-relaxed">{ind.desc}</div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {content.faq.length > 0 && (
            <Section title="자주 묻는 질문">
              <div className="space-y-1">
                {content.faq.map((item, i) => (
                  <div key={i} className="bg-surface rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedFaq(expandedFaq === i ? null : i)}
                      className="w-full flex items-center justify-between px-3 py-2.5 text-left text-text font-medium"
                    >
                      <span className="pr-2">Q. {item.q}</span>
                      {expandedFaq === i ? <ChevronUp size={14} className="shrink-0" /> : <ChevronDown size={14} className="shrink-0" />}
                    </button>
                    {expandedFaq === i && (
                      <div className="px-3 pb-2.5 text-text-muted leading-relaxed border-t border-surface-border pt-2">
                        A. {item.a}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Section>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider mb-2">{title}</h4>
      {children}
    </div>
  )
}
