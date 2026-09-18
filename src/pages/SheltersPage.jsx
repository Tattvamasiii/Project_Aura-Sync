import { useState, useEffect, useCallback } from 'react'
import { Home, Navigation, Users, MapPinned } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { getCurrentPosition } from '../lib/geolocation'
import { listShelters } from '../lib/shelters'

const STATUS_STYLES = {
  open: 'bg-emerald-950 border-emerald-800 text-emerald-400',
  full: 'bg-rose-950 border-rose-800 text-rose-400',
  unknown: 'bg-slate-800 border-slate-700 text-slate-400',
}

export default function SheltersPage() {
  const { dbReady } = useApp()
  const [shelters, setShelters] = useState([])
  const [userPos, setUserPos] = useState(null)
  const [locating, setLocating] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)

  const refresh = useCallback((pos) => {
    if (!dbReady) return
    setShelters(listShelters(pos))
  }, [dbReady])

  useEffect(() => {
    refresh(null)
  }, [refresh])

  const findNearby = async () => {
    setLocating(true)
    setErrorMsg(null)
    try {
      const pos = await getCurrentPosition()
      const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
      setUserPos(coords)
      refresh(coords)
    } catch (err) {
      setErrorMsg(err.message || 'Could not get your location')
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="flex flex-col items-center py-6 px-4 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-white">Safe Shelters</h2>
        <p className="text-xs text-slate-400">Pre-downloaded shelter list — works fully offline</p>
      </div>

      <div className="w-full max-w-md">
        <button
          onClick={findNearby}
          disabled={!dbReady || locating}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500
                     disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
        >
          <Navigation size={16} />
          {locating ? 'Locating…' : userPos ? 'Refresh Nearby Shelters' : 'Find Nearby Shelters'}
        </button>
        {errorMsg && <p className="text-xs text-rose-400 mt-2 text-center">{errorMsg}</p>}
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Shelters ({shelters.length})
          </h3>
          <span className="text-[10px] text-emerald-400 font-mono">SQLite • Local</span>
        </div>

        {shelters.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No shelter data available.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {shelters.map((s) => (
              <div key={s.id} className="bg-slate-800 p-3 rounded-lg border border-slate-750 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <Home size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-slate-100">{s.name}</p>
                      <p className="text-[10px] text-slate-500 font-mono">{s.lat.toFixed(4)}, {s.lng.toFixed(4)}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] font-semibold px-2 py-1 rounded border shrink-0 ${STATUS_STYLES[s.status] || STATUS_STYLES.unknown}`}>
                    {s.status.toUpperCase()}
                  </span>
                </div>

                <div className="flex items-center gap-4 text-[11px] text-slate-400">
                  {s.capacity != null && (
                    <span className="flex items-center gap-1">
                      <Users size={12} /> Capacity: {s.capacity}
                    </span>
                  )}
                  {s.distance != null && (
                    <span className="flex items-center gap-1">
                      <MapPinned size={12} /> {s.distance.toFixed(1)} km away
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
