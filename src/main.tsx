import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

import { ErrorBoundary } from '@/components/ErrorBoundary'
import { fireEagerInboxFetch } from '@/lib/github/eagerInboxFetch'

// Kick off the Inbox network request IMMEDIATELY — before React even mounts
fireEagerInboxFetch()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
