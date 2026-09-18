import { createContext, useContext, useEffect, useState } from 'react'
import { initDb } from '../lib/db'
import { seedSheltersIfEmpty } from '../lib/shelters'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [dbReady, setDbReady] = useState(false)
  const [dbError, setDbError] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)

  useEffect(() => {
    initDb()
      .then(() => seedSheltersIfEmpty())
      .then(() => setDbReady(true))
      .catch((err) => {
        console.error('Failed to initialize local database:', err)
        setDbError(err)
      })
  }, [])

  useEffect(() => {
    const goOnline = () => setIsOnline(true)
    const goOffline = () => setIsOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [])

  return (
    <AppContext.Provider value={{ dbReady, dbError, isOnline }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
