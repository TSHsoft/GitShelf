import { useRef, useState } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronUp, ChevronDown, ChevronsUpDown, ExternalLink, Trash2, Tag as TagIcon, Archive, AlertTriangle, RefreshCw, Star } from 'lucide-react'
import type { Repository, SortField, RepoStatus } from '@/types'
import { useStore } from '@/store/useStore'
import { formatStars } from '@/lib/github'
import { formatDate } from '@/lib/utils'
import { TagEditor } from '@/components/TagEditor'
import { LanguageBar } from '@/components/LanguageBar'
import { RepoDrawer } from '@/components/RepoDrawer'
import { ConfirmDialog } from '@/components/ConfirmDialog'

export const COLUMNS: { key: SortField | 'select'; label: string; width: string }[] = [
    { key: 'select', label: '', width: 'w-10' },
    { key: 'name', label: 'Repository', width: 'flex-[3]' },
    { key: 'status', label: 'Status', width: 'w-24' },
    { key: 'stars', label: 'Stars', width: 'w-24' },
    { key: 'language', label: 'Language', width: 'w-24' },
    { key: 'added_at', label: 'Added', width: 'w-24' },
    { key: 'last_push_at', label: 'Last Push', width: 'w-24' },
    { key: 'latest_release', label: 'Release', width: 'w-24' },
]

function StatusBadge({ status }: { status: RepoStatus }) {
    switch (status) {
        case 'archived':
            return (
                <span className="flex items-center gap-1 text-[var(--color-danger)] bg-[var(--color-danger)]/10 px-2 py-0.5 rounded-full">
                    <Archive className="h-3 w-3" /> Archived
                </span>
            )
        case 'deleted':
            return (
                <span className="flex items-center gap-1 text-[var(--color-danger)] bg-[var(--color-danger)]/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="h-3 w-3" /> Deleted
                </span>
            )
        case 'renamed':
            return (
                <span className="text-[var(--color-info)] bg-[var(--color-info)]/10 px-2 py-0.5 rounded-full">
                    Renamed
                </span>
            )
        case 'stale':
            return (
                <span className="text-[var(--color-warning)] bg-[var(--color-warning)]/10 px-2 py-0.5 rounded-full">
                    Stale
                </span>
            )
        case 'not_found':
            return (
                <span className="flex items-center gap-1 text-[var(--color-text-muted)] bg-[var(--color-text-muted)]/10 px-2 py-0.5 rounded-full">
                    <AlertTriangle className="h-3 w-3" /> Not Found
                </span>
            )
        case 'active':
        default:
            return (
                <span className="text-[var(--color-success)] bg-[var(--color-success)]/10 px-2 py-0.5 rounded-full">
                    Active
                </span>
            )
    }
}



