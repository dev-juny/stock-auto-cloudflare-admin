import { LayoutDashboard, PieChart, CandlestickChart, ScrollText, Settings } from 'lucide-react'

interface Tab {
  id: string
  label: string
  icon: typeof LayoutDashboard
}

const tabs: Tab[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'portfolio', label: 'Portfolio', icon: PieChart },
  { id: 'strategy', label: 'Strategy', icon: CandlestickChart },
  { id: 'logs', label: 'Logs', icon: ScrollText },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface BottomNavigationProps {
  active: string
  onChange: (id: string) => void
}

export function BottomNavigation({ active, onChange }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-surface-card/95 backdrop-blur-lg border-t border-surface-border safe-area-bottom">
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {tabs.map((tab) => {
          const isActive = active === tab.id
          const Icon = tab.icon
          return (
            <button
              key={tab.id}
              onClick={() => onChange(tab.id)}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 min-h-[52px] min-w-[64px] transition-colors ${
                isActive ? 'text-primary' : 'text-text-muted'
              }`}
            >
              <Icon size={20} />
              <span className="text-[10px] font-medium leading-none">{tab.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
