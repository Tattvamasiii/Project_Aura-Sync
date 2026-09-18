import { RefreshCw, Wifi, WifiOff, Loader2 } from 'lucide-react'
import { useState, useEffect, useCallback } from 'react'
import { query } from '../lib/db.js'
import { runSync } from '../lib/sync.js'

export default function SyncPage() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [lastResult, setLastResult] = useState(null)
  const [pendingCount, setPendingCount] = useState(0)

  const refreshPendingCount = useCallback(() => {
    try {
      const rows = query(`SELECT COUNT(*) as count FROM sync_queue`)
      setPendingCount(rows[0]?.count ?? 0)
    } catch {
      // db not ready yet on first render — ignore
    }
  }, [])

  const handleSync = useCallback(async () => {
    if (syncing || !navigator.onLine) return
    setSyncing(true)
    try {
      const result = await runSync()
      setLastResult(result)
      refreshPendingCount()
    } catch (err) {
      setLastResult({ error: err.message })
    } finally {
      setSyncing(false)
    }
  }, [syncing, refreshPendingCount])

  useEffect(() => {
    refreshPendingCount()
    const goOnline = () => {
      setIsOnline(true)
      handleSync() // auto-sync as soon as connection returns
    }
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center space-y-3">
      <RefreshCw size={40} className="text-emerald-400" />
      <h2 className="text-xl font-bold text-white">Sync with AWS</h2>

      <div className={`flex items-center gap-2 text-sm font-medium ${isOnline ? 'text-emerald-400' : 'text-rose-400'}`}>
        {isOnline ? <Wifi size={16} /> : <WifiOff size={16} />}
        {isOnline ? 'Online' : 'Offline — changes queued'}
      </div>

      <p className="text-sm text-slate-400">
        {pendingCount} item{pendingCount === 1 ? '' : 's'} waiting to sync
      </p>

      <button
        onClick={handleSync}
        disabled={syncing || !isOnline}
        className="flex items-center gap-2 bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500 text-white px-5 py-2.5 rounded-lg font-medium"
      >
        {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        {syncing ? 'Syncing…' : 'Sync Now'}
      </button>

      {lastResult && !lastResult.error && (
        <p className="text-sm text-slate-400">
          Synced {lastResult.succeeded} · Failed {lastResult.failed} · Pending {lastResult.skipped}
        </p>
      )}
      {lastResult?.error && <p className="text-sm text-rose-400">{lastResult.error}</p>}
    </div>
  )
}