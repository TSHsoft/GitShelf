import React, { useState, useRef, useMemo } from 'react'
import { Star, ExternalLink, Trash2, Tag as TagIcon, Archive, RefreshCw, Heart, FolderInput, MoreHorizontal, User, Building2, Book, Users, AlertTriangle, BookOpen, StickyNote, Folder as FolderIcon } from 'lucide-react'
import type { Repository, Tag } from '@/types'
import { useStore } from '@/store/useStore'
import { formatStars } from '@/lib/github'
import { formatDate } from '@/lib/utils'
import { TagEditModal } from './TagEditModal'
import { LanguageBar } from './LanguageBar'
import { ConfirmDialog } from './ConfirmDialog'
import { FolderSelectDialog } from './FolderSelectDialog'
import { PortalMenu } from './PortalMenu'
import { EditNoteDialog } from './EditNoteDialog'
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
    const { allTags, allFolders, removeRepository, syncRepository, toggleFavorite, syncingRepoIds, syncErrors, isOnline, githubToken, markAsViewed, setActiveRepoId } = useStore(useShallow((state: GitShelfStore) => ({
        allTags: state.data.tags,
        allFolders: state.data.folders,
        removeRepository: state.removeRepository,
        syncRepository: state.syncRepository,
        toggleFavorite: state.toggleFavorite,
        syncingRepoIds: state.syncingRepoIds,
        syncErrors: state.syncErrors,
        isOnline: state.isOnline,
        githubToken: state.githubToken,
        markAsViewed: state.markAsViewed,
        setActiveRepoId: state.setActiveRepoId,
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
    const [showNoteEditor, setShowNoteEditor] = useState(false)
    
    const isSyncing = syncingRepoIds.includes(repo.id)
    const syncError = syncErrors?.[repo.id]
    const hasError = !!syncError
    const folder = repo.folder_id ? allFolders[repo.folder_id] : null
    const isUnread = repo.last_push_at && (!repo.last_viewed_at || new Date(repo.last_push_at).getTime() > repo.last_viewed_at)

    const statusBadge = useMemo(() => {
        if (repo.status === 'deleted') return <span className="flex items-center gap-1 text-xs text-[var(--color-danger)]"><AlertTriangle className="h-3 w-3" />Deleted</span>
        if (repo.status === 'renamed') return <span className="flex items-center gap-1 text-xs text-blue-500"><RefreshCw className="h-3 w-3" />Renamed</span>
        if (repo.status === 'archived') return <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]"><Archive className="h-3 w-3" />Archived</span>
        return null
    }, [repo.status])

    const topics = repo.topics ?? []

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
            {/* Header Row: Icon + Name + Action Buttons */}
            <div className="flex items-start justify-between gap-2">
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
                            {repo.is_favorite && <Heart className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
                            {statusBadge}
                        </div>
                        <span className="text-[11px] text-[var(--color-text-muted)] truncate mt-1">
                            {repo.owner}
                        </span>
                    </div>
                </div>

                {/* Action Buttons — aligned with TableView */}
                {!readonly && (
                    <div className="flex items-center shrink-0" onClick={(e) => e.stopPropagation()}>
                        {/* View Details */}
                        <button
                            onClick={(e) => { e.stopPropagation(); if (githubToken) setActiveRepoId(repo.id) }}
                            className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] transition-colors"
                            title="View Details"
                        >
                            <BookOpen className="h-3.5 w-3.5" />
                        </button>

                        {/* Sync */}
                        <div className="relative group/sync">
                            <button
                                onClick={(e) => { e.stopPropagation(); syncRepository(repo.id) }}
                                className={`rounded p-1 transition-colors ${hasError
                                    ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                    } ${(!isOnline || !githubToken || useStore.getState().isSyncing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                                disabled={isSyncing || !isOnline || !githubToken || useStore.getState().isSyncing}
                                title={!githubToken ? 'GitHub token required' : !isOnline ? 'Offline' : hasError ? syncError : 'Sync'}
                            >
                                <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                            </button>
                            {hasError && (
                                <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-[var(--color-surface)] border border-[var(--color-danger)] rounded shadow-lg z-50 hidden group-hover/sync:block">
                                    <p className="text-[10px] text-[var(--color-danger)] break-words leading-tight">{syncError}</p>
                                </div>
                            )}
                        </div>

                        {/* Favorite */}
                        <button
                            onClick={(e) => { e.stopPropagation(); toggleFavorite(repo.id) }}
                            className={`rounded p-1 transition-colors ${repo.is_favorite
                                ? 'text-rose-500 hover:text-rose-600'
                                : 'text-[var(--color-text-muted)] hover:text-rose-500'}`}
                            title={repo.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
                        >
                            <Heart className={`h-3.5 w-3.5`} />
                        </button>

                        {/* Open on GitHub */}
                        <a
                            href={repo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => { e.stopPropagation(); markAsViewed(repo.id) }}
                            className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                            title="Open on GitHub"
                        >
                            <ExternalLink className="h-3.5 w-3.5" />
                        </a>

                        {/* More */}
                        <button
                            ref={menuTriggerRef}
                            onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                            className={`rounded p-1 transition-colors ${showMenu ? 'bg-[var(--color-surface-3)] text-[var(--color-text)]' : 'text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)]'}`}
                            title="More actions"
                        >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                        </button>

                        {/* Unread indicator */}
                        {isUnread && <div className="h-2 w-2 rounded-full bg-[var(--color-danger)] animate-pulse ml-1" title="Updated since last view" />}
                    </div>
                )}
            </div>

            {/* Description */}
            {repo.description && (
                <p className="text-xs text-[var(--color-text-subtle)] line-clamp-2 leading-relaxed">
                    {repo.description}
                </p>
            )}

            {/* Topics & Folder (replacing Tags) */}
            <div className="flex flex-wrap items-center gap-1.5 min-h-[22px]">
                {folder && (
                    <span 
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border"
                        style={{
                            backgroundColor: folder.color ? `${folder.color}15` : 'var(--color-surface-2)',
                            color: folder.color || 'var(--color-text-muted)',
                            borderColor: folder.color ? `${folder.color}30` : 'var(--color-border)'
                        }}
                        title="Folder"
                    >
                        <FolderIcon className="h-2.5 w-2.5 shrink-0" style={{ fill: folder.color ? `${folder.color}40` : 'transparent' }} />
                        {folder.name}
                    </span>
                )}
                {topics.length > 0 ? (
                    topics.slice(0, 5).map((topic) => (
                        <span
                            key={topic}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border bg-[var(--color-accent)]/10 border-[var(--color-accent)]/20 text-[var(--color-accent)]"
                        >
                            {topic}
                        </span>
                    ))
                ) : (
                    !folder && <span className="text-[10px] text-[var(--color-text-subtle)] italic opacity-50">No topics or folder</span>
                )}
                {topics.length > 5 && (
                    <span className="text-[10px] text-[var(--color-text-subtle)]">+{topics.length - 5}</span>
                )}
            </div>

            {/* Note */}
            {repo.note && (
                <p className="text-xs text-orange-400 leading-relaxed flex items-start gap-1.5">
                    <StickyNote className="h-3 w-3 mt-0.5 shrink-0 text-orange-400" />
                    {repo.note}
                </p>
            )}

            {/* Footer: Language + Date */}
            <div className="flex items-center justify-between border-t border-[var(--color-border)]/50 pt-3 mt-1">
                <div className="flex items-center gap-4 text-[11px] text-[var(--color-text-muted)]">
                    <div className="flex items-center gap-1.5" title={repo.type === 'profile' ? 'Followers' : 'Stars'}>
                        {repo.type === 'profile' ? <Users className="h-3.5 w-3.5 text-orange-500" /> : <Star className="h-3.5 w-3.5 text-orange-500" />}
                        <span className="font-medium">{formatStars(repo.stars)}</span>
                    </div>
                    {repo.language && (
                        <div className="flex items-center gap-1.5">
                            <LanguageBar languages={repo.languages} language={repo.language} mode="dots" />
                        </div>
                    )}
                    {/* Tags (small row in footer) */}
                    {tags.length > 0 && (
                        <div className="flex items-center gap-1">
                            {tags.slice(0, 3).map(tag => (
                                <span key={tag.id} className="inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-medium border" style={{ backgroundColor: `${tag.color}10`, color: tag.color, borderColor: `${tag.color}20` }}>
                                    <TagIcon className="h-2 w-2" />{tag.name}
                                </span>
                            ))}
                            {tags.length > 3 && <span className="text-[9px] text-[var(--color-text-subtle)]">+{tags.length - 3}</span>}
                        </div>
                    )}
                </div>
                <div className="text-[11px] text-[var(--color-text-subtle)] font-medium tabular-nums">
                    {formatDate(repo.last_push_at || repo.added_at)}
                </div>
            </div>

            {/* Portal Menu */}
            {showMenu && (
                <PortalMenu
                    triggerRef={menuTriggerRef}
                    onClose={() => setShowMenu(false)}
                >
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
                    <button
                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); setShowNoteEditor(true) }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-text)] hover:bg-[var(--color-surface-2)]"
                    >
                        <StickyNote className="h-3.5 w-3.5 text-orange-400" />
                        Edit note
                    </button>
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
                    description={<>Are you sure you want to delete <strong>{repo.owner}/{repo.name}</strong>?<br/><br/>It will be moved to the Trash.</>}
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

            {showNoteEditor && (
                <EditNoteDialog
                    repoId={repo.id}
                    initialNote={repo.note}
                    onClose={() => setShowNoteEditor(false)}
                />
            )}
        </div>
    )
})
