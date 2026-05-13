import { NavLink } from 'react-router-dom'
import { useChatStore } from '../store/index.js'

const NAV = [
  { to: '/',          label: 'Dashboard',       end: true  },
  { to: '/ai-labs',   label: 'AI Labs'                     },
  { to: '/deals',     label: 'Venture & Deals'             },
  { to: '/startups',  label: 'Startup Tracker'             },
  { to: '/people',    label: 'People Signals'              },
  { to: '/research',  label: 'Research'                    },
  { to: '/thesis',    label: 'Thesis Board'                },
]

export default function Sidebar() {
  const chatOpen  = useChatStore((s) => s.chatOpen)
  const toggleChat = useChatStore((s) => s.toggleChat)

  return (
    <aside className="w-52 shrink-0 flex flex-col border-r border-zinc-800 bg-zinc-950">
      {/* Wordmark */}
      <div className="px-4 py-4 border-b border-zinc-800">
        <span className="text-xs font-mono font-bold text-zinc-100 tracking-[0.2em]">
          MIKOL.AI
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {NAV.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `block px-3 py-1.5 text-xs font-mono rounded transition-colors ${
                isActive
                  ? 'bg-zinc-800 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900'
              }`
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Chat toggle */}
      <div className="px-2 pb-4">
        <button
          onClick={toggleChat}
          className={`w-full px-3 py-2 text-xs font-mono rounded transition-colors ${
            chatOpen
              ? 'bg-blue-700 text-white'
              : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
          }`}
        >
          {chatOpen ? '✕  Close Chat' : '⌘  Ask AI'}
        </button>
      </div>
    </aside>
  )
}
