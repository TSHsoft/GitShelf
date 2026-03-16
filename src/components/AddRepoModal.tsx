import { useState, useEffect } from 'react'
import { X, Book, Star, AlertCircle, Loader2, User, GitBranch, BookPlus, Building2, Users } from 'lucide-react'
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
            setError('GitHub API rate limit reached. Please wait or sign in via Settings to increase your limit.')
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
                setError('GitHub API rate limit reached. Sign in via Settings to increase your limit or wait a few minutes.')
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
                className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-surface-2)]"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="p-6">
                    {/* Header */}
                    <div className="mb-6 flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-accent)] shadow-sm">
                            <BookPlus className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text)] leading-tight">Add to Shelf</h2>
                            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Import any GitHub repository or profile</p>
                        </div>
                    </div>

                    {/* Input Area */}
                    <div className="space-y-4">
                        <div className="flex items-stretch gap-2.5 h-[34px]">
                            <div className="relative flex-1">
                                <input
                                    autoFocus
                                    value={input}
                                    onChange={(e) => { setInput(e.target.value); setError(null); setPreview(null) }}
                                    onKeyDown={(e) => e.key === 'Enter' && !loading && handleFetch()}
                                    placeholder="GitHub repo or profile URL"
                                    autoComplete="off"
                                    className="w-full h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] pl-3 pr-9 text-xs font-semibold text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)] focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
                                />
                                {input && (
                                    <button
                                        type="button"
                                        onClick={() => { setInput(''); setError(null); setPreview(null) }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1 rounded-md hover:bg-[var(--color-surface-3)]"
                                        title="Clear input"
                                    >
                                        <X className="h-3.5 w-3.5" />
                                    </button>
                                )}
                            </div>
                            <button
                                type="button"
                                onClick={handleFetch}
                                disabled={loading || !input.trim()}
                                className="flex items-center justify-center gap-1.5 rounded-lg bg-[var(--color-accent)] w-[75px] text-xs font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-[0.98] h-full shrink-0"
                            >
                                {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Fetch'}
                            </button>
                        </div>
                        <p className="text-[10px] text-[var(--color-text-subtle)] px-0.5 leading-relaxed">
                            Supports <span className="font-semibold text-[var(--color-text-muted)]">owner/repo</span> format, full GitHub URLs, or any <span className="font-semibold text-[var(--color-text-muted)]">User or Organization</span> profile link.
                        </p>
                    </div>

                    {/* Error */}
                    {error && (
                        <div className="mt-4 flex items-start gap-3 rounded-xl border border-[var(--color-danger)]/30 bg-[var(--color-danger)]/10 px-4 py-3 animate-in fade-in slide-in-from-top-1 duration-200">
                            <AlertCircle className="h-4 w-4 text-[var(--color-danger)] shrink-0 mt-0.5" />
                            <p className="text-xs text-[var(--color-danger)] font-medium leading-relaxed">{error}</p>
                        </div>
                    )}

                    {/* Preview Area */}
                    {preview && (
                        <div className="mt-6 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] p-5 animate-fade-in flex flex-col gap-4">
                            <div className="flex items-start justify-between gap-3 min-w-0">
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm text-[var(--color-accent)] font-bold py-0.5 truncate">{preview.owner}</p>
                                    <h3 className="text-sm font-bold text-[var(--color-text)] flex items-center gap-2 py-0.5 min-w-0">
                                        {preview.type === 'profile' ? (
                                            preview.profile_type === 'org'
                                                ? <Building2 className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                                : <User className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                        ) : (
                                            <Book className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                        )}
                                        <span className="truncate">{preview.name}</span>
                                    </h3>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)] shrink-0 bg-[var(--color-surface)]/50 px-2 py-1 rounded-lg border border-[var(--color-border)]/50">
                                    <span className="flex items-center gap-1.5">
                                        {preview.type === 'profile' ? <Users className="h-3.5 w-3.5 text-[var(--color-warning)]" /> : <Star className="h-3.5 w-3.5 text-[var(--color-warning)]" />}
                                        {formatStars(preview.stars)}
                                    </span>
                                    {preview.latest_release && (
                                        <span className="flex items-center gap-1.5 text-[var(--color-success)] font-medium">
                                            <GitBranch className="h-3.5 w-3.5" />{preview.latest_release}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {preview.description && (
                                <p className="text-xs text-[var(--color-text-subtle)] line-clamp-2 leading-relaxed">{preview.description}</p>
                            )}

                            <div className="flex flex-wrap items-center gap-3 text-[11px] font-medium text-[var(--color-text-muted)] uppercase tracking-wider">
                                {preview.language && (
                                    <span className="flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-[var(--color-accent)]" />
                                        {preview.language}
                                    </span>
                                )}
                                {preview.archived && <span className="text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-1.5 py-0.5 rounded border border-[var(--color-warning)]/20">Archived</span>}
                            </div>

                            <div className="h-px bg-[var(--color-border)]/50 my-1" />

                            {/* Tag selector */}
                            <div className="max-h-[120px] overflow-y-auto pr-1">
                                <TagSelector
                                    selectedTagIds={selectedTagIds}
                                    onChange={setSelectedTagIds}
                                />
                            </div>

                            <button
                                type="button"
                                onClick={handleAdd}
                                className="w-full rounded-xl bg-[var(--color-accent)] py-2.5 text-sm font-bold text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] shadow-sm"
                            >
                                Add to Shelf
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div >
    )
}
