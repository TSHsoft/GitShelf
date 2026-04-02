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
import type { DragStartEvent, DragEndEvent, DragOverEvent } from '@dnd-kit/core'
import { useShallow } from 'zustand/react/shallow'
import type { GitShelfStore } from '@/store/types'
import type { Repository, Folder } from '@/types'
import { RepositorySchema } from '@/types'
import { useDeviceMode } from '@/hooks/useDeviceMode'
import { MobileShareAction } from '@/components/mobile/MobileShareAction'
import { MobileReadonlyViewer } from '@/components/mobile/MobileReadonlyViewer'
import { PendingInbox } from '@/components/PendingInbox'

declare global {
    interface Window {
        __GitShelfCheckRepo__?: (id: string) => boolean;
        __GitShelfSaveRepo__?: (repo: Repository) => { success: boolean };
        __GitShelfSaveRepoPath__?: (path: string) => { success: boolean };
    }
}

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

// Smart snap: Center the cursor only for repositories (small icons), 
// keep relative offset for folders to prevent "jumping" lag.
// We offset the repo icon by +8px to the bottom-right so the cursor tip 
// is never covered, allowing CSS :hover to work perfectly on targets.
const smartSnap: Modifier = ({ transform, activatorEvent, activeNodeRect, active }) => {
    if (active?.data.current?.type === 'repository' && activatorEvent && activeNodeRect) {
        const isTouch = 'touches' in activatorEvent;
        const p = isTouch ? (activatorEvent as TouchEvent).touches[0] : (activatorEvent as MouseEvent);
        
        return {
            ...transform,
            x: transform.x + (p.clientX - activeNodeRect.left) + 8,
            y: transform.y + (p.clientY - activeNodeRect.top) + 8,
        };
    }
    return transform;
};

