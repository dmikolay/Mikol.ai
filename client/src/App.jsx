import { BrowserRouter, Routes, Route } from 'react-router-dom'
import TopNav from './components/TopNav.jsx'
import ChatPanel from './components/ChatPanel.jsx'
import StatusBar from './components/StatusBar.jsx'
import Dashboard from './pages/Dashboard.jsx'
import AILabs from './pages/AILabs.jsx'
import VentureDeals from './pages/VentureDeals.jsx'
import Startups from './pages/Startups.jsx'
import PeopleSignals from './pages/PeopleSignals.jsx'
import Research from './pages/Research.jsx'
import Thesis from './pages/Thesis.jsx'
import { useChatStore } from './store/index.js'

export default function App() {
  const chatOpen = useChatStore((s) => s.chatOpen)

  return (
    <BrowserRouter>
      <TopNav />
      <div className="app-shell">
        <main className="page-content">
          <Routes>
            <Route path="/"         element={<Dashboard />}    />
            <Route path="/ai-labs"  element={<AILabs />}       />
            <Route path="/deals"    element={<VentureDeals />} />
            <Route path="/startups" element={<Startups />}     />
            <Route path="/people"   element={<PeopleSignals />}/>
            <Route path="/research" element={<Research />}     />
            <Route path="/thesis"   element={<Thesis />}       />
          </Routes>
        </main>
        {chatOpen && <ChatPanel />}
      </div>
      <StatusBar />
    </BrowserRouter>
  )
}
