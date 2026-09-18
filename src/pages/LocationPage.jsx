import { useState, useEffect, useCallback, useRef } from 'react'
import { MapPin, Navigation, Share2, RadioTower, Trash2 } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { getCurrentPosition, watchPosition } from '../lib/geolocation'
import { saveLocation, listMyLocations, deleteLocation } from '../lib/locations'

export default function LocationPage() {
  const { dbReady } = useApp()
  const [status, setStatus] = useState('idle') // idle | locating | error
  const [errorMsg, setErrorMsg] = useState(null)
  const [current, setCurrent] = useState(null)
  const [history, setHistory] = useState([])
  const [broadcasting, setBroadcasting] = useState(false)

  const stopWatchRef = useRef(null)
  const lastSavedAtRef = useRef(0)
  const MIN_SAVE_INTERVAL_MS = 15000 // don't write more than once per 15s during live tracking

  const refreshHistory = useCallback(() => {
    if (!dbReady) return
    setHistory(listMyLocations(10))
  }, [dbReady])

  useEffect(() => {
    refreshHistory()
  }, [refreshHistory])

  useEffect(() => {
    return () => {
      if (stopWatchRef.current) stopWatchRef.current()
    }
  }, [])

  const captureOnce = async () => {
    setStatus('locating')
    setErrorMsg(null)
    try {
      const pos = await getCurrentPosition()
      const { latitude, longitude, accuracy } = pos.coords
      setCurrent({ lat: latitude, lng: longitude, accuracy })
      await saveLocation({ lat: latitude, lng: longitude, accuracy })
      refreshHistory()
      setStatus('idle')
    } catch (err) {
      setErrorMsg(err.message || 'Could not get location')
      setStatus('error')
    }
  }

  const toggleBroadcast = () => {
    if (broadcasting) {
      stopWatchRef.current?.()
      stopWatchRef.current = null
      setBroadcasting(false)
      return
    }

    setBroadcasting(true)
    stopWatchRef.current = watchPosition(
      async (pos) => {
        const { latitude, longitude, accuracy } = pos.coords
        setCurrent({ lat: latitude, lng: longitude, accuracy })

        // Always reflect live position in the UI, but only persist to
        // SQLite (and queue for AWS sync) at most once per interval —
        // prevents flooding local storage / sync bandwidth on a jumpy GPS.
        const now = Date.now()
        if (now - lastSavedAtRef.current >= MIN_SAVE_INTERVAL_MS) {
          lastSavedAtRef.current = now
          await saveLocation({ lat: latitude, lng: longitude, accuracy })
          refreshHistory()
        }
      },
      (err) => {
        setErrorMsg(err.message || 'Location tracking failed')
        setStatus('error')
        setBroadcasting(false)
        stopWatchRef.current?.()
        stopWatchRef.current = null
      }
    )
  }

  const shareLocation = () => {
    if (!current) return
    const url = `https://www.google.com/maps?q=${current.lat},${current.lng}`
    const text = `My current location: ${url}`

    if (navigator.share) {
      navigator.share({ title: 'My Location', text, url }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text)
      alert('Location link copied to clipboard')
    }
  }

  const handleDeleteLocation = async (id) => {
    await deleteLocation(id)
    refreshHistory()
  }

  return (
    <div className="flex flex-col items-center py-6 px-4 space-y-6">
      <div className="text-center space-y-1">
        <h2 className="text-xl font-bold text-white">Share Location</h2>
        <p className="text-xs text-slate-400">Capture GPS coordinates and share, even offline</p>
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
        {current ? (
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-emerald-400">
              <MapPin size={18} />
              <span className="font-mono text-sm">
                {current.lat.toFixed(6)}, {current.lng.toFixed(6)}
              </span>
            </div>
            {current.accuracy && (
              <p className="text-[11px] text-slate-500">Accuracy: ±{Math.round(current.accuracy)}m</p>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No location captured yet.</p>
        )}

        {errorMsg && <p className="text-xs text-rose-400">{errorMsg}</p>}

        <div className="flex gap-2">
          <button
            onClick={captureOnce}
            disabled={!dbReady || status === 'locating'}
            className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500
                       disabled:opacity-50 text-white text-sm font-semibold py-3 rounded-lg transition-colors"
          >
            <Navigation size={16} />
            {status === 'locating' ? 'Locating…' : 'Capture Location'}
          </button>

          <button
            onClick={shareLocation}
            disabled={!current}
            className="flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700
                       disabled:opacity-50 text-slate-200 text-sm font-semibold px-4 py-3 rounded-lg transition-colors"
          >
            <Share2 size={16} />
          </button>
        </div>

        <button
          onClick={toggleBroadcast}
          disabled={!dbReady}
          className={`w-full flex items-center justify-center gap-2 text-sm font-semibold py-3 rounded-lg border transition-colors
            ${broadcasting
              ? 'bg-rose-950 border-rose-700 text-rose-300 hover:bg-rose-900'
              : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700'}`}
        >
          <RadioTower size={16} className={broadcasting ? 'animate-pulse' : ''} />
          {broadcasting ? 'Stop Live Tracking' : 'Start Live Tracking'}
        </button>
      </div>

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
            Recent Pings ({history.length})
          </h3>
          <span className="text-[10px] text-emerald-400 font-mono">SQLite • Local</span>
        </div>

        {history.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">No location history yet.</p>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {history.map((loc) => (
              <div key={loc.id} className="flex items-center justify-between bg-slate-800 p-3 rounded-lg text-sm border border-slate-750">
                <div>
                  <p className="font-mono text-xs text-slate-200">{loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}</p>
                  <p className="text-[10px] text-slate-400">
                    {new Date(loc.created_at).toLocaleTimeString()}
                    {!loc.synced && <span className="text-amber-400"> • pending sync</span>}
                  </p>
                </div>
                <button
                  onClick={() => handleDeleteLocation(loc.id)}
                  aria-label="Delete location"
                  className="flex items-center justify-center bg-rose-950 border border-rose-800 hover:bg-rose-900 px-2.5 py-1.5 rounded text-rose-400 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