export function TableRow({ repo, onClick, selected, onToggle, githubToken }: {
    repo: Repository;
    onClick: () => void;
    selected: boolean;
    onToggle: () => void;
    githubToken: string | null;
}) {
    const { data, removeRepository, syncRepository, syncingRepoIds, syncErrors, isOnline } = useStore()
    const tags = repo.tags.map((id) => data.tags[id]).filter(Boolean)
    const isSyncing = syncingRepoIds.includes(repo.id)
    const syncError = syncErrors[repo.id]
    const hasError = !!syncError
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

    // Star Diff
    const starDiff = repo.prev_stars !== undefined ? repo.stars - repo.prev_stars : 0

    // Unread Push
    const isUnread = repo.last_push_at && (!repo.last_viewed_at || new Date(repo.last_push_at).getTime() > repo.last_viewed_at)

    return (
        <div
            onClick={onClick}
            className={`group flex flex-col border-b border-[var(--color-border)]/50 px-4 py-3 text-sm transition-colors cursor-pointer relative ${selected ? 'bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10' : 'hover:bg-[var(--color-surface-2)]'}`}
        >
            {/* Main Columns Row */}
            <div className="flex items-center w-full">
                {/* Checkbox */}
                <div className="w-10 flex items-center justify-center shrink-0" onClick={(e) => e.stopPropagation()}>
                    <input
                        type="checkbox"
                        checked={selected}
                        onChange={onToggle}
                        className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                    />
                </div>

                {/* Name & Description */}
                <div className="flex-[3] min-w-0 flex flex-col justify-center">
                    <div className="flex items-center">
                        <span className="text-[var(--color-text)] font-medium truncate">{repo.owner}/{repo.name}</span>
                        {tags.length > 0 && (
                            <div className="flex gap-1 shrink-0">
                                {tags.slice(0, 3).map((tag) => (
                                    <span key={tag.id} className="flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border" style={{ backgroundColor: `${tag.color}10`, color: tag.color, borderColor: `${tag.color}30` }}>
                                        <TagIcon className="h-2 w-2" />{tag.name}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    {repo.description && (
                        <p className="text-xs text-[var(--color-text-subtle)] truncate mt-0.5 max-w-[95%]">
                            {repo.description}
                        </p>
                    )}
                </div>

                {/* Status */}
                <div className="w-24 text-[10px] font-medium flex items-center shrink-0">
                    <StatusBadge status={repo.status as RepoStatus} />
                </div>

                {/* Stars & Diff */}
                <div className="w-24 text-[var(--color-text-muted)] font-mono text-xs flex items-center shrink-0" title={repo.type === 'profile' ? "Followers" : "Stars"}>
                    <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 text-[var(--color-warning)]" />
                        {formatStars(repo.stars)} {repo.type === 'profile' && 'Followers'}
                    </div>
                    {starDiff !== 0 && (
                        <span className={`text-[10px] ${starDiff > 0 ? 'text-[var(--color-success)]' : 'text-[var(--color-danger)]'}`}>
                            {starDiff > 0 ? '↑' : '↓'}{formatStars(Math.abs(starDiff))}
                        </span>
                    )}
                </div>

                {/* Language */}
                <div className="w-24 flex items-center shrink-0">
                    <LanguageBar languages={repo.languages} language={repo.language} mode="dots" />
                    {!repo.language && (!repo.languages || Object.keys(repo.languages).length === 0) && (
                        <span className="text-[var(--color-text-subtle)] text-xs">—</span>
                    )}
                </div>

                {/* Added */}
                <div className="w-24 text-[var(--color-text-muted)] text-xs flex items-center shrink-0">
                    {formatDate(repo.added_at)}
                </div>

                {/* Last Push */}
                <div className="w-24 text-[var(--color-text-muted)] text-xs flex items-center gap-1 shrink-0">
                    {isUnread && <div className="h-2 w-2 rounded-full bg-[var(--color-danger)] shrink-0 animate-pulse" title="Updated since last view" />}
                    {repo.last_push_at ? formatDate(repo.last_push_at) : '—'}
                </div>

                {/* Release */}
                <div className="w-24 text-[var(--color-text-muted)] text-xs font-mono flex items-center shrink-0" title={repo.latest_release || ''}>
                    <span className="truncate">{repo.latest_release ?? '—'}</span>
                    {repo.has_new_release && (
                        <span className="text-[9px] font-bold text-[var(--color-accent)] bg-[var(--color-accent)]/10 px-1 py-0.5 rounded uppercase tracking-wider shrink-0">
                            New
                        </span>
                    )}
                </div>

                {/* Actions (stop propagation to avoid drawer opening) */}
                <div className="w-24 flex items-center justify-end shrink-0" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center">
                        {/* Sync Button */}
                        <div className="relative group/sync">
                            <button
                                onClick={() => syncRepository(repo.id)}
                                className={`rounded p-1 transition-colors ${hasError
                                    ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                    } ${(!isOnline || !githubToken) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={isSyncing || !isOnline || !githubToken}
                                title={!githubToken ? "GitHub token required to sync" : !isOnline ? "Sync unavailable offline" : (hasError ? syncError : "Sync Repository")}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            </button>
                            {hasError && (
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-[var(--color-surface)] border border-[var(--color-danger)] rounded shadow-lg z-50 hidden group-hover/sync:block">
                                    <p className="text-[10px] text-[var(--color-danger)] break-words leading-tight">
                                        {syncError}
                                    </p>
                                </div>
                            )}
                        </div>

                        <a href={repo.url} target="_blank" rel="noopener noreferrer" className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)]" title="Open in GitHub">
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                        <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-danger)]" title="Delete Repository">
                            <Trash2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                    <TagEditor repoId={repo.id} currentTags={repo.tags} />
                </div>
            </div>

            {/* Topics Row (Full Width) */}
            {repo.topics && repo.topics.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 pl-12 pr-4 relative">
                    {/* Decorator line to connect to description */}
                    <div className="absolute top-0 left-6 w-0.5 h-2 bg-[var(--color-border)]/50 -translate-y-full" />

                    {repo.topics.map(topic => (
                        <span key={topic} className="px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-xs text-[var(--color-accent)]">
                            {topic}
                        </span>
                    ))}
                </div>
            )}

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

interface TableViewProps {
    repos: Repository[]
    selectedIds: Set<string> | null
    onToggle: ((repoId: string) => void) | undefined
    onToggleAll: (() => void) | undefined
}

export function TableView({ repos, selectedIds, onToggle, onToggleAll }: TableViewProps) {
    const { sortField, sortDir, setSortField, setSortDir, markAsViewed, githubToken } = useStore()
    const parentRef = useRef<HTMLDivElement>(null)
    const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null)

    // Virtualization
    const virtualizer = useVirtualizer({
        count: repos.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 64, // Increased height for description
        overscan: 10,
    })

    const handleSort = (field: SortField) => {
        if (sortField === field) {
            setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDir('asc')
        }
    }

    const handleRowClick = (repoId: string) => {
        if (!githubToken) return
        markAsViewed(repoId)
        setSelectedRepoId(repoId)
    }

    const SortIcon = ({ field }: { field: SortField }) => {
        if (sortField !== field) return <ChevronsUpDown className="h-3 w-3 opacity-30" />
        return sortDir === 'asc'
            ? <ChevronUp className="h-3 w-3 text-[var(--color-accent)]" />
            : <ChevronDown className="h-3 w-3 text-[var(--color-accent)]" />
    }

    // Check if all displayed repos are selected
    const allSelected = repos.length > 0 && repos.every(r => selectedIds?.has(r.id))
    const someSelected = selectedIds && selectedIds.size > 0 && !allSelected

    return (
        <>
            <div className="flex flex-col flex-1 min-h-0 bg-[var(--color-bg)]">
                {/* Header */}
                <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider z-10 w-full">
                    <div className="w-10 flex items-center justify-center">
                        <input
                            type="checkbox"
                            checked={allSelected}
                            ref={input => { if (input) input.indeterminate = !!someSelected }}
                            onChange={onToggleAll}
                            className="h-4 w-4 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                        />
                    </div>

                    {/* Repository Name */}
                    <button
                        onClick={() => handleSort('name')}
                        className={`flex items-center gap-1 hover:text-[var(--color-text)] transition-colors flex-[3]`}
                    >
                        Repository
                        <SortIcon field={'name'} />
                    </button>

                    <button
                        onClick={() => handleSort('status')}
                        className={`flex items-center gap-1 hover:text-[var(--color-text)] transition-colors w-24`}
                    >
                        Status
                        <SortIcon field={'status'} />
                    </button>

                    <button
                        onClick={() => handleSort('stars')}
                        className={`flex items-center gap-1 hover:text-[var(--color-text)] transition-colors w-24`}
                    >
                        Stars
                        <SortIcon field={'stars'} />
                    </button>

                    <button
                        onClick={() => handleSort('language')}
                        className={`flex items-center gap-1 hover:text-[var(--color-text)] transition-colors w-24`}
                    >
                        Language
                        <SortIcon field={'language'} />
                    </button>

                    <button
                        onClick={() => handleSort('added_at')}
                        className={`flex items-center gap-1 hover:text-[var(--color-text)] transition-colors w-24`}
                    >
                        Added
                        <SortIcon field={'added_at'} />
                    </button>

                    <button
                        onClick={() => handleSort('last_push_at')}
                        className={`flex items-center gap-1 hover:text-[var(--color-text)] transition-colors w-24`}
                    >
                        Last Push
                        <SortIcon field={'last_push_at'} />
                    </button>

                    <button
                        onClick={() => handleSort('latest_release')}
                        className={`flex items-center gap-1 hover:text-[var(--color-text)] transition-colors w-24`}
                    >
                        Release
                        <SortIcon field={'latest_release'} />
                    </button>

                    <div className="w-24" /> {/* Actions spacer */}
                </div>

                {/* Rows */}
                <div ref={parentRef} className="flex-1 overflow-y-auto w-full">
                    <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
                        {virtualizer.getVirtualItems().map((vItem) => {
                            const repo = repos[vItem.index]
                            return (
                                <div
                                    key={vItem.key}
                                    data-index={vItem.index}
                                    ref={virtualizer.measureElement}
                                    style={{ position: 'absolute', top: 0, left: 0, right: 0, transform: `translateY(${vItem.start}px)` }}
                                >
                                    <TableRow
                                        repo={repo}
                                        onClick={() => handleRowClick(repo.id)}
                                        selected={selectedIds?.has(repo.id) ?? false}
                                        onToggle={() => onToggle?.(repo.id)}
                                        githubToken={githubToken}
                                    />
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>

            {/* Drawer */}
            {selectedRepoId && (
                <RepoDrawer
                    repoId={selectedRepoId}
                    onClose={() => setSelectedRepoId(null)}
                />
            )}
        </>
    )
}
