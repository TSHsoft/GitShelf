import React, { useEffect, useState } from 'react'
import './index.css'
import { useStore } from '@/store/useStore'
import { Sidebar } from '@/components/Sidebar'
import { RepoList } from '@/components/RepoList'
import { AlertTriangle, WifiOff, Book, Folder as FolderIcon } from 'lucide-react'
import { SettingsModal } from '@/components/SettingsModal'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useGithubRateLimit } from '@/hooks/useGithubRateLimit'
import { Toaster } from 'sonner'
import { useLocalPersistence, useAutoSave } from '@/hooks/useGistSync'
import { LoginPage } from '@/components/LoginPage'
import { AuthCallback } from '@/components/AuthCallback'
import { fetchAuthenticatedUserProfile } from '@/lib/github'
import { decryptTokenAsync } from '@/lib/crypto'
import { DndContext, DragOverlay, pointerWithin, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import type { Modifier } from '@dnd-kit/core'
import type { DragStartEvent, DragEndEvent, DragMoveEvent } from '@dnd-kit/core'
import { useShallow } from 'zustand/react/shallow'
import type { GitShelfStore } from '@/store/types'
import type { Repository, Folder } from '@/types'

function LoadingScreen() {
    return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-[var(--color-bg)] gap-6">
            <div className="relative">
                <div className="absolute inset-0 rounded-full bg-blue-500/20 blur-2xl animate-pulse"></div>
                <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-[var(--color-surface-2)] border border-blue-500/30 shadow-2xl">
                    <Book className="h-10 w-10 text-blue-500 animate-bounce" />
                </div>
            </div>
            <div className="flex flex-col items-center gap-2">
                <h1 className="text-xl font-bold text-[var(--color-text)] tracking-tight">GitShelf</h1>
                <div className="flex items-center gap-2 text-[var(--color-text-muted)] text-sm">
                    <div className="h-1 w-1 rounded-full bg-blue-500 animate-ping"></div>
                    <span>Preparing your workstation...</span>
                </div>
            </div>
        </div>
    )
}

const MemoizedSidebar = React.memo(Sidebar)
const MemoizedRepoList = React.memo(RepoList)

const snapTopLeftToCursor: Modifier = ({ transform, activatorEvent, activeNodeRect }) => {
    if (activatorEvent && activeNodeRect) {
        const isTouch = 'touches' in activatorEvent;
        const p = isTouch ? (activatorEvent as TouchEvent).touches[0] : (activatorEvent as MouseEvent);
        
        // Center the 48px (h-12) logo under the cursor
        return {
            ...transform,
            x: transform.x + (p.clientX - activeNodeRect.left) - 24,
            y: transform.y + (p.clientY - activeNodeRect.top) - 24,
        };
    }
    return transform;
};

