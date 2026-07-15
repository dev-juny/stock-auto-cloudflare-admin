import { LayoutDashboard, PieChart, CandlestickChart, ScrollText, Settings, Zap, Timer, PlayCircle, Shield, ClipboardCheck, Award } from 'lucide-react'

interface Tab {
  id: string
  label: string
  icon: typeof LayoutDashboard
}

const tabs: Tab[] = [
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'portfolio', label: '포트폴리오', icon: PieChart },
  { id: 'evolution', label: '진화', icon: Zap },
  { id: 'strategy', label: '전략', icon: CandlestickChart },
  { id: 'paper-trading', label: '모의투자', icon: PlayCircle },
  { id: 'validation', label: '검증', icon: ClipboardCheck },
  { id: 'risk', label: '리스크', icon: Shield },
  { id: 'production', label: '생산', icon: Award },
  { id: 'logs', label: '로그', icon: ScrollText },
  { id: 'settings', label: '설정', icon: Settings },
  { id: 'scheduler', label: '스케줄러', icon: Timer },
]

interface BottomNavigationProps {
  active: string
  onChange: (id: string) => void
}

export function BottomNavigation({ active, onChange }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card/95 backdrop-blur-lg border-t border-surface-border safe-area-bottom">
      <div className="flex items-center justify-around overflow-x-auto scrollbar-none max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = active === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 min-h-[52px] flex-1 shrink-0 transition-colors ${
                isActive ? 'text-primary' : 'text-text-muted'
              }`}
            >
              <Icon size={18} />
              <span className="text-[10px] font-medium leading-none whitespace-nowrap">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
