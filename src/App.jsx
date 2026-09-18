import { Routes, Route } from 'react-router-dom'
import BottomNav from './components/BottomNav'
import TalkPage from './pages/TalkPage'
import LocationPage from './pages/LocationPage'
import SheltersPage from './pages/SheltersPage'
import SyncPage from './pages/SyncPage'
import { useApp } from './context/AppContext'

function App() {
  const { dbReady, dbError } = useApp()

  if (dbError) {
    return (
      <div className="min-h-screen bg-slate-950 text-rose-400 flex items-center justify-center px-6 text-center">
        Failed to load local database. Try reloading the app.
      </div>
    )
  }

  if (!dbReady) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-400 flex items-center justify-center">
        Loading AuraSync…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <header className="px-4 py-3 border-b border-slate-800">
        <h1 className="text-lg font-bold text-emerald-400">AuraSync</h1>
        <p className="text-[11px] text-slate-500">Offline-first emergency coordination</p>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        <Routes>
          <Route path="/" element={<TalkPage />} />
          <Route path="/location" element={<LocationPage />} />
          <Route path="/shelters" element={<SheltersPage />} />
          <Route path="/sync" element={<SyncPage />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  )
}

export default App
