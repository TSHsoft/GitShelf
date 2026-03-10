import { useEffect, useRef, useState } from 'react'
import { AlertCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { syncAll } from '@/lib/github'
import { decryptTokenAsync } from '@/lib/crypto'
import { useGithubRateLimit } from '@/hooks/useGithubRateLimit'

import { formatRelativeTime } from '@/lib/utils'

export function SyncButton() {
    const {
        data, setRepositories, isSyncing, setIsSyncing,
        syncProgress, setSyncProgress, isOnline, githubToken,
        abortSync, lastSyncTime,
    } = useStore()
    const [syncError, setSyncError] = useState<string | null>(null)
    const { isRateLimited } = useGithubRateLimit()
    const [displayPct, setDisplayPct] = useState(0)

    // For auto-refreshing the "X ago" label
    const [, forceUpdate] = useState(0)
    useEffect(() => {
        if (!lastSyncTime) return
        const interval = setInterval(() => forceUpdate(n => n + 1), 30_000)
        return () => clearInterval(interval)
    }, [lastSyncTime])

    // Smooth percentage interpolation
    const realPct = syncProgress
        ? Math.round((syncProgress.done / syncProgress.total) * 100)
        : 0

    useEffect(() => {
        if (!isSyncing) {
            setDisplayPct(0)
            return
        }
        if (displayPct < realPct) {
            const timer = setInterval(() => {
                setDisplayPct(prev => {
                    const next = prev + 1
                    if (next >= realPct) {
                        clearInterval(timer)
                        return realPct
                    }
                    return next
                })
            }, 10) // 100 units per second
            return () => clearInterval(timer)
        }
    }, [realPct, displayPct, isSyncing])

    // Keep an abort controller ref to pass into syncAll
    const abortControllerRef = useRef<AbortController | null>(null)

    const handleSync = async () => {
        if (isSyncing || !isOnline || isRateLimited) return

        const repos = Object.values(data.repositories).filter((r) => r.status !== 'deleted')
        if (repos.length === 0) return

        setSyncError(null)
        setIsSyncing(true)
        setSyncProgress({ done: 0, total: repos.length })

        const controller = new AbortController()
        abortControllerRef.current = controller

        try {
            const token = githubToken ? await decryptTokenAsync(githubToken) : undefined
            const { repos: updated, migrations } = await syncAll(
                data.repositories,
                token,
                (done, total) => setSyncProgress({ done, total }),
                controller.signal
            )

            if (!controller.signal.aborted) {
                setRepositories(updated)

                // Persist last sync time into both data (DB) and sync slice (UI)
                const now = Date.now()
                useStore.setState((s) => ({
                    data: { ...s.data, last_sync_time: now },
                    lastSyncTime: now,
                }))

                // Migrate activeRepoId if it was renamed/case-changed
                const activeId = useStore.getState().activeRepoId
                if (activeId && migrations[activeId]) {
                    useStore.getState().setActiveRepoId(migrations[activeId])
                }
            }
        } catch {
            if (!controller.signal.aborted) {
                setSyncError('Sync failed — check your token')
            }
        } finally {
            abortControllerRef.current = null
            setIsSyncing(false)
            setSyncProgress(null)
        }
    }

    const handleStop = () => {
        abortControllerRef.current?.abort()
        abortSync()
    }

    const circumference = 37.69911184307752

    return (
        <div className="flex items-center gap-2">
            {/* Fixed-width status area — prevents search bar jitter */}
            <div className="flex items-center justify-end min-w-[112px]">
                {isSyncing && syncProgress ? (
                    // Progress ring + percentage during active sync
                    <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-[var(--color-text-muted)] animate-pulse">
                            Syncing...
                        </span>
                        <div className="relative h-4 w-4 flex-shrink-0">
                            <svg className="h-full w-full rotate-[-90deg]" viewBox="0 0 16 16">
                                <circle
                                    className="stroke-[var(--color-border)] transition-colors"
                                    cx="8" cy="8" r="6"
                                    fill="transparent" strokeWidth="2"
                                />
                                <circle
                                    className="stroke-[var(--color-accent)] transition-all duration-300 ease-out"
                                    cx="8" cy="8" r="6"
                                    fill="transparent" strokeWidth="2"
                                    strokeDasharray={circumference}
                                    strokeDashoffset={circumference - (circumference * displayPct / 100)}
                                    strokeLinecap="round"
                                />
                            </svg>
                        </div>
                        <span className="text-xs font-semibold tabular-nums text-[var(--color-text)]">
                            {displayPct}%
                        </span>
                    </div>
                ) : syncError ? (
                    // Error state
                    <span className="flex items-center gap-1 text-xs font-medium text-[var(--color-danger)]">
                        <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                        <span className="truncate">Failed</span>
                    </span>
                ) : (
                    // Last sync time (shows "Never" if null)
                    <span className="text-xs text-[var(--color-text-subtle)] truncate text-right">
                        Last Sync: {lastSyncTime ? formatRelativeTime(lastSyncTime) : 'Never'}
                    </span>
                )}
            </div>

            {/* Sync / Stop button */}
            {isSyncing ? (
                <button
                    onClick={handleStop}
                    title="Stop sync"
                    className="flex h-[30px] items-center px-3 rounded-lg bg-[var(--color-danger)] text-xs font-semibold text-white transition-all hover:bg-[var(--color-danger-hover,var(--color-danger))] active:scale-[0.97]"
                >
                    Stop
                </button>
            ) : (
                <button
                    onClick={handleSync}
                    disabled={!isOnline || isRateLimited || !githubToken}
                    title={
                        !githubToken ? 'GitHub token required to sync'
                            : !isOnline ? 'Sync is unavailable offline'
                                : isRateLimited ? 'API rate limit exhausted'
                                    : 'Sync all repositories'
                    }
                    className={`flex h-[30px] items-center px-3 rounded-lg text-xs font-semibold text-white transition-all active:scale-[0.97] ${(!isOnline || isRateLimited || !githubToken) ? 'opacity-50 cursor-not-allowed' : ''
                        } ${!isOnline || isRateLimited
                            ? 'bg-[var(--color-surface)] text-[var(--color-text-muted)] hidden md:flex'
                            : 'bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)]'
                        }`}
                >
                    Sync
                </button>
            )}
        </div>
    )
}
