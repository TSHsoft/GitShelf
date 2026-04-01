import React, { useState, useRef, useMemo } from 'react'
import { Star, ExternalLink, Trash2, Tag as TagIcon, Archive, RefreshCw, Heart, FolderInput, MoreHorizontal, User, Building2, Book, Users, AlertTriangle } from 'lucide-react'
import type { Repository, Tag } from '@/types'
import { useStore } from '@/store/useStore'
import { formatStars } from '@/lib/github'
import { formatDate } from '@/lib/utils'
import { TagEditModal } from './TagEditModal'
import { LanguageBar } from './LanguageBar'
import { ConfirmDialog } from './ConfirmDialog'
import { FolderSelectDialog } from './FolderSelectDialog'
import { PortalMenu } from './PortalMenu'
import { useDraggable } from '@dnd-kit/core'
import { useShallow } from 'zustand/react/shallow'
import type { GitShelfStore } from '@/store/types'

interface RepoCardProps {
    repo: Repository
    isActive: boolean
    onClick: () => void
    selected?: boolean
    selectedIds?: string[]
    readonly?: boolean
}

export const RepoCard = React.memo(function RepoCard({ repo, isActive, onClick, selected, selectedIds, readonly }: RepoCardProps) {
    const { allTags, removeRepository, syncRepository, toggleFavorite, syncingRepoIds, githubToken, markAsViewed } = useStore(useShallow((state: GitShelfStore) => ({
        allTags: state.data.tags,
        removeRepository: state.removeRepository,
        syncRepository: state.syncRepository,
        toggleFavorite: state.toggleFavorite,
        syncingRepoIds: state.syncingRepoIds,
        githubToken: state.githubToken,
        markAsViewed: state.markAsViewed
    })))

    const tags = useMemo(() => 
        repo.tags.map((id) => allTags[id]).filter((t): t is Tag => !!t), 
        [repo.tags, allTags]
    )

    const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
        id: repo.id,
        data: {
            type: 'repository',
            repoId: repo.id,
            selectedIds: selected ? selectedIds : [repo.id]
        }
    })
    
    const menuTriggerRef = useRef<HTMLButtonElement>(null)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showFolderSelect, setShowFolderSelect] = useState(false)
    const [showMenu, setShowMenu] = useState(false)
    const [showTagEditor, setShowTagEditor] = useState(false)
    
    const isSyncing = syncingRepoIds.includes(repo.id)
    const isUnread = repo.last_push_at && (!repo.last_viewed_at || new Date(repo.last_push_at).getTime() > repo.last_viewed_at)

    const statusBadge = useMemo(() => {
        if (repo.status === 'deleted') return <span className="flex items-center gap-1 text-xs text-[var(--color-danger)]"><AlertTriangle className="h-3 w-3" />Deleted</span>
        if (repo.status === 'renamed') return <span className="flex items-center gap-1 text-xs text-blue-500"><RefreshCw className="h-3 w-3" />Renamed</span>
        if (repo.status === 'archived') return <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]"><Archive className="h-3 w-3" />Archived</span>
        return null
    }, [repo.status])

    return (
        <div
            ref={readonly ? undefined : setNodeRef}
            {...(readonly ? {} : attributes)}
            {...(readonly ? {} : listeners)}
            className={`repo-card group relative flex flex-col gap-2.5 rounded-xl border p-4 transition-[border-color,background-color,box-shadow,opacity] duration-150 ${isActive
                ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/5 shadow-lg shadow-blue-500/5'
                : 'border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-text-muted)]/40 hover:bg-[var(--color-surface-2)]'
                } ${repo.status === 'deleted' ? 'opacity-60' : ''} ${isDragging ? 'opacity-50' : ''}`}
            onClick={onClick}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex flex-1 items-center gap-2.5 min-w-0">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-surface-2)] border border-[var(--color-border)] text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors">
                        {repo.type === 'profile' ? (
                            repo.profile_type === 'org'
                                ? <Building2 className="h-5 w-5" />
                                : <User className="h-5 w-5" />
                        ) : <Book className="h-5 w-5" />}
                    </div>
                    <div className="flex flex-1 flex-col min-w-0">
                        <div className="flex items-center gap-2 leading-none">
                            <span className="text-sm font-bold text-[var(--color-text)] truncate group-hover:text-[var(--color-accent)] transition-colors">
                                {repo.name}
                            </span>
                            {repo.is_favorite && <Heart className="h-3.5 w-3.5 fill-rose-500 text-rose-500 shrink-0" />}
                            {statusBadge}
                        </div>
                        <span className="text-[11px] text-[var(--color-text-muted)] truncate mt-1">
                            {repo.owner}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {!readonly && (
                        <button
                            ref={menuTriggerRef}
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                            className={`p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-[var(--color-surface-3)] ${showMenu ? 'opacity-100 bg-[var(--color-surface-3)]' : ''}`}
                        >
                            <MoreHorizontal className="h-4 w-4 text-[var(--color-text-muted)]" />
                        </button>
                    )}
                    {isUnread && <div className="h-2 w-2 rounded-full bg-[var(--color-danger)] animate-pulse" title="Updated since last view" />}
                </div>
            </div>

            {repo.description && (
                <p className="text-xs text-[var(--color-text-subtle)] line-clamp-2 leading-relaxed h-[34px]">
                    {repo.description}
                </p>
            )}

            <div className="flex flex-wrap gap-1.5 min-h-[22px]">
                {tags.length > 0 ? (
                    tags.slice(0, 5).map((tag) => (
                        <span
                            key={tag.id}
                            className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border"
                            style={{ 
                                backgroundColor: `${tag.color}10`, 
                                color: tag.color,
                                borderColor: `${tag.color}20`
                            }}
                        >
                            <TagIcon className="h-2.5 w-2.5" />
                            {tag.name}
                        </span>
                    ))
                ) : (
                    <span className="text-[10px] text-[var(--color-text-subtle)] italic opacity-50">No tags</span>
                )}
                {tags.length > 5 && (
                    <span className="text-[10px] text-[var(--color-text-subtle)]">+{tags.length - 5}</span>
                )}
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-border)]/50 pt-3 mt-1">
                <div className="flex items-center gap-4 text-[11px] text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-1.5" title={repo.type === 'profile' ? "Followers" : "Stars"}>
                        {repo.type === 'profile' ? <Users className="h-3.5 w-3.5 text-orange-500" /> : <Star className="h-3.5 w-3.5 text-orange-500" />}
                        <span className="font-medium">{formatStars(repo.stars)}</span>
                    </div>
                    {repo.language && (
                        <div className="flex items-center gap-1.5">
                            <LanguageBar languages={repo.languages} language={repo.language} mode="dots" />
                        </div>
                    )}
                </div>
                <div className="text-[11px] text-[var(--color-text-subtle)] font-medium tabular-nums">
                    {formatDate(repo.last_push_at || repo.added_at)}
                </div>
            </div>

            {showMenu && (
                <PortalMenu
                    triggerRef={menuTriggerRef}
                    onClose={() => setShowMenu(false)}
                >
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); syncRepository(repo.id) }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                        disabled={isSyncing || !githubToken}
                    >
                        <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        Sync repository
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); toggleFavorite(repo.id) }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                    >
                        <Heart className={`h-3.5 w-3.5 ${repo.is_favorite ? 'fill-current text-rose-500' : ''}`} />
                        {repo.is_favorite ? 'Remove from favorites' : 'Add to favorites'}
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowFolderSelect(true) }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                    >
                        <FolderInput className="h-3.5 w-3.5" />
                        Move to folder
                    </button>
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowTagEditor(true) }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                    >
                        <TagIcon className="h-3.5 w-3.5" />
                        Edit tags
                    </button>
                    <a
                        href={repo.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); markAsViewed(repo.id) }}
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open on GitHub
                    </a>
                    <div className="my-1 border-t border-[var(--color-border)]" />
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowDeleteConfirm(true) }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete repository
                    </button>
                </PortalMenu>
            )}

            {showDeleteConfirm && (
                <ConfirmDialog
                    isOpen={showDeleteConfirm}
                    title="Delete Repository"
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