function AppContent() {
    const {
        data, theme, patStatus, isOnline, setIsOnline, githubToken,
        userProfile, setUserProfile, moveRepoToFolder, bulkMoveReposToFolder,
        rateLimitRemaining, isLoaded, clearSelection
    } = useStore(useShallow((state: GitShelfStore) => ({
        data: state.data,
        theme: state.theme,
        patStatus: state.patStatus,
        isOnline: state.isOnline,
        setIsOnline: state.setIsOnline,
        githubToken: state.githubToken,
        userProfile: state.userProfile,
        setUserProfile: state.setUserProfile,
        moveRepoToFolder: state.moveRepoToFolder,
        bulkMoveReposToFolder: state.bulkMoveReposToFolder,
        rateLimitRemaining: state.rateLimitRemaining,
        isLoaded: state.isLoaded,
        clearSelection: state.clearSelection
    })))

    const { scheduleSave } = useAutoSave()
    const [showSettings, setShowSettings] = useState(false)

    // Drag state
    const [activeId, setActiveId] = useState<string | null>(null)
    const [activeRepo, setActiveRepo] = useState<Repository | null>(null)
    const [draggedIds, setDraggedIds] = useState<string[]>([])
    const [activeFolder, setActiveFolder] = useState<{ id: string, name: string, color?: string } | null>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
    )

    // Track last over ID and element to prevent redundant DOM operations
    const lastOverId = React.useRef<string | null>(null)
    const lastOverFolderEl = React.useRef<Element | null>(null)

    const handleDragMove = (event: DragMoveEvent) => {
        const overId = event.over?.id as string | undefined

        if (lastOverId.current === overId) return;
        
        // Clear previous highlight
        if (lastOverFolderEl.current) {
            lastOverFolderEl.current.removeAttribute('data-over')
            lastOverFolderEl.current = null
        }

        lastOverId.current = overId ?? null;

        // Apply new highlight if over a folder
        if (overId && typeof overId === 'string' && overId.startsWith('folder-')) {
            const folderEl = document.getElementById(overId)
            if (folderEl) {
                folderEl.setAttribute('data-over', 'true')
                lastOverFolderEl.current = folderEl
            }
        }
    }

    const clearFolderHighlight = () => {
        if (lastOverFolderEl.current) {
            lastOverFolderEl.current.removeAttribute('data-over')
            lastOverFolderEl.current = null
        }
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
        
        const repo = data.repositories[active.id as string]
        if (repo) {
            setActiveRepo(repo)
            setDraggedIds(active.data?.current?.selectedIds || [repo.id])
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        
        clearFolderHighlight()
        setActiveId(null)
        setActiveRepo(null)
        setDraggedIds([])
        lastOverId.current = null
        setActiveFolder(null)

        if (!over) return;

        if (over.data.current?.type === 'folder' && active.data.current?.type === 'repository') {
            const folderId = over.data.current.folderId
            const repoId = active.id as string
            const idsToMove = active.data?.current?.selectedIds || [repoId]
            
            if (idsToMove.length > 1) {
                bulkMoveReposToFolder(idsToMove, folderId)
            } else {
                moveRepoToFolder(repoId, folderId)
            }
            clearSelection()
        }

        if (active.data.current?.type === 'folder-item' && over.data.current?.type === 'folder-item') {
            if (active.id !== over.id) {
                const folders = Object.values(data.folders || {}).sort((a: Folder, b: Folder) => {
                    if (a.sort_order !== undefined && b.sort_order !== undefined) return a.sort_order - b.sort_order
                    return a.name.localeCompare(b.name)
                })
                
                const activeFolderId = String(active.id).replace('sort-folder-', '')
                const overFolderId = String(over.id).replace('sort-folder-', '')
                const oldIndex = folders.findIndex((f: Folder) => f.id === activeFolderId)
                const newIndex = folders.findIndex((f: Folder) => f.id === overFolderId)

                if (oldIndex !== -1 && newIndex !== -1) {
                    const newFoldersArr = arrayMove(folders, oldIndex, newIndex)
                    const newFoldersObj = { ...data.folders }
                    newFoldersArr.forEach((f: Folder, idx: number) => {
                        newFoldersObj[f.id] = { ...f, sort_order: idx + 1 }
                    })
                    useStore.getState().setData({
                        ...data,
                        last_modified: Date.now(),
                        folders: newFoldersObj
                    })
                }
            }
        }
    }

    useLocalPersistence()
    useGithubRateLimit()

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme)
    }, [theme])

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

    useEffect(() => {
        if (isLoaded) scheduleSave(data)
    }, [data, isLoaded, scheduleSave])

    useEffect(() => {
        if (githubToken && patStatus !== 'invalid' && !userProfile && isOnline) {
            const storedId = localStorage.getItem('_gs_pk_id');
            decryptTokenAsync(githubToken, storedId || undefined).then(decrypted => {
                return fetchAuthenticatedUserProfile(decrypted)
            }).then(profile => {
                if (profile) setUserProfile(profile)
            }).catch(err => console.error("Could not fetch user profile on load:", err))
        }
    }, [githubToken, patStatus, userProfile, isOnline, setUserProfile])

    if (window.location.search.includes('code=')) return <AuthCallback />
    if (!githubToken) return <LoginPage />
    if (!isLoaded) return <LoadingScreen />

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            autoScroll={false}
            onDragStart={handleDragStart}
            onDragMove={handleDragMove}
            onDragEnd={handleDragEnd}
        >
            <div className={`flex h-screen overflow-hidden bg-[var(--color-bg)] flex-col ${activeId ? 'is-dragging' : ''}`}>
                <Toaster position="bottom-right" theme={theme as 'light' | 'dark' | 'system'} richColors />
                {!isOnline && (
                    <div className="flex items-center justify-center gap-2 bg-[var(--color-warning)] text-[var(--color-bg)] px-4 py-1.5 text-xs font-medium z-50 text-black">
                        <WifiOff className="h-3.5 w-3.5" />
                        <span>You are offline. Changes are saved locally.</span>
                    </div>
                )}
                {patStatus === 'invalid' && (
                    <div className="flex items-center justify-center gap-2 bg-[var(--color-danger)] text-white px-4 py-2 text-sm font-medium z-50">
                        <AlertTriangle className="h-4 w-4" />
                        <span>GitHub Token invalid.</span>
                        <button onClick={() => setShowSettings(true)} className="ml-4 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-md">Update Token</button>
                    </div>
                )}
                {rateLimitRemaining !== null && rateLimitRemaining! <= 5 && (
                    <div className="flex items-center justify-center gap-2 bg-[var(--color-warning)] text-[var(--color-bg)] px-4 py-1.5 text-xs font-medium z-50 text-black">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        <span>Rate limit low ({rateLimitRemaining}).</span>
                    </div>
                )}
                <div className="flex flex-1 min-h-0 overflow-hidden">
                    <MemoizedSidebar />
                    <main className={`flex flex-1 flex-col min-w-0 relative ${activeId ? 'pointer-events-none select-none' : ''}`}>
                        <ErrorBoundary isFullPage={false}>
                            <MemoizedRepoList />
                        </ErrorBoundary>
                    </main>
                </div>
                <DragOverlay dropAnimation={null} modifiers={[snapTopLeftToCursor]}>
                    {activeId && activeRepo ? (
                        <div className="pointer-events-none">
                            <div
                                className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-blue-500 border-2 border-white/20"
                                style={{
                                    willChange: 'transform',
                                    transform: 'translateZ(0)',
                                    boxShadow: '0 8px 30px rgba(0,0,0,0.3)' 
                                }}
                            >
                                <Book className="h-6 w-6 text-white" />
                                
                                {draggedIds.length > 1 && (
                                    <div className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-bold border-2 border-[var(--color-bg)] shadow-md animate-fade-in">
                                        {draggedIds.length}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeId && activeFolder ? (
                        <div className="pointer-events-none shadow-2xl w-[220px]">
                            <div className="flex items-center gap-2 px-3 py-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg">
                                <FolderIcon className="h-4 w-4 text-blue-500" />
                                <span className="text-sm font-medium truncate">{activeFolder.name}</span>
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
                {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            </div>
        </DndContext>
    )
}

export default function App() {
    return (
        <ErrorBoundary isFullPage={true}>
            <AppContent />
        </ErrorBoundary>
    )
}
