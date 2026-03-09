import { useState } from 'react'
import { Star, ExternalLink, Trash2, Tag as TagIcon, Archive, GitBranch, AlertTriangle, RefreshCw } from 'lucide-react'
import type { Repository } from '@/types'
import { useStore } from '@/store/useStore'
import { formatStars } from '@/lib/github'
import { formatDate } from '@/lib/utils'
import { TagEditor } from './TagEditor'
import { LanguageBar } from './LanguageBar'
import { ConfirmDialog } from './ConfirmDialog'

interface RepoCardProps {
    repo: Repository
    isActive: boolean
    onClick: () => void
}

export function RepoCard({ repo, isActive, onClick }: RepoCardProps) {
    const { data, removeRepository, syncRepository, syncingRepoIds, githubToken } = useStore()
    const tags = repo.tags.map((id) => data.tags[id]).filter(Boolean)
    const [isExpanded, setIsExpanded] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const isSyncing = syncingRepoIds.includes(repo.id)

    const statusBadge = repo.status === 'deleted'
        ? <span className="flex items-center gap-1 text-xs text-[var(--color-danger)]"><AlertTriangle className="h-3 w-3" />Deleted</span>
        : repo.status === 'renamed'
            ? <span className="text-xs text-[var(--color-warning)]">Renamed</span>
            : null

    return (
        <div
            onClick={onClick}
            className={`group relative flex flex-col gap-2.5 rounded-xl border p-4 transition-all duration-150 ${(!githubToken) ? 'cursor-default' : 'cursor-pointer'} ${isActive
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-lg shadow-blue-500/5'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)]/40 hover:bg-[var(--color-surface-2)]'
                } ${repo.status === 'deleted' ? 'opacity-60' : ''}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-xs text-[var(--color-text-muted)] truncate">{repo.owner}</p>
                        {repo.archived && <Archive className="h-3 w-3 text-[var(--color-warning)] shrink-0" />}
                    </div>
                    <h3 className="text-sm font-semibold text-[var(--color-text)] truncate leading-tight">{repo.name}</h3>
                    {statusBadge}
                </div>
                {/* Actions — always show tag editor, others on hover */}
                <div className="flex items-center gap-0.5 shrink-0">
                    <div className="flex items-center gap-0.5">
                        <button
                            onClick={(e) => { e.stopPropagation(); syncRepository(repo.id) }}
                            className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors ${!githubToken ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isSyncing || !githubToken}
                            title={!githubToken ? "GitHub token required to sync" : "Sync Repository"}
                        >
                            <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        </button>
                        <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                            title="Open in GitHub"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button
                            onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
                            className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                            title="Delete Repository"
                        >
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <TagEditor repoId={repo.id} currentTags={repo.tags} />
                </div>
            </div>

            {/* Description */}
            {repo.description && (
                <p
                    className={`text-xs text-[var(--color-text-subtle)] leading-relaxed cursor-pointer hover:text-[var(--color-text)] transition-colors ${isExpanded ? '' : 'line-clamp-2'
                        }`}
                    onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
                    title={isExpanded ? "Click to collapse" : "Click to expand"}
                >
                    {repo.description}
                </p>
            )}

            {/* Tags */}
            {tags.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                    {tags.map((tag) => (
                        <span
                            key={tag.id}
                            className="flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                            style={{ backgroundColor: `${tag.color}20`, color: tag.color }}
                        >
                            <TagIcon className="h-2.5 w-2.5" />
                            {tag.name}
                        </span>
                    ))}
                </div>
            ) : (
                <p className="text-xs text-[var(--color-text-muted)]/50 italic">No tags — click <TagIcon className="inline h-3 w-3" /> to add</p>
            )}

            {/* Language breakdown */}
            <LanguageBar languages={repo.languages} language={repo.language} mode="bar" />

            {/* Footer */}
            <div className="flex items-center gap-3 text-xs text-[var(--color-text-muted)]">
                <div className="flex items-center gap-1 text-[var(--color-warning)]" title={repo.type === 'profile' ? "Followers" : "Stars"}>
                    <Star className="h-3 w-3" />
                    <span>{formatStars(repo.stars)} {repo.type === 'profile' && 'Followers'}</span>
                </div>
                {repo.latest_release && (
                    <div className="flex items-center gap-1 text-[var(--color-success)]" title="Latest Release">
                        <GitBranch className="h-3 w-3" />
                        <span>{repo.latest_release}</span>
                    </div>
                )}
                <span className="ml-auto" title="Last Push">{formatDate(repo.last_push_at || repo.added_at)}</span>
            </div>

            {showDeleteConfirm && (
                <ConfirmDialog
                    isOpen={showDeleteConfirm}
                    title="Delete Repository"
                    description={<>Are you sure you want to delete <strong>{repo.owner}/{repo.name}</strong>? This action cannot be undone.</>}
                    variant="danger"
                    confirmLabel="Delete"
                    onConfirm={() => removeRepository(repo.id)}
                    onClose={() => setShowDeleteConfirm(false)}
                />
            )}
        </div>
    )
}
