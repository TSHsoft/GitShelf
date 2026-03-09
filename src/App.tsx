import './index.css'
import { useStore } from '@/store/useStore'
import { Sidebar } from '@/components/Sidebar'
import { RepoList } from '@/components/RepoList'
import { useEffect } from 'react'
import { AlertTriangle, Settings, WifiOff } from 'lucide-react'
import { SettingsModal } from '@/components/SettingsModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useState } from 'react'
import { useGithubRateLimit } from '@/hooks/useGithubRateLimit'
import { Toaster } from 'sonner'
import { useLocalPersistence, useAutoSave } from '@/hooks/useGistSync'
import { AuthCallback } from '@/components/AuthCallback'
import { LoginPage } from '@/components/LoginPage'
import { fetchAuthenticatedUserProfile } from '@/lib/github'
import { decryptTokenAsync } from '@/lib/crypto'

function AppContent() {
  const { isLoaded, data, theme, patStatus, isOnline, setIsOnline, githubToken, userProfile, setUserProfile } = useStore()
  const { scheduleSave } = useAutoSave()
  const [showSettings, setShowSettings] = useState(false)

  // Initialize local persistence (load from IndexedDB)
  useLocalPersistence()
  useGithubRateLimit()

  // Apply saved theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [setIsOnline])

  // Auto-save to IndexedDB whenever data changes
  useEffect(() => {
    if (isLoaded) {
      scheduleSave(data)
    }
  }, [data, isLoaded, scheduleSave])

  // Fetch User Profile if we have a token but no profile
  useEffect(() => {
    if (githubToken && patStatus !== 'invalid' && !userProfile && isOnline) {
      // Use fire-and-forget here to populate store
      decryptTokenAsync(githubToken).then(decrypted => {
        return fetchAuthenticatedUserProfile(decrypted)
      }).then(profile => {
        if (profile) setUserProfile(profile)
      }).catch(err => console.error("Could not fetch user profile on load:", err))
    }
  }, [githubToken, patStatus, userProfile, isOnline, setUserProfile])

  // Look for OAuth callback
  if (window.location.search.includes('code=')) {
    return <AuthCallback />
  }

  // Auth gate: no token = show login page
  if (!githubToken) {
    return <LoginPage />
  }

  // Not loaded yet — show nothing (persistence hook is loading)
  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--color-bg)]">
        <div className="animate-pulse text-[var(--color-text-muted)] text-sm">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] flex-col">
        <Toaster position="bottom-right" theme={theme as 'light' | 'dark' | 'system'} richColors />
        {!isOnline && (
          <div className="flex items-center justify-center gap-2 bg-[var(--color-warning)] text-[var(--color-bg)] px-4 py-1.5 text-xs font-medium z-50">
            <WifiOff className="h-3.5 w-3.5" />
            <span>You are offline. Changes are saved locally and will sync when reconnected.</span>
          </div>
        )}
        {patStatus === 'invalid' && (
          <div className="flex items-center justify-center gap-2 bg-[var(--color-danger)] text-white px-4 py-2 text-sm font-medium z-50">
            <AlertTriangle className="h-4 w-4" />
            <span>GitHub Personal Access Token is expired or invalid. Some features are disabled.</span>
            <button
              onClick={() => setShowSettings(true)}
              className="ml-4 flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md transition-colors"
            >
              <Settings className="h-3.5 w-3.5" />
              Update Token
            </button>
          </div>
        )}


        {/* Global Rate Limit warning */}
        {useStore.getState().rateLimitRemaining !== null && useStore.getState().rateLimitRemaining! <= 5 && (
          <div className="flex items-center justify-center gap-2 bg-[var(--color-warning)] text-[var(--color-bg)] px-4 py-1.5 text-xs font-medium z-50">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>API Rate limit is nearly exhausted ({useStore.getState().rateLimitRemaining} remaining). Some features will be disabled.</span>
          </div>
        )}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <Sidebar />
          <main className="flex flex-1 flex-col min-w-0 relative">
            <ErrorBoundary isFullPage={false}>
              <RepoList />
            </ErrorBoundary>
          </main>
        </div>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </>
  )
}

function App() {
  return <AppContent />
}

export default App
