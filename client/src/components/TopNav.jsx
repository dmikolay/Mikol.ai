import { NavLink } from 'react-router-dom'
import { useChatStore } from '../store/index.js'

const TABS = [
  { to: '/',         label: 'Dashboard',          end: true },
  { to: '/ai-labs',  label: 'AI Labs'                       },
  { to: '/deals',    label: 'Venture & Deal Flow'           },
  { to: '/startups', label: 'Startup Tracker'               },
  { to: '/people',   label: 'People Signals'                },
  { to: '/research', label: 'Research'                      },
  { to: '/thesis',   label: 'Thesis Board'                  },
]

export default function TopNav() {
  const chatOpen   = useChatStore((s) => s.chatOpen)
  const toggleChat = useChatStore((s) => s.toggleChat)

  return (
    <nav className="top-nav">
      <div className="top-nav__wordmark">MIKOL.AI</div>

      <div className="top-nav__tabs">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `top-nav__tab${isActive ? ' active' : ''}`
            }
          >
            {label}
          </NavLink>
        ))}
      </div>

      <div className="top-nav__actions">
        <button
          onClick={toggleChat}
          className={`btn-chat-toggle ${chatOpen ? 'open' : 'closed'}`}
        >
          <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
            <path d="M14 1H2a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h3l3 3 3-3h3a1 1 0 0 0 1-1V2a1 1 0 0 0-1-1z"/>
          </svg>
          {chatOpen ? 'CLOSE' : 'ASK AI'}
        </button>
      </div>
    </nav>
  )
}
