import { LayoutDashboard, PieChart, CandlestickChart, ScrollText, Settings, Zap, Timer, PlayCircle } from 'lucide-react'

interface Tab {
  id: string
  label: string
  icon: typeof LayoutDashboard
}

const tabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart },
  { id: 'evolution', label: 'Evolution', icon: Zap },
  { id: 'strategy', label: 'Strategy', icon: CandlestickChart },
  { id: 'paper-trading', label: 'Paper Trade', icon: PlayCircle },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'scheduler', label: 'Scheduler', icon: Timer },
]

interface BottomNavigationProps {
  active: string
  onChange: (id: string) => void
}

export function BottomNavigation({ active, onChange }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card/95 backdrop-blur-lg border-t border-surface-border safe-area-bottom">
      <div className="flex items-center justify-start overflow-x-auto scrollbar-none max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = active === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-2 min-h-[52px] flex-1 shrink-0 transition-colors ${
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
