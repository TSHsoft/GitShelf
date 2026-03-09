import { useState, useEffect } from 'react'
import { X, GitBranch, Star, AlertCircle, Loader2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { fetchRepository, formatStars } from '@/lib/github'
import { decryptTokenAsync } from '@/lib/crypto'
import type { Repository } from '@/types'
import { MAX_ITEMS_LIMIT } from '@/types'
import { TagSelector } from './TagSelector'
import { useGithubRateLimit } from '@/hooks/useGithubRateLimit'

interface AddRepoModalProps {
    onClose: () => void
}

export function AddRepoModal({ onClose }: AddRepoModalProps) {
    const { data, addRepository, githubToken } = useStore()
    const [input, setInput] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [preview, setPreview] = useState<Repository | null>(null)
    const { isRateLimited } = useGithubRateLimit()

    // Tag selection state
    const [selectedTagIds, setSelectedTagIds] = useState<string[]>([])

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [onClose])

    const parseRepoPath = (raw: string): string => {
        let trimmed = raw.trim()

        // Remove trailing slash
        if (trimmed.endsWith('/')) {
            trimmed = trimmed.slice(0, -1)
        }

        // Remove .git suffix
        if (trimmed.endsWith('.git')) {
            trimmed = trimmed.slice(0, -4)
        }

        try {
            // Try parsing as a URL first
            const url = new URL(trimmed)
            if (url.hostname.includes('github.com')) {
                // Split path by '/', filter empty strings
                const parts = url.pathname.split('/').filter(Boolean)
                // We need at least 1 part (either owner or owner/repo)
                if (parts.length >= 1) {
                    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0]
                }
            }
        } catch {
            // Not a valid full URL, try manual parsing
        }

        // Handle raw "github.com/..." or just "owner/repo"
        // 1. Check for github.com pattern
        const githubMatch = trimmed.match(/github\.com\/([^/]+(\/[^/]+)?)/)
        if (githubMatch) {
            const path = githubMatch[1]
            const parts = path.split('/')
            if (parts.length >= 1) return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0]
        }

        // 2. Check for direct "owner/repo" or "owner" (and potentially sub-paths if user pasted that)
        // We only want the first two segments if it looks like a path
        const parts = trimmed.split('/')
        if (parts.length >= 1 && !trimmed.includes('.') && !trimmed.includes(':')) { // Simple heuristic
            return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : parts[0]
        }

        return ''
    }

    const handleFetch = async () => {
        const path = parseRepoPath(input)
        if (!path) {
            setError('Enter a GitHub URL or "owner/repo" format')
            return
        }
        if (Object.keys(data.repositories).length >= MAX_ITEMS_LIMIT) {
            setError(`You have reached the limit of ${MAX_ITEMS_LIMIT.toLocaleString()} items in your shelf.`)
            return
        }
        if (data.repositories[path]) {
            setError('This repository is already in your shelf')
            return
        }
        if (isRateLimited) {
            setError('GitHub API rate limit reached. Please wait or add a token in Settings.')
            return
        }

        setLoading(true)
        setError(null)
        setPreview(null)

        try {
            const token = githubToken ? await decryptTokenAsync(githubToken) : undefined
            const repo = await fetchRepository(path, token)
            setPreview(repo)
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err)
            if (msg.includes('404') || msg.includes('Not Found')) {
                setError('Repository not found. Check the URL or make sure it\'s public.')
            } else if (msg.includes('rate limit') || msg.includes('403')) {
                setError('GitHub API rate limit reached. Add a token in Settings or wait a few minutes.')
            } else {
                setError(`Failed to fetch: ${msg}`)
            }
        } finally {
            setLoading(false)
        }
    }

    const handleAdd = () => {
        if (!preview) return
        addRepository({ ...preview, tags: selectedTagIds })
        onClose()
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
            onPointerDown={(e) => {
                e.stopPropagation()
            }}
            onClick={(e) => {
                e.stopPropagation()
            }}
        >
            <div
                className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-base font-semibold text-[var(--color-text)]">Add to Shelf</h2>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Input */}
                <div className="flex gap-2">
                    <input
                        autoFocus
                        value={input}
                        onChange={(e) => { setInput(e.target.value); setError(null); setPreview(null) }}
                        onKeyDown={(e) => e.key === 'Enter' && !loading && handleFetch()}
                        placeholder="GitHub repo or profile URL"
                        className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3.5 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)] transition-colors"
                    />
                    <button
                        type="button"
                        onClick={handleFetch}
                        disabled={loading || !input.trim()}
                        className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Fetch'}
                    </button>
                </div>
                <p className="mt-1.5 text-[10px] text-[var(--color-text-subtle)] px-0.5">
                    Supports <span className="font-medium text-[var(--color-text-muted)]">owner/repo</span> format, full GitHub URLs, or a <span className="font-medium text-[var(--color-text-muted)]">github.com/username</span> profile link.
                </p>

                {/* Error */}
                {error && (
                    <div className="mt-3 flex items-start gap-2 rounded-lg border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-3 py-2.5">
                        <AlertCircle className="h-4 w-4 text-[var(--color-danger)] shrink-0 mt-0.5" />
                        <p className="text-xs text-[var(--color-danger)]">{error}</p>
                    </div>
                )}

                {/* Preview */}
                {preview && (
                    <div className="mt-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-4 animate-fade-in flex flex-col flex-1 overflow-y-auto min-h-[100px]">
                        <div className="flex items-start justify-between gap-2 mb-2 shrink-0">
                            <div>
                                <p className="text-xs text-[var(--color-text-muted)]">{preview.owner}</p>
                                <h3 className="text-sm font-semibold text-[var(--color-text)]">{preview.name}</h3>
                            </div>
                            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] shrink-0">
                                <span className="flex items-center gap-1"><Star className="h-3 w-3" />{formatStars(preview.stars)}</span>
                                {preview.latest_release && (
                                    <span className="flex items-center gap-1 text-[var(--color-success)]">
                                        <GitBranch className="h-3 w-3" />{preview.latest_release}
                                    </span>
                                )}
                            </div>
                        </div>
                        {preview.description && (
                            <p className="text-xs text-[var(--color-text-subtle)] line-clamp-2 mb-3">{preview.description}</p>
                        )}
                        <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] mb-4">
                            {preview.language && <span>{preview.language}</span>}
                            {preview.archived && <span className="text-[var(--color-warning)]">Archived</span>}
                        </div>

                        {/* Tag selector */}
                        <div className="flex-1 overflow-y-auto min-h-0 shrink pr-2 mb-4">
                            <TagSelector
                                selectedTagIds={selectedTagIds}
                                onChange={setSelectedTagIds}
                            />
                        </div>

                        <button
                            type="button"
                            onClick={handleAdd}
                            className="w-full rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                        >
                            Add to Shelf
                        </button>
                    </div>
                )}
            </div>
        </div >
    )
}
