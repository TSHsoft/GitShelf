import { useState, useEffect } from 'react'
import { X, Settings, KeyRound, Loader2, Cloud, CloudOff, RefreshCw } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { decryptTokenAsync } from '@/lib/crypto'
import { getGistBackup } from '@/lib/github'
import { GitShelfDataSchema, type GitShelfData } from '@/types'
import { useGistSync } from '@/hooks/useGistSync'
import { useGithubRateLimit } from '@/hooks/useGithubRateLimit'
import { CustomSelect } from './CustomSelect'
import { ImportExport } from './ImportExport'
import { ConfirmDialog } from './ConfirmDialog'
import { useSignOut } from '@/hooks/useSignOut'
import { formatRelativeTime } from '@/lib/utils'
export function SettingsModal({ onClose }: { onClose: () => void }) {
    const {
        data, updateSettings, importData,
        gistSyncStatus, lastGistSyncTime, gistSyncError,
        githubToken,
        userProfile,
    } = useStore()

    const { manualBackup } = useGistSync()
    const { signOut, signingOutStatus } = useSignOut()
    const [isBackingUp, setIsBackingUp] = useState(false)
    // Restore from Gist state
    const [lastCheckedGist, setLastCheckedGist] = useState<{ date: number, repoCount: number, data: GitShelfData } | 'none' | null>(null)
    const [isCheckingGistManual, setIsCheckingGistManual] = useState(false)
    const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)
    const [isRestoring, setIsRestoring] = useState(false)

    const { rateLimitRemaining, isRateLimited } = useGithubRateLimit()

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [onClose])

    const GITHUB_CLIENT_ID = 'Ov23liXZLUIQvalM7uiC'

    const handleLogin = () => {
        const SCOPE = 'gist read:user'
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=${encodeURIComponent(SCOPE)}`
    }

    const handleLogout = () => signOut()

    const handleManualBackup = async () => {
        setIsBackingUp(true)
        try {
            await manualBackup()
        } catch {
            // Already handled in hook
        } finally {
            setIsBackingUp(false)
        }
    }

    const handleCheckGist = async () => {
        if (!githubToken) return
        const t = await decryptTokenAsync(githubToken)
        setIsCheckingGistManual(true)
        setLastCheckedGist(null)
        try {
            const backup = await getGistBackup(t)
            if (backup) {
                const parsed = GitShelfDataSchema.safeParse(JSON.parse(backup.content))
                if (parsed.success && Object.keys(parsed.data.repositories).length > 0) {
                    setLastCheckedGist({
                        date: parsed.data.last_modified,
                        repoCount: Object.keys(parsed.data.repositories).length,
                        data: parsed.data
                    })
                } else {
                    setLastCheckedGist('none')
                }
            } else {
                setLastCheckedGist('none')
            }
        } catch (err) {
            console.error('Failed to check Gist backup:', err)
            setLastCheckedGist('none')
        } finally {
            setIsCheckingGistManual(false)
        }
    }

    const handleRestoreGist = async () => {
        if (!lastCheckedGist || lastCheckedGist === 'none' || !lastCheckedGist.data) return
        setIsRestoring(true)
        try {
            importData(lastCheckedGist.data)
            setShowRestoreConfirm(false)
            setLastCheckedGist(null)
        } catch (err) {
            console.error('Failed to restore:', err)
        } finally {
            setIsRestoring(false)
        }
    }



    return (
        <>
            {signingOutStatus && (
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--color-bg)]/90">
                    <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)] mb-4" />
                    <p className="text-sm font-medium text-[var(--color-text)]">{signingOutStatus}</p>
                </div>
            )}
            <div
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
            >
                <div
                    className="w-full max-w-lg max-h-[90vh] flex flex-col rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] shrink-0">
                        <div className="flex items-center gap-2.5">
                            <Settings className="h-4 w-4 text-[var(--color-text-muted)]" />
                            <h2 className="text-base font-semibold text-[var(--color-text)]">Settings</h2>
                        </div>
                        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    <div className="p-6 flex flex-col gap-6 overflow-y-auto">
                        {/* Account & Sync */}
                        <div>
                            <div className="flex items-center gap-2 mb-3">
                                <Cloud className="h-4 w-4 text-[var(--color-accent)]" />
                                <h3 className="text-sm font-medium text-[var(--color-text)]">GitHub Gist Backup</h3>
                            </div>

                            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5">
                                {/* Top Row: Sync Status & Check Status */}
                                <div className="flex items-center justify-between mb-4">
                                    {/* Left: Auto Backup Status */}
                                    <div className="flex items-center gap-2">
                                        {gistSyncStatus === 'syncing' && (
                                            <span className="flex items-center gap-1.5 text-xs text-[var(--color-accent)] animate-pulse">
                                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                                                Syncing to GitHub Gist...
                                            </span>
                                        )}
                                        {gistSyncStatus === 'success' && (
                                            <span className="flex items-center gap-1.5 text-xs text-[var(--color-success)]">
                                                <Cloud className="h-3.5 w-3.5" />
                                                Saved to Gist <span className="text-[var(--color-success)]/80">· {formatRelativeTime(lastGistSyncTime)}</span>
                                            </span>
                                        )}
                                        {gistSyncStatus === 'error' && (
                                            <span className="flex items-center gap-1.5 text-xs text-[var(--color-danger)]" title={gistSyncError ?? undefined}>
                                                <CloudOff className="h-3.5 w-3.5" />
                                                Sync failed · {gistSyncError?.slice(0, 40)}
                                            </span>
                                        )}
                                        {gistSyncStatus === 'idle' && (
                                            <span className="flex items-center gap-1.5 text-xs text-[var(--color-text-muted)]">
                                                <Cloud className="h-3.5 w-3.5" />
                                                {lastGistSyncTime ? `Last sync: ${formatRelativeTime(lastGistSyncTime)}` : 'Not synced yet'}
                                            </span>
                                        )}
                                    </div>

                                    {/* Right: Manual Check Status */}
                                    <div className="text-xs text-[var(--color-text-muted)] flex items-center justify-end text-right">
                                        {isCheckingGistManual && <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking...</span>}
                                        {!isCheckingGistManual && lastCheckedGist === 'none' && <span className="flex items-center gap-1.5"><Cloud className="h-3.5 w-3.5" /> No backup found.</span>}
                                        {!isCheckingGistManual && lastCheckedGist !== 'none' && lastCheckedGist !== null && (
                                            <span className="flex items-center gap-1.5 text-[var(--color-warning)]">
                                                <Cloud className="h-3.5 w-3.5" />
                                                Found: <span className="text-[var(--color-warning)]/80 ml-0.5">
                                                    {new Date(lastCheckedGist.date).toLocaleDateString('en-GB')} {new Date(lastCheckedGist.date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }).toLowerCase()}
                                                </span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Bottom Row: Actions & Interval Row */}
                                <div className="flex flex-col gap-1.5">
                                    {/* Label for Interval */}
                                    <div className="w-[124px]">
                                        <span className="text-xs font-medium text-[var(--color-text)] block">
                                            Auto Backup Interval
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-3 mt-1">
                                        <CustomSelect
                                            value={String(data.settings.backup_interval_minutes ?? 0)}
                                            onChange={(val) => updateSettings({ backup_interval_minutes: Number(val ?? 0) })}
                                            options={[
                                                { value: '0', label: 'Off' },
                                                { value: '5', label: '5 minutes' },
                                                { value: '10', label: '10 minutes' },
                                                { value: '15', label: '15 minutes' },
                                                { value: '20', label: '20 minutes' },
                                                { value: '25', label: '25 minutes' },
                                                { value: '30', label: '30 minutes' },
                                            ]}
                                            searchable={false}
                                            clearable={false}
                                            className="w-[124px]"
                                            disabled={useStore.getState().isSyncing}
                                        />

                                        {/* Action Buttons */}
                                        <button
                                            type="button"
                                            onClick={handleManualBackup}
                                            disabled={isBackingUp || gistSyncStatus === 'syncing' || !githubToken || useStore.getState().isSyncing}
                                            title={!githubToken ? "GitHub account connection required" : useStore.getState().isSyncing ? "Backup unavailable during global sync" : "Backup to Gist"}
                                            className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:shadow-[var(--color-accent)]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-[80px]"
                                        >
                                            Backup
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleCheckGist}
                                            disabled={isCheckingGistManual || !githubToken || useStore.getState().isSyncing}
                                            title={useStore.getState().isSyncing ? "Checking unavailable during global sync" : "Check for Gist backup"}
                                            className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:shadow-[var(--color-accent)]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed w-[80px]"
                                        >
                                            Check
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setShowRestoreConfirm(true)}
                                            disabled={!githubToken || !lastCheckedGist || lastCheckedGist === 'none' || isRestoring || useStore.getState().isSyncing}
                                            title={useStore.getState().isSyncing ? "Restore unavailable during global sync" : "Restore from Gist"}
                                            className="shrink-0 flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-warning)] text-[var(--color-bg)] px-3.5 py-1.5 text-xs font-semibold transition-all hover:bg-[var(--color-warning)]/90 hover:shadow-lg hover:shadow-[var(--color-warning)]/20 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isRestoring && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                                            Restore to Local
                                        </button>
                                    </div>
                                </div>
                            </div>

                        </div>

                        <div className="h-px bg-[var(--color-border)]" />

                        {/* GitHub Token */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="flex items-center gap-2 text-sm font-medium text-[var(--color-text)]">
                                    <KeyRound className="h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                                    GitHub Account & Sync
                                </label>

                                <div className="flex items-center gap-2">
                                    {githubToken && rateLimitRemaining !== null && (
                                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wider uppercase border ${isRateLimited ? 'bg-[var(--color-danger)]/10 text-[var(--color-danger)] border-[var(--color-danger)]/20' : 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-[var(--color-accent)]/20'}`}>
                                            API Quota: {rateLimitRemaining.toLocaleString()}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <p className="text-xs text-[var(--color-text-muted)] mb-4">
                                Connect your GitHub account to enable automatic backups via Gist and increase your API rate limit for fetching repositories.
                            </p>

                            <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 flex items-center justify-between">
                                {githubToken ? (
                                    <div className="flex items-center gap-3">
                                        {userProfile ? (
                                            <>
                                                <img src={userProfile.avatarUrl} alt="Avatar" className="w-10 h-10 rounded-full border border-[var(--color-border)]" />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-semibold text-[var(--color-text)]">{userProfile.name || userProfile.login}</span>
                                                    <span className="text-xs text-[var(--color-text-muted)]">@{userProfile.login}</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <div className="w-10 h-10 rounded-full bg-[var(--color-bg)] flex items-center justify-center animate-pulse">
                                                    <Loader2 className="h-5 w-5 text-[var(--color-text-muted)] animate-spin" />
                                                </div>
                                                <span className="text-sm text-[var(--color-text-muted)]">Loading profile...</span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-sm text-[var(--color-text-muted)]">
                                        Not connected to GitHub
                                    </div>
                                )}

                                <div>
                                    {githubToken ? (
                                        <button
                                            type="button"
                                            onClick={handleLogout}
                                            disabled={useStore.getState().isSyncing}
                                            title={useStore.getState().isSyncing ? "Cannot sign out during global sync" : "Sign Out"}
                                            className="flex items-center justify-center rounded-lg bg-[var(--color-bg)] border border-[var(--color-border)] px-4 py-2 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            Sign Out
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleLogin}
                                            className="flex items-center justify-center rounded-lg bg-[#24292e] hover:bg-[#2b3137] text-white px-5 py-2 text-sm font-medium transition-colors gap-2"
                                        >
                                            <svg height="16" aria-hidden="true" viewBox="0 0 16 16" version="1.1" width="16" data-view-component="true" className="fill-current">
                                                <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"></path>
                                            </svg>
                                            Sign in with GitHub
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="h-px bg-[var(--color-border)]" />

                        {/* Data Management */}
                        <div>
                            <h3 className="text-sm font-medium text-[var(--color-text)] mb-1">Data Tools</h3>
                            <p className="text-xs text-[var(--color-text-muted)] mb-3">
                                Export your shelf as JSON backup, or import from bookmarks/backups.
                            </p>
                            <ImportExport />
                        </div>
                    </div>
                </div>

                {showRestoreConfirm && (
                    <ConfirmDialog
                        isOpen={showRestoreConfirm}
                        title="Restore Database"
                        description={<>Are you sure you want to restore the database from Gist? This will <strong>overwrite</strong> your current local data and settings.<br/><br/>This action cannot be undone.</>}
                        variant="warning"
                        confirmLabel={isRestoring ? "Restoring..." : "Restore"}
                        onConfirm={handleRestoreGist}
                        onClose={() => setShowRestoreConfirm(false)}
                    />
                )}
            </div >
            )
        </>
    )
}
