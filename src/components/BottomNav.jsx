import { NavLink } from 'react-router-dom'
import { Mic, MapPin, Home, RefreshCw } from 'lucide-react'

const tabs = [
  { to: '/', label: 'Talk', icon: Mic, end: true },
  { to: '/location', label: 'Location', icon: MapPin },
  { to: '/shelters', label: 'Shelters', icon: Home },
  { to: '/sync', label: 'Sync', icon: RefreshCw },
]

export default function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 flex items-stretch justify-around
                 bg-slate-900 border-t border-slate-800
                 pb-[env(safe-area-inset-bottom)]"
    >
      {tabs.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center gap-1 flex-1 py-2.5 min-h-[56px]
             text-xs font-medium transition-colors
             ${isActive ? 'text-emerald-400' : 'text-slate-500'}`
          }
        >
          <Icon size={22} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