function AppContent() {
    const { isMobile } = useDeviceMode()
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
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
    )

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

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event
        if (!over) return

        const activeType = active.data.current?.type
        const overType = over.data.current?.type

        // Live sorting for folders
        if (activeType === 'folder-item' && (overType === 'folder-item' || overType === 'folder')) {
            const activeFolderId = active.data.current?.folderId
            const overFolderId = over.data.current?.folderId

            if (activeFolderId && overFolderId && activeFolderId !== overFolderId) {
                const folders = Object.values(data.folders || {}).sort((a: Folder, b: Folder) => {
                    if (a.sort_order !== undefined && b.sort_order !== undefined) return a.sort_order - b.sort_order
                    return a.name.localeCompare(b.name)
                })

                const oldIndex = folders.findIndex((f: Folder) => f.id === activeFolderId)
                const newIndex = folders.findIndex((f: Folder) => f.id === overFolderId)

                if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
                    const newFoldersArr = arrayMove(folders, oldIndex, newIndex)
                    const newFoldersObj = { ...data.folders }
                    newFoldersArr.forEach((f: Folder, idx: number) => {
                        newFoldersObj[f.id] = { ...f, sort_order: idx + 1 }
                    })
                    
                    // Update store immediately for live animation
                    useStore.getState().setData({
                        ...data,
                        folders: newFoldersObj
                    })
                }
            }
        }
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event
        
        setActiveId(null)
        setActiveRepo(null)
        setDraggedIds([])
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
        
        // Final save with timestamp on drag end
        if (active.data.current?.type === 'folder-item') {
            useStore.getState().setData({
                ...useStore.getState().data,
                last_modified: Date.now()
            })
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

    // Try to pop the remote pending_repos queue into our local queue
    useEffect(() => {
        const fetchRemoteInbox = async () => {
            if (githubToken && patStatus !== 'invalid' && isLoaded && isOnline) {
                try {
                    const { getGistFile } = await import('@/lib/github/gists')
                    const token = await useStore.getState().getDecryptedToken()
                    if (token) {
                        const remoteStr = await getGistFile(token, 'gitshelf_pending.json')
                        if (remoteStr) {
                            const remoteRepos = JSON.parse(remoteStr)
                            if (Array.isArray(remoteRepos)) {
                                // Overwrite local queue with the definitive remote master queue
                                useStore.setState(state => ({
                                    data: { ...state.data, pending_repos: remoteRepos }
                                }))
                            }
                        }
                    }
                } catch (e) { 
                    console.error('Failed to sync remote inbox', e) 
                }
            }
        }
        fetchRemoteInbox()
    }, [githubToken, patStatus, isLoaded, isOnline])

    // Extension Integration: Proactively push auth data when ready
    useEffect(() => {
        const getAuth = async () => {
            const storedId = localStorage.getItem('_gs_pk_id');
            if (githubToken && !githubToken.startsWith('enc_')) {
                return { githubToken, userProfile };
            }
            if (githubToken && githubToken.startsWith('enc_')) {
                const decrypted = await decryptTokenAsync(githubToken, storedId || undefined);
                return { githubToken: decrypted, userProfile };
            }
            return null;
        };

        const handleExtensionMessage = (event: MessageEvent) => {
            const { type } = event.data;
            if (type === 'EXT_REQUEST_AUTH' || type === 'EXT_AUTH_REQUEST') {
                getAuth().then(auth => {
                    if (auth) window.postMessage({ type: 'EXT_AUTH_DATA', payload: auth }, '*');
                });
            }

            if (type === 'EXT_SAVE_REPO') {
                try {
                    const parsed = RepositorySchema.parse(event.data.payload);
                    useStore.getState().addRepository(parsed);
                    window.postMessage({ type: 'EXT_SAVE_SUCCESS' }, '*');
                } catch (err) {
                    console.error("Extension save validation failed:", err);
                }
            }

            if (type === 'EXT_SAVE_BY_PATH') {
                const { path } = event.data.payload;
                const handleAsyncSave = async () => {
                    try {
                        const { fetchRepositoryGraphQL } = await import('@/lib/github');
                        const token = await useStore.getState().getDecryptedToken();
                        const repo = await fetchRepositoryGraphQL(path, token);
                        useStore.getState().addRepository(repo);
                        window.postMessage({ type: 'EXT_SAVE_SUCCESS' }, '*');
                    } catch (err) {
                        console.error("Extension path-based save failed:", err);
                        window.postMessage({ type: 'EXT_SAVE_FAILURE', error: String(err) }, '*');
                    }
                };
                
                handleAsyncSave();
            }
        };

        // Cross-tab sync listener
        const bc = new BroadcastChannel('gitshelf-sync');
        bc.onmessage = async (event) => {
            if (event.data.type === 'DATA_UPDATED') {
                console.log('[App] Received cross-tab data update signal');
                const { loadLocalData } = await import('@/lib/db');
                const stored = await loadLocalData();
                if (stored) {
                    useStore.getState().setData(stored);
                }
            }
        };

        window.addEventListener('message', handleExtensionMessage);
        
        // Push current auth if already decrypted
        if (githubToken && !githubToken.startsWith('enc_')) {
            window.postMessage({ type: 'EXT_AUTH_DATA', payload: { githubToken, userProfile } }, '*');
        }
        
        // Expose helper for the Extension (background.js can use this for live check)
        window.__GitShelfCheckRepo__ = (id: string) => {
            const repositories = useStore.getState().data.repositories;
            return !!repositories[id] || Object.values(repositories).some((r: Repository) => r.id === id);
        };

        window.__GitShelfSaveRepo__ = (repo: Repository) => {
            try {
                const parsed = RepositorySchema.parse(repo);
                useStore.getState().addRepository(parsed);
                return { success: true };
            } catch (err) {
                console.error("Extension save via helper failed:", err);
                return { success: false };
            }
        };

        window.__GitShelfSaveRepoPath__ = (path: string) => {
            console.log('[App] Extension called __GitShelfSaveRepoPath__:', path);
            const handleAsync = async () => {
                try {
                    const { fetchRepositoryGraphQL } = await import('@/lib/github');
                    const token = await useStore.getState().getDecryptedToken();
                    const repo = await fetchRepositoryGraphQL(path, token);
                    useStore.getState().addRepository(repo);
                    window.postMessage({ type: 'EXT_SAVE_SUCCESS' }, '*');
                } catch (err) {
                    console.error("Extension path-based save via helper failed:", err);
                    window.postMessage({ type: 'EXT_SAVE_FAILURE', error: String(err) }, '*');
                }
            };
            handleAsync();
            return { success: true };
        };

        // Signal we are ready
        window.postMessage({ type: 'APP_READY' }, '*');
        
        return () => {
            window.removeEventListener('message', handleExtensionMessage);
            bc.close();
            delete window.__GitShelfCheckRepo__;
            delete window.__GitShelfSaveRepo__;
            delete window.__GitShelfSaveRepoPath__;
        };
    }, [githubToken, userProfile]);

    if (window.location.pathname.includes('/share')) {
        return <MobileShareAction />
    }

    if (window.location.search.includes('code=')) return <AuthCallback />
    if (!githubToken) return <LoginPage />
    if (!isLoaded) return <LoadingScreen />

    if (isMobile) {
        return <MobileReadonlyViewer />
    }

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            autoScroll={false}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
        >
            <div className="flex h-screen overflow-hidden bg-[var(--color-bg)] flex-col">
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
                        <PendingInbox />
                        <ErrorBoundary isFullPage={false}>
                            <MemoizedRepoList />
                        </ErrorBoundary>
                    </main>
                </div>
                <DragOverlay dropAnimation={null} modifiers={[smartSnap]}>
                    {activeId && activeRepo ? (
                        <div className="pointer-events-none">
                            <div className="relative h-10 w-10">
                                <img 
                                    src="/favicon.svg" 
                                    alt="drag icon" 
                                    className="h-full w-full drop-shadow-md"
                                />
                                {draggedIds.length > 1 && (
                                    <div className="absolute -top-1.5 -right-1.5 flex h-4.5 w-4.5 min-w-[18px] min-h-[18px] items-center justify-center rounded-full bg-red-600 text-white text-[10px] font-bold shadow-md z-10">
                                        {draggedIds.length}
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : activeId && activeFolder ? (
                        <div className="pointer-events-none w-[208px] shadow-xl">
                            <div className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium bg-[var(--color-surface-2)] border border-[var(--color-accent)] text-[var(--color-text)]">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                    <FolderIcon
                                        className="h-4 w-4 shrink-0 text-[var(--color-accent)]"
                                        style={activeFolder.color ? { color: activeFolder.color } : undefined}
                                    />
                                    <span className="truncate">{activeFolder.name}</span>
                                </div>
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
