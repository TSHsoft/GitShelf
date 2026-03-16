import './index.css'
import { useStore } from '@/store/useStore'
import { Sidebar } from '@/components/Sidebar'
import { RepoList } from '@/components/RepoList'
import { useEffect } from 'react'
import { AlertTriangle, Settings, WifiOff, User, Building2, Book, Folder as FolderIcon } from 'lucide-react'
import { SettingsModal } from '@/components/SettingsModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useState } from 'react'
import { useGithubRateLimit } from '@/hooks/useGithubRateLimit'
import { Toaster } from 'sonner'
import { useLocalPersistence, useAutoSave } from '@/hooks/useGistSync'
import { LoginPage } from '@/components/LoginPage'
import { AuthCallback } from '@/components/AuthCallback'
import { fetchAuthenticatedUserProfile } from '@/lib/github'
import { decryptTokenAsync } from '@/lib/crypto'
import { DndContext, DragOverlay, pointerWithin, rectIntersection, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { CollisionDetection, Modifier } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core'

import type { Repository } from '@/types'

function AppContent() {
  const { data, theme, patStatus, isOnline, setIsOnline, githubToken, userProfile, setUserProfile, moveRepoToFolder, bulkMoveReposToFolder, rateLimitRemaining, isLoaded, clearSelection } = useStore()

  const { scheduleSave } = useAutoSave()
  const [showSettings, setShowSettings] = useState(false)

  // Drag and Drop state
  const [activeId, setActiveId] = useState<string | null>(null)
  const [activeRepo, setActiveRepo] = useState<Repository | null>(null)
  const [draggedIds, setDraggedIds] = useState<string[]>([])
  const [activeFolder, setActiveFolder] = useState<{ id: string, name: string, color?: string } | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // Require 8px movement before dragging starts
      },
    })
  )

  /**
   * Modifier to precisely snap the top-left corner of the dragged overlay
   * exactly to the cursor. This creates the "badge is the cursor" feel!
   */
  const snapTopLeftToCursor: Modifier = ({ transform, activatorEvent, activeNodeRect }) => {
    if (activatorEvent && activeNodeRect) {
      const isTouch = 'touches' in activatorEvent;
      const clientX = isTouch ? (activatorEvent as TouchEvent).touches[0].clientX : (activatorEvent as MouseEvent).clientX;
      const clientY = isTouch ? (activatorEvent as TouchEvent).touches[0].clientY : (activatorEvent as MouseEvent).clientY;

      const badgeWidth = 280;
      
      return {
        ...transform,
        // (clientX + transform.x) is current cursor position
        // We want: BadgeRight = CursorX
        // So: BadgeLeft = CursorX - badgeWidth
        // TransformX = BadgeLeft - originalLeft
        x: (clientX + transform.x - badgeWidth - 8) - activeNodeRect.left,
        y: (clientY + transform.y - 20) - activeNodeRect.top,
      };
    }
    return transform;
  };

  /**
   * BULLETPROOF COLLISION
   * Because the badge's top-left is snapped to the cursor, we just check
   * what the cursor (or the badge's top-left mathematical point) is touching!
   */
  const customCollisionDetection: CollisionDetection = (args) => {
    // If we are dragging a folder, prioritize sortable folder-item collisions
    if (args.active.data.current?.type === 'folder-item') {
      const collisions = pointerWithin(args);
      const sortableCollision = collisions.find(c => String(c.id).startsWith('sort-folder-'));
      if (sortableCollision) return [sortableCollision];
      
      const rectCollisions = rectIntersection(args);
      const sortableRectCollision = rectCollisions.find(c => String(c.id).startsWith('sort-folder-'));
      if (sortableRectCollision) return [sortableRectCollision];

      return [];
    }

    // 1. Direct pointer collision (most natural "hover" feel)
    const collisions = pointerWithin(args);
    const folderCollision = collisions.find(c => c.data?.type === 'folder');
    if (folderCollision) return [folderCollision];

    // 2. Fallback: Check if the mathematical top-left corner of the badge hits a folder
    // (Helps if pointer is slightly off due to fast dragging or 1px gaps)
    if (args.collisionRect) {
      const topX = args.collisionRect.left;
      const topY = args.collisionRect.top;

      for (const container of args.droppableContainers) {
        if (container.data.current?.type === 'folder' && container.rect.current) {
          const r = container.rect.current;
          if (topX >= r.left && topX <= r.right && topY >= r.top && topY <= r.bottom) {
            return [container];
          }
        }
      }
    }

    // 3. Final fallback
    return rectIntersection(args);
  }

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event
    setActiveId(active.id as string)

    if (active.data.current?.type === 'folder-item') {
      const folderId = active.data.current.folderId
      const folder = data.folders[folderId]
      if (folder) setActiveFolder({ id: folder.id, name: folder.name, color: folder.color })
      return
    }

    // Find the repo being dragged
    const repo = data.repositories[active.id as string]
    if (repo) {
      setActiveRepo(repo)
      setDraggedIds(active.data?.current?.selectedIds || [repo.id])
    }
  }

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    setActiveRepo(null)
    setDraggedIds([])
    setActiveFolder(null)

    if (over && over.data.current?.type === 'folder' && active.data.current?.type !== 'folder-item') {
      const folderId = over.data.current.folderId
      const repoId = active.id as string
      const idsToMove = active.data?.current?.selectedIds || [repoId]

      // Always clear selection when dropping onto a folder
      clearSelection()

      if (idsToMove.length > 1) {
        bulkMoveReposToFolder(idsToMove, folderId)
      } else {
        const currentFolderId = data.repositories[repoId]?.folder_id || null
        if (currentFolderId !== folderId) {
          moveRepoToFolder(repoId, folderId)
        }
      }
    }

    // --- Folder Reordering ---
    if (over && active.data.current?.type === 'folder-item' && over.data.current?.type === 'folder-item') {
      if (active.id !== over.id) {
        const folders = Object.values(data.folders || {}).sort((a, b) => {
          if (a.sort_order !== undefined && b.sort_order !== undefined) return a.sort_order - b.sort_order
          return a.name.localeCompare(b.name)
        })

        // id comes from sort-folder-${folder.id}
        const activeFolderId = String(active.id).replace('sort-folder-', '')
        const overFolderId = String(over.id).replace('sort-folder-', '')

        const oldIndex = folders.findIndex(f => f.id === activeFolderId)
        const newIndex = folders.findIndex(f => f.id === overFolderId)

        if (oldIndex !== -1 && newIndex !== -1) {
          const newFoldersArr = arrayMove(folders, oldIndex, newIndex)
          const newFoldersObj = { ...data.folders }
          newFoldersArr.forEach((f, idx) => {
            newFoldersObj[f.id] = { ...f, sort_order: idx + 1 }
          })

          const store = useStore.getState()
          store.setData({
            ...data,
            last_modified: Date.now(),
            folders: newFoldersObj
          })
        }
      }
    }
  }

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
    <DndContext
      sensors={sensors}
      collisionDetection={customCollisionDetection}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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

        {rateLimitRemaining !== null && rateLimitRemaining! <= 5 && (
          <div className="flex items-center justify-center gap-2 bg-[var(--color-warning)] text-[var(--color-bg)] px-4 py-1.5 text-xs font-medium z-50">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>API Rate limit is nearly exhausted ({rateLimitRemaining} remaining). Some features will be disabled.</span>
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
        <DragOverlay dropAnimation={null} modifiers={activeFolder ? [] : [snapTopLeftToCursor]}>
          {activeId && activeRepo ? (
            /* 
               We use snapTopLeftToCursor to force the FIRST badge's top-left
               to match the pointer position.
            */
            <div className="pointer-events-none flex flex-col gap-1.5 w-[280px]">
              {draggedIds.slice(0, 5).map((id, index) => {
                const r = data.repositories[id] || activeRepo
                const opacity = 1 - index * 0.2
                return (
                  <div
                    key={id}
                    className="shadow-2xl border rounded-xl p-3 flex flex-col gap-1"
                    style={{
                      opacity: opacity,
                      zIndex: 10 - index,
                      backgroundColor: 'rgba(30, 41, 59, 0.95)',
                      borderColor: 'rgba(59, 130, 246, 0.5)',
                      backdropFilter: 'blur(12px)',
                    }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Circular Icon */}
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {r.type === 'profile' ? (
                            r.profile_type === 'org' ? <Building2 className="h-4 w-4" /> : <User className="h-4 w-4" />
                        ) : <Book className="h-4 w-4" />}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] text-blue-400 font-bold leading-none mb-1">
                          {r.owner}
                        </span>
                        <span className="text-sm font-bold text-white leading-none truncate">
                          {r.name}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
              {draggedIds.length > 5 && (
                <div className="px-3 py-1 text-[10px] font-bold text-blue-400/60 uppercase tracking-widest text-center">
                  + {draggedIds.length - 5} more items
                </div>
              )}
            </div>
          ) : activeId && activeFolder ? (
            <div className="pointer-events-none shadow-2xl w-[220px]">
              <div
                className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium bg-[var(--color-surface-2)] text-[var(--color-text)] border border-[var(--color-accent)] opacity-90`}
                style={{ backdropFilter: 'blur(12px)' }}
              >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                      <FolderIcon
                          className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]"
                          style={activeFolder.color ? { color: activeFolder.color } : undefined}
                      />
                      <span className="truncate">{activeFolder.name}</span>
                  </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </DndContext>
  )
}

function App() {
  return <AppContent />
}

export default App
