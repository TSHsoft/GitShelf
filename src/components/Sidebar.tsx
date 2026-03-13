import { useState, useRef, useCallback } from 'react'
import { BookMarked, Cloud, PanelLeft, PanelLeftClose, Loader2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { SettingsModal } from './SettingsModal'
import { ManageTagDialog } from './ManageTagDialog'
import { AvatarMenu } from './AvatarMenu'
import { FolderList } from './FolderList'
import { useSignOut } from '@/hooks/useSignOut'

const COLLAPSED_KEY = 'gitshelf-sidebar-collapsed'

import { formatRelativeTime } from '@/lib/utils'

function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="relative group/tooltip flex">
            {children}
            <div className="pointer-events-none absolute left-full ml-2 top-1/2 -translate-y-1/2 z-[999] whitespace-nowrap rounded-md bg-[var(--color-surface)] border border-[var(--color-border)] px-2 py-1 text-xs font-medium text-[var(--color-text)] shadow-lg opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-150">
                {label}
            </div>
        </div>
    )
}

export function Sidebar() {
    const {
        theme, toggleTheme,
        lastGistSyncTime, gistSyncStatus,
        userProfile,
    } = useStore()

    const { signOut, signingOutStatus } = useSignOut()

    const [isCollapsed, setIsCollapsed] = useState(() => {
        return localStorage.getItem(COLLAPSED_KEY) === 'true'
    })
    const [showSettings, setShowSettings] = useState(false)
    const [showManageTags, setShowManageTags] = useState(false)
    const [showAvatarMenu, setShowAvatarMenu] = useState(false)

    const avatarBtnRef = useRef<HTMLButtonElement>(null)

    const toggleCollapse = useCallback(() => {
        setIsCollapsed(prev => {
            const next = !prev
            localStorage.setItem(COLLAPSED_KEY, String(next))
            return next
        })
    }, [])

    const initials = userProfile
        ? (userProfile.name || userProfile.login).slice(0, 2).toUpperCase()
        : '?'

    return (
        <>
            <aside
                className={`flex shrink-0 flex-col border-r border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 ease-in-out overflow-hidden
                    ${isCollapsed ? 'w-14' : 'w-56'}
                `}
            >
                {/* Logo + Collapse toggle */}
                {isCollapsed ? (
                    // Collapsed: logo by default, hover → shows toggle icon
                    <div className="group/hdr flex items-center justify-center border-b border-[var(--color-border)] h-[57px] shrink-0">
                        <button
                            onClick={toggleCollapse}
                            title="Open sidebar"
                            className="relative flex items-center justify-center w-9 h-9 rounded-lg cursor-ew-resize"
                        >
                            {/* Default: GitShelf logo */}
                            <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-150 group-hover/hdr:opacity-0">
                                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-accent)]">
                                    <BookMarked className="h-4 w-4 text-white" />
                                </div>
                            </div>
                            {/* Hover: PanelLeft icon */}
                            <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-150 opacity-0 group-hover/hdr:opacity-100 text-[var(--color-text-muted)] hover:text-[var(--color-text)]">
                                <PanelLeft className="h-5 w-5" />
                            </div>
                        </button>
                    </div>
                ) : (
                    // Expanded: logo + title + close toggle
                    <div className="flex items-center border-b border-[var(--color-border)] h-[57px] shrink-0 px-3 gap-2">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)]">
                                <BookMarked className="h-4 w-4 text-white" />
                            </div>
                            <span className="text-sm font-bold text-[var(--color-text)] tracking-tight whitespace-nowrap overflow-hidden">GitShelf</span>
                        </div>
                        <Tooltip label="Close sidebar">
                            <button
                                onClick={toggleCollapse}
                                title="Close sidebar"
                                className="flex items-center justify-center rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors cursor-ew-resize shrink-0"
                            >
                                <PanelLeftClose className="h-4 w-4" />
                            </button>
                        </Tooltip>
                    </div>
                )}

                {/* Nav */}
                <nav className="flex flex-col gap-0.5 p-2 flex-1 overflow-y-auto">
                    <FolderList isCollapsed={isCollapsed} />
                </nav>

                {/* Footer: Sync Status + Avatar */}
                <div className="border-t border-[var(--color-border)] p-2">
                    {/* Sync status - expanded only */}
                    {!isCollapsed && lastGistSyncTime && (
                        <div className="flex items-center gap-1.5 px-3 py-1 mb-0.5">
                            <Cloud className={`h-3 w-3 shrink-0 text-[var(--color-success)] ${gistSyncStatus === 'syncing' ? 'animate-pulse' : ''}`} />
                            <span className="text-[11px] font-medium text-[var(--color-success)] truncate">
                                Backed up {formatRelativeTime(lastGistSyncTime)}
                            </span>
                        </div>
                    )}

                    {/* Avatar Button */}
                    {isCollapsed ? (
                        <Tooltip label={userProfile?.name || userProfile?.login || 'Account'}>
                            <button
                                ref={avatarBtnRef}
                                onClick={() => setShowAvatarMenu(v => !v)}
                                className="relative flex w-full items-center justify-center rounded-lg p-1.5 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                            >
                                {userProfile?.avatarUrl ? (
                                    <img src={userProfile.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-[var(--color-border)]" />
                                ) : (
                                    <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
                                        <span className="text-xs font-bold text-[var(--color-accent)]">{initials}</span>
                                    </div>
                                )}
                                {/* Online dot */}
                                <span className="absolute bottom-1.5 right-1.5 w-2 h-2 rounded-full bg-[var(--color-success)] border-2 border-[var(--color-surface)]" />
                            </button>
                        </Tooltip>
                    ) : (
                        <button
                            ref={avatarBtnRef}
                            onClick={() => setShowAvatarMenu(v => !v)}
                            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-[var(--color-surface-2)] transition-colors cursor-pointer"
                        >
                            {userProfile?.avatarUrl ? (
                                <img src={userProfile.avatarUrl} alt="Avatar" className="w-7 h-7 rounded-full border border-[var(--color-border)] shrink-0" />
                            ) : (
                                <div className="w-7 h-7 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center shrink-0">
                                    <span className="text-xs font-bold text-[var(--color-accent)]">{initials}</span>
                                </div>
                            )}
                            <div className="flex flex-col min-w-0 text-left flex-1">
                                <span className="text-xs font-semibold text-[var(--color-text)] truncate">
                                    {userProfile?.name || userProfile?.login || 'GitHub User'}
                                </span>
                                {userProfile?.login && (
                                    <span className="text-[10px] text-[var(--color-text-muted)] truncate">@{userProfile.login}</span>
                                )}
                            </div>
                            <PanelLeft className="h-3.5 w-3.5 text-[var(--color-text-muted)] -rotate-90 shrink-0" />
                        </button>
                    )}
                </div>
            </aside>

            {/* Avatar Menu Popover */}
            {showAvatarMenu && (
                <AvatarMenu
                    anchorRef={avatarBtnRef}
                    userProfile={userProfile}
                    theme={theme}
                    onSettings={() => setShowSettings(true)}
                    onManageTags={() => setShowManageTags(true)}
                    onToggleTheme={toggleTheme}
                    onSignOut={() => {
                        setShowAvatarMenu(false)
                        signOut()
                    }}
                    onClose={() => setShowAvatarMenu(false)}
                    isSyncing={useStore.getState().isSyncing}
                />
            )}

            {/* Sign Out Overlay */}
            {signingOutStatus && (
                <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[var(--color-bg)]/90">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)] mb-4" />
                    <p className="text-sm font-medium text-[var(--color-text)]">{signingOutStatus}</p>
                </div>
            )}

            {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
            {showManageTags && <ManageTagDialog onClose={() => setShowManageTags(false)} />}
        </>
    )
}
