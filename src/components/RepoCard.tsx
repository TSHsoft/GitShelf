import React, { useState, useRef } from 'react'
import { Star, ExternalLink, Trash2, Tag as TagIcon, Archive, GitBranch, AlertTriangle, RefreshCw, Heart, FolderInput, MoreHorizontal, BookOpen, User, Building2, Book, Users } from 'lucide-react'
import type { Repository } from '@/types'
import { useStore } from '@/store/useStore'
import { formatStars } from '@/lib/github'
import { formatDate } from '@/lib/utils'
import { TagEditModal } from './TagEditModal'
import { LanguageBar } from './LanguageBar'
import { ConfirmDialog } from './ConfirmDialog'
import { FolderSelectDialog } from './FolderSelectDialog'
import { PortalMenu } from './PortalMenu'
import { useDraggable } from '@dnd-kit/core'

interface RepoCardProps {
    repo: Repository
    isActive: boolean
    onClick: () => void
    selected?: boolean
    selectedIds?: string[]
}

export const RepoCard = React.memo(function RepoCard({ repo, isActive, onClick, selected, selectedIds }: RepoCardProps) {
    const { data, removeRepository, syncRepository, toggleFavorite, syncingRepoIds, githubToken, markAsViewed } = useStore()
    const tags = repo.tags.map((id) => data.tags[id]).filter(Boolean)

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: repo.id,
        data: {
            type: 'repository',
            repoId: repo.id,
            selectedIds: selected ? selectedIds : [repo.id]
        }
    })
    const menuTriggerRef = useRef<HTMLButtonElement>(null)
    const [isExpanded, setIsExpanded] = useState(false)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showFolderSelect, setShowFolderSelect] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [showTagEditor, setShowTagEditor] = useState(false)
    const isSyncing = syncingRepoIds.includes(repo.id)
    const isUnread = repo.last_push_at && (!repo.last_viewed_at || new Date(repo.last_push_at).getTime() > repo.last_viewed_at)

    const statusBadge = repo.status === 'deleted'
        ? <span className="flex items-center gap-1 text-xs text-[var(--color-danger)]"><AlertTriangle className="h-3 w-3" />Deleted</span>
        : repo.status === 'renamed'
            ? <span className="text-xs text-[var(--color-warning)]">Renamed</span>
            : null

    return (
        <div
            ref={setNodeRef}
            {...attributes}
            {...listeners}
            className={`group relative flex flex-col gap-2.5 rounded-xl border p-4 transition-all duration-150 ${isActive
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-lg shadow-blue-500/5'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)]/40 hover:bg-[var(--color-surface-2)]'
                } ${repo.status === 'deleted' ? 'opacity-60' : ''} ${isDragging ? 'opacity-50' : ''}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                        <p className="text-xs text-[var(--color-text-muted)] truncate">{repo.owner}</p>
                        {repo.archived && <Archive className="h-3 w-3 text-[var(--color-warning)] shrink-0" />}
                    </div>
                    <div className="flex items-center gap-1.5 truncate leading-tight">
                        {repo.type === 'profile' ? (
                            repo.profile_type === 'org'
                                ? <Building2 className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                : <User className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                        ) : <Book className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />}
                        <h3 className="text-sm font-semibold text-[var(--color-text)] truncate">{repo.name}</h3>
                    </div>
                    {statusBadge}
                </div>
                {/* Actions — always show sync, fav, external, and an overflow menu */}
                <div className="flex items-center gap-0.5 shrink-0">
                    <button
                        onClick={(e) => { e.stopPropagation(); onClick() }}
                        className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                        title="View Details"
                    >
                        <BookOpen className="h-3.5 w-3.5" />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); syncRepository(repo.id) }}
                        className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors ${(!githubToken || useStore.getState().isSyncing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={isSyncing || !githubToken || useStore.getState().isSyncing}
                        title={!githubToken ? "GitHub token required to sync" : useStore.getState().isSyncing ? "Global sync in progress" : "Sync Repository"}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(repo.id) }}
                        className={`rounded p-1 transition-colors ${repo.is_favorite
                            ? 'text-rose-500 hover:text-rose-600'
                            : 'text-[var(--color-text-muted)] hover:text-rose-500'}`}
                        title={repo.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                    >
                        <Heart className={`h-3.5 w-3.5 ${repo.is_favorite ? 'fill-current' : ''}`} />
                    </button>
                    <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => {
                            e.stopPropagation();
                            markAsViewed(repo.id);
                        }}
                        className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        title="Open in GitHub"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                    </a>

                    <div className="relative">
                        <button
                            ref={menuTriggerRef}
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                            className={`rounded p-1 transition-colors ${showMenu ? 'bg-[var(--color-surface-3)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'}`}
                            title="More actions"
                        >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>

                        {showMenu && (
                            <PortalMenu
                                triggerRef={menuTriggerRef}
                                onClose={() => setShowMenu(false)}
                            >
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowFolderSelect(true) }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                                    disabled={useStore.getState().isSyncing}
                                >
                                    <FolderInput className="h-3.5 w-3.5" />
                                    Move to folder
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowTagEditor(true) }}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                                    disabled={useStore.getState().isSyncing}
                                >
                                    <TagIcon className="h-3.5 w-3.5" />
                                    Edit tags
                                </button>
                                <div className="my-1 border-t border-[var(--color-border)]" />
                                <button
                                    onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowDeleteConfirm(true) }}
                                    disabled={useStore.getState().isSyncing}
                                    className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete repo
                                </button>
                            </PortalMenu>
                        )}
                    </div>
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
                    {repo.type === 'profile' ? <Users className="h-3 w-3" /> : <Star className="h-3 w-3" />}
                    <span>{formatStars(repo.stars)}</span>
                </div>
                {repo.latest_release && (
                    <div className="flex items-center gap-1 text-[var(--color-success)]" title="Latest Release">
                        <GitBranch className="h-3 w-3" />
                        <span>{repo.latest_release}</span>
                    </div>
                )}
                <div className="ml-auto flex items-center gap-1.5" title="Last Push">
                    {isUnread && <div className="h-2 w-2 rounded-full bg-[var(--color-danger)] animate-pulse" />}
                    <span>{formatDate(repo.last_push_at || repo.added_at)}</span>
                </div>
            </div>

            {showDeleteConfirm && (
                <ConfirmDialog
                    isOpen={showDeleteConfirm}
                    title="Delete Repo"
                    description={<>Are you sure you want to delete <strong>{repo.owner}/{repo.name}</strong>?<br/><br/>This action cannot be undone.</>}
                    variant="danger"
                    confirmLabel="Delete"
                    onConfirm={() => removeRepository(repo.id)}
                    onClose={() => setShowDeleteConfirm(false)}
                />
            )}

            {showFolderSelect && (
                <FolderSelectDialog
                    repoIds={[repo.id]}
                    onClose={() => setShowFolderSelect(false)}
                />
            )}

            {showTagEditor && (
                <TagEditModal
                    repoId={repo.id}
                    initialTags={repo.tags}
                    onClose={() => setShowTagEditor(false)}
                />
            )}
        </div>
    )
})
