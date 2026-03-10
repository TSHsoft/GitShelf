import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Download, Upload, Globe, Loader2, Check, Square, AlertCircle } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { GitShelfDataSchema, MAX_ITEMS_LIMIT, type Repository } from '@/types'
import { parseBookmarkHtml, batchFetchRepos, type BookmarkRepo } from '@/lib/bookmarks'
import { decryptTokenAsync } from '@/lib/crypto'
import { saveLocalData } from '@/lib/db'
import { toast } from 'sonner'

type ImportStage = 'idle' | 'preview' | 'importing' | 'pending_rest' | 'importing_rest' | 'complete'

function getHumanizedETA(seconds: number): string {
    if (seconds < 60) return 'Less than a minute'
    if (seconds < 120) return '1 to 2 minutes'
    if (seconds <= 300) return 'A few minutes'
    return `About ${Math.ceil(seconds / 60)} minutes`
}

export function ImportExport() {
    const { data, importData, githubToken } = useStore()
    const fileInputRef = useRef<HTMLInputElement>(null)
    const bookmarkInputRef = useRef<HTMLInputElement>(null)

    // Bookmark import state
    const [importStage, setImportStage] = useState<ImportStage>('idle')
    const [importProgress, setImportProgress] = useState<{ done: number; total: number; current: string } | null>(null)
    const [importResult, setImportResult] = useState<{ imported: number; skipped: number; notFound?: number } | null>(null)
    const [parsedPaths, setParsedPaths] = useState<BookmarkRepo[] | null>(null)
    const [pendingRestRepos, setPendingRestRepos] = useState<BookmarkRepo[] | null>(null)
    const [displayDone, setDisplayDone] = useState(0)
    const abortRef = useRef<AbortController | null>(null)
    // Holds the final state to transition to once animation catches up
    const pendingCompleteRef = useRef<null | {
        nextStage: ImportStage
        result: { imported: number; skipped: number; notFound?: number } | null
        pendingRest: BookmarkRepo[] | null
    }>(null)

    // Smooth progress interpolation — also triggers deferred stage transitions
    useEffect(() => {
        if (!importProgress) {
            if (importStage === 'idle' || importStage === 'preview') setDisplayDone(0)
            return
        }

        if (displayDone < importProgress.done) {
            const target = importProgress.done
            const timer = setInterval(() => {
                setDisplayDone(prev => {
                    const next = prev + 1
                    if (next >= target) {
                        clearInterval(timer)
                        // Once animation caught up, fire the pending stage transition
                        const pending = pendingCompleteRef.current
                        if (pending) {
                            pendingCompleteRef.current = null
                            setImportProgress(null)
                            setImportResult(pending.result)
                            setPendingRestRepos(pending.pendingRest)
                            setParsedPaths(null)
                            setImportStage(pending.nextStage)
                        }
                        return target
                    }
                    return next
                })
            }, 10) // 100 units per second (10ms per unit)
            return () => clearInterval(timer)
        } else if (displayDone >= importProgress.done) {
            // Already caught up — fire any pending transition immediately
            const pending = pendingCompleteRef.current
            if (pending) {
                pendingCompleteRef.current = null
                setImportProgress(null)
                setImportResult(pending.result)
                setPendingRestRepos(pending.pendingRest)
                setParsedPaths(null)
                setImportStage(pending.nextStage)
            }
        }
    }, [importProgress, displayDone, importStage])

    // Auto-cancel on unmount
    useEffect(() => {
        return () => { abortRef.current?.abort() }
    }, [])

    const handleExport = () => {
        const exportData = JSON.parse(JSON.stringify(data))

        const json = JSON.stringify(exportData, null, 2)
        const blob = new Blob([json], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `gitshelf-backup-${new Date().toISOString().slice(0, 10)}.json`
        a.click()
        URL.revokeObjectURL(url)
        toast.success(`Exported ${Object.keys(exportData.repositories || {}).length} repositories successfully`)
    }

    const handleImportJson = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (ev) => {
            try {
                const json = JSON.parse(ev.target?.result as string)
                const result = GitShelfDataSchema.safeParse(json)
                if (!result.success) {
                    toast.error('Invalid GitShelf backup file format.')
                    return
                }

                const incomingRepoCount = Object.keys(result.data.repositories).length
                if (incomingRepoCount > MAX_ITEMS_LIMIT) {
                    toast.error(`Import failed: The backup contains ${incomingRepoCount.toLocaleString()} items, exceeding the limit of ${MAX_ITEMS_LIMIT.toLocaleString()}.`)
                    return
                }

                importData(result.data)
                saveLocalData(result.data)
                const repoCount = Object.keys(result.data.repositories).length
                toast.success(`Successfully imported ${repoCount} repositories from backup.`)
            } catch {
                toast.error('Failed to parse backup file.')
            }
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    const handleBookmarkFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (ev) => {
            const html = ev.target?.result as string
            let items = parseBookmarkHtml(html)
            if (items.length === 0) {
                toast.error('No GitHub repository links found in this bookmark file.')
                return
            }

            const currentCount = Object.keys(data.repositories).length
            const spaceLeft = MAX_ITEMS_LIMIT - currentCount

            if (spaceLeft <= 0) {
                toast.error(`You have already reached the limit of ${MAX_ITEMS_LIMIT.toLocaleString()} items.`)
                return
            }

            if (items.length > spaceLeft) {
                toast.warning(`Import limited: only ${spaceLeft.toLocaleString()} items fit within your ${MAX_ITEMS_LIMIT.toLocaleString()} limit. The rest were skipped.`, { duration: 6000 })
                items = items.slice(0, spaceLeft)
            }

            setParsedPaths(items)
            setPendingRestRepos(null)
            setImportResult(null)
            setImportStage('preview')
        }
        reader.readAsText(file)
        e.target.value = ''
    }

    const startBatchImport = async () => {
        if (!parsedPaths || parsedPaths.length === 0) return
        const controller = new AbortController()
        abortRef.current = controller
        setImportStage('importing')
        setImportResult(null)
        setImportProgress({ done: 0, total: parsedPaths.length, current: parsedPaths[0].id })

        const rawToken = useStore.getState().githubToken
        const token = rawToken ? await decryptTokenAsync(rawToken) : undefined
        const result = await batchFetchRepos(
            parsedPaths,
            token,
            (done, total, current) => {
                setImportProgress({ done, total, current })
            },
            controller.signal,
        )

        saveLocalData(useStore.getState().data)
        abortRef.current = null

        if (result.cancelled) {
            // If aborted, skip animation waiting and immediately close/finish
            pendingCompleteRef.current = null
            setImportProgress(null)
            setImportResult({ imported: result.imported, skipped: result.skipped, notFound: result.notFound })
            setPendingRestRepos(null)
            setParsedPaths(null)
            setImportStage('complete')
            return
        }

        if (result.pendingRest && result.pendingRest.length > 0) {
            // Defer stage transition until animation catches up
            pendingCompleteRef.current = {
                nextStage: 'pending_rest',
                result: { imported: result.imported, skipped: result.skipped, notFound: result.notFound },
                pendingRest: result.pendingRest,
            }
        } else {
            // Defer stage transition until animation catches up
            pendingCompleteRef.current = {
                nextStage: 'complete',
                result: { imported: result.imported, skipped: result.skipped, notFound: result.notFound },
                pendingRest: null,
            }
        }
        // Trigger the effect by updating progress to final count (in case not already there)
        setImportProgress(prev => prev ? { ...prev, done: result.imported + result.skipped + result.notFound } : prev)
    }

    const startDeepScan = async () => {
        if (!pendingRestRepos || pendingRestRepos.length === 0) return

        const controller = new AbortController()
        abortRef.current = controller

        setImportStage('importing_rest')
        setImportProgress({ done: 0, total: pendingRestRepos.length, current: '' })

        const rawToken = useStore.getState().githubToken
        const token = rawToken ? await decryptTokenAsync(rawToken) : undefined

        const { processRestFallback } = await import('@/lib/bookmarks')

        const result = await processRestFallback(
            pendingRestRepos,
            token,
            (done, total, current) => {
                setImportProgress({ done, total, current })
            },
            controller.signal
        )

        abortRef.current = null

        setImportResult(prev => prev ? {
            imported: prev.imported + result.imported,
            skipped: prev.skipped,
            notFound: (prev.notFound || 0) + result.notFound
        } : null)

        setImportProgress(null)
        setParsedPaths(null)
        setPendingRestRepos(null)
        saveLocalData(useStore.getState().data)
        setImportStage('complete')
    }

    const handleSkipDeepScan = () => {
        if (!pendingRestRepos) return

        const store = useStore.getState()
        pendingRestRepos.forEach(item => {
            const [owner, name] = item.id.split('/')
            const fakeRepo: Repository = {
                id: item.id,
                url: `https://github.com/${item.id}`,
                name: name || item.id,
                owner: owner || 'unknown',
                description: item.title || null,
                stars: 0,
                language: null,
                topics: [],
                updated_at: new Date().toISOString(),
                last_push_at: new Date().toISOString(),
                latest_release: null,
                has_new_release: false,
                archived: false,
                is_disabled: false,
                is_locked: false,
                is_private: false,
                is_empty: true,
                status: 'not_found',
                default_branch: 'master',
                tags: [],
                added_at: item.added_at ?? Date.now(),
                last_synced_at: Date.now(),
                type: name ? 'repository' : 'profile'
            }
            store.addRepository(fakeRepo)
        })

        setImportResult(prev => prev ? {
            imported: prev.imported, // Deep scan skipped marking as imported is incorrect. We mark as notFound.
            skipped: prev.skipped,
            notFound: (prev.notFound || 0) + pendingRestRepos.length
        } : null)

        abortRef.current = null
        setImportProgress(null)
        setParsedPaths(null)
        setPendingRestRepos(null)
        saveLocalData(store.data)
        setImportStage('complete')
    }

    const handleCancel = () => {
        if (abortRef.current) {
            abortRef.current.abort()
        }
    }

    const closePortal = () => {
        setImportStage('idle')
        setParsedPaths(null)
        setPendingRestRepos(null)
        setImportResult(null)
        setImportProgress(null)
    }

    return (
        <div className="flex flex-col gap-2">
            {/* Main buttons row */}
            <div className="flex items-center gap-1">
                <button
                    onClick={handleExport}
                    disabled={useStore.getState().isSyncing}
                    title={useStore.getState().isSyncing ? "Export unavailable during global sync" : "Export backup"}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="h-3.5 w-3.5" />
                    Export
                </button>
                <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={useStore.getState().isSyncing}
                    title={useStore.getState().isSyncing ? "Import unavailable during global sync" : "Import GitShelf backup"}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Upload className="h-3.5 w-3.5" />
                    Import
                </button>
                <button
                    onClick={() => bookmarkInputRef.current?.click()}
                    disabled={!githubToken || useStore.getState().isSyncing}
                    title={!githubToken ? "GitHub token required to import bookmarks" : useStore.getState().isSyncing ? "Bookmark import unavailable during global sync" : "Import from browser bookmarks"}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Globe className="h-3.5 w-3.5" />
                    Bookmarks
                </button>
            </div>

            {/* Hidden file inputs */}
            <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImportJson} className="hidden" />
            <input ref={bookmarkInputRef} type="file" accept=".html,.htm,text/html" onChange={handleBookmarkFile} className="hidden" />

            {/* Render Portal for Preview, Importing, or Complete */}
            {importStage !== 'idle' && createPortal(
                <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-4 bg-black/60 animate-fade-in">

                    {importStage === 'preview' && parsedPaths && (
                        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl flex flex-col items-center">
                            <Globe className="h-10 w-10 text-[var(--color-accent)] mb-4" />
                            <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">Ready to Import</h3>

                            <p className="text-sm font-medium text-[var(--color-text)] text-center mb-2">
                                Found <strong>{parsedPaths.length}</strong> new GitHub items in bookmarks.
                            </p>

                            <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-6 leading-relaxed text-center px-4">
                                You can stop the import at any time. Progress is saved, and re-importing the same file will skip existing bookmarks.
                            </p>

                            <div className="flex w-full gap-3">
                                <button
                                    onClick={closePortal}
                                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={startBatchImport}
                                    className="flex-1 rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-bold text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.97]"
                                >
                                    Start Import
                                </button>
                            </div>
                        </div>
                    )}

                    {(importStage === 'importing' || importStage === 'importing_rest') && importProgress && (
                        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl flex flex-col items-center">
                            <Loader2 className="h-8 w-8 text-[var(--color-accent)] animate-spin mb-4" />
                            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">
                                {importStage === 'importing' ? 'Importing Bookmarks' : 'Deep Scanning'}
                            </h3>

                            <div className="text-sm font-medium text-[var(--color-text-muted)] mb-4">
                                {importProgress.done === 0
                                    ? <span className="animate-pulse">Starting...</span>
                                    : <>{displayDone} / {importProgress.total} items processed</>}
                            </div>

                            <div className="w-full h-2 rounded-full bg-[var(--color-surface-2)] overflow-hidden mb-3">
                                <div
                                    className="h-full rounded-full bg-[var(--color-accent)] transition-all duration-300 relative overflow-hidden"
                                    style={{ width: `${(displayDone / importProgress.total) * 100}%` }}
                                >
                                    <div className="absolute inset-0 bg-white/20 animate-pulse" />
                                </div>
                            </div>

                            <p className="w-full text-center text-xs text-[var(--color-text-muted)] truncate mb-6" title={importProgress.current}>
                                Processing: <span className="text-[var(--color-text)]">{importProgress.current}</span>
                            </p>

                            <button
                                onClick={handleCancel}
                                className="flex items-center justify-center gap-2 rounded-lg bg-[var(--color-danger)]/10 px-6 py-2.5 text-sm font-bold text-[var(--color-danger)] transition-colors hover:bg-[var(--color-danger)] hover:text-white"
                            >
                                <Square className="h-4 w-4" />
                                Stop Import
                            </button>

                            <div className="mt-4 flex items-center gap-1.5 text-[10px] text-[var(--color-text-subtle)]">
                                <AlertCircle className="h-3 w-3" />
                                <span>You can safely stop at any time. Progress is saved.</span>
                            </div>
                        </div>
                    )}

                    {importStage === 'pending_rest' && pendingRestRepos && importResult && (
                        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl flex flex-col items-center">
                            <AlertCircle className="h-10 w-10 text-[var(--color-amber)] mb-4" />
                            <h3 className="text-xl font-bold text-[var(--color-text)] mb-2">Deep Scan Required</h3>

                            {(() => {
                                const repoCount = pendingRestRepos.filter(r => r.id.includes('/')).length
                                const profileCount = pendingRestRepos.length - repoCount
                                return (
                                    <div className="text-sm font-medium text-[var(--color-text)] text-center mb-2 flex flex-col gap-1">
                                        <span><strong>{importResult.imported}</strong> fast imported.</span>
                                        <span className="text-[var(--color-amber)]">
                                            <strong>{repoCount}</strong> repos & <strong>{profileCount}</strong> profiles require deep scan.
                                        </span>
                                    </div>
                                )
                            })()}

                            <p className="text-xs text-[var(--color-text-muted)] mt-1 mb-6 leading-relaxed text-center px-4">
                                These bookmarks were not found instantly and will be checked individually via REST API.<br /><br />
                                <span className="font-semibold text-[var(--color-text)]">Estimated time: {getHumanizedETA(pendingRestRepos.length * 1.5)}</span>
                            </p>

                            <div className="flex w-full gap-3">
                                <button
                                    onClick={handleSkipDeepScan}
                                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] py-2.5 text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                                >
                                    Finish Now
                                </button>
                                <button
                                    onClick={startDeepScan}
                                    className="flex-1 rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-bold text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.97]"
                                >
                                    Deep Scan
                                </button>
                            </div>
                        </div>
                    )}

                    {importStage === 'complete' && importResult && (
                        <div className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl flex flex-col items-center">
                            <div className="flex items-center justify-center h-12 w-12 rounded-full mb-4 bg-[var(--color-success)]/20 text-[var(--color-success)]">
                                <Check className="h-6 w-6" />
                            </div>
                            <h3 className="text-lg font-bold text-[var(--color-text)] mb-2">Import Complete</h3>

                            {(() => {
                                return (
                                    <div className="flex items-center gap-5 mb-6">
                                        <div className="flex flex-col items-center">
                                            <span className="text-2xl font-bold text-[var(--color-success)]">{importResult.imported}</span>
                                            <span className="text-xs text-[var(--color-text-muted)]">Added</span>
                                        </div>
                                        <div className="h-8 w-px bg-[var(--color-border)]" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-2xl font-bold text-[var(--color-text-muted)]">{importResult.skipped}</span>
                                            <span className="text-xs text-[var(--color-text-muted)]">Skipped</span>
                                        </div>
                                        <div className="h-8 w-px bg-[var(--color-border)]" />
                                        <div className="flex flex-col items-center">
                                            <span className="text-2xl font-bold text-[var(--color-warning)]">{importResult.notFound || 0}</span>
                                            <span className="text-xs text-[var(--color-text-muted)]">Not Found</span>
                                        </div>
                                    </div>
                                )
                            })()}

                            {/* Repo vs Profile breakdown from current library */}
                            {(() => {
                                const allRepos = Object.values(useStore.getState().data.repositories)
                                const repoCount = allRepos.filter(r => r.type === 'repository').length
                                const profileCount = allRepos.filter(r => r.type === 'profile').length
                                return (
                                    <div className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--color-surface-2)] mb-6 text-xs text-[var(--color-text-subtle)]">
                                        <span>Library:</span>
                                        <span className="font-semibold text-[var(--color-text)]">{repoCount}</span>
                                        <span>Repositories</span>
                                        <span className="mx-1 h-3 w-px bg-[var(--color-border)]" />
                                        <span className="font-semibold text-[var(--color-text)]">{profileCount}</span>
                                        <span>Profiles</span>
                                    </div>
                                )
                            })()}

                            <button
                                onClick={closePortal}
                                className="w-full max-w-[200px] rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.97]"
                            >
                                Done
                            </button>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    )
}
