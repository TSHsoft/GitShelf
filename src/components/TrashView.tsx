import React, { useState } from 'react'
import { Trash2, RotateCcw, X, AlertTriangle, CalendarX, Building2, User, Book, Star, Users, Folder as FolderIcon } from 'lucide-react'
import type { TrashedRepo } from '@/types'
import { useStore } from '@/store/useStore'
import { ConfirmDialog } from './ConfirmDialog'
import { formatDate } from '@/lib/utils'
import { LanguageBar } from './LanguageBar'
import { formatStars } from '@/lib/github'
import type { RepoStatus } from '@/types'

function StatusBadge({ status }: { status: RepoStatus }) {
    if (status === 'deleted') return <span className="text-[var(--color-danger)] font-medium">Deleted</span>
    if (status === 'renamed') return <span className="text-blue-500 font-medium">Renamed</span>
    if (status === 'archived') return <span className="text-[var(--color-text-muted)] font-medium">Archived</span>
    return <span className="text-[var(--color-text-muted)]">—</span>
}

function TrashItemTableView({ item, selected, folder, onToggle, onRestore, onPurge, existsInDatabase }: {
    item: TrashedRepo
    selected: boolean
    folder?: { name: string, color?: string } | null
    onToggle: () => void
    onRestore: (item: TrashedRepo) => void
    onPurge: (item: TrashedRepo) => void
    existsInDatabase?: boolean
}) {
    const { repo } = item
    const [now] = useState(() => Date.now())
    const daysAgo = Math.floor((now - item.deletedAt) / (1000 * 60 * 60 * 24))

    return (
        <div className={`group flex flex-col border-b border-[var(--color-border)]/50 px-4 py-3 text-sm transition-colors relative 
            ${selected 
                ? 'bg-[var(--color-accent)]/5 hover:bg-[var(--color-accent)]/10' 
                : existsInDatabase 
                    ? 'bg-amber-500/5 dark:bg-amber-500/10 hover:bg-amber-500/10 border-l-2 border-l-amber-500/50' 
                    : 'hover:bg-[var(--color-surface-2)]'
            }`}
        >
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
                    <div className="flex items-center gap-1.5">
                        {repo.type === 'profile' ? (
                            repo.profile_type === 'org'
                                ? <Building2 className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                                : <User className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                        ) : <Book className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />}
                        <span className="text-[var(--color-text)] font-medium truncate">{repo.owner}/{repo.name}</span>
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

                {/* Stars */}
                <div className="w-24 text-[var(--color-text-muted)] font-mono text-xs flex items-center shrink-0" title={repo.type === 'profile' ? "Followers" : "Stars"}>
                    <div className="flex items-center gap-1">
                        {repo.type === 'profile' ? <Users className="h-3 w-3 text-[var(--color-warning)]" /> : <Star className="h-3 w-3 text-[var(--color-warning)]" />}
                        {formatStars(repo.stars)}
                    </div>
                </div>

                {/* Language */}
                <div className="w-48 px-4 flex items-center shrink-0">
                    <LanguageBar languages={repo.languages} language={repo.language} mode="dots" />
                    {!repo.language && (!repo.languages || Object.keys(repo.languages).length === 0) && (
                        <span className="text-[var(--color-text-subtle)] text-xs">—</span>
                    )}
                </div>

                {/* Added */}
                <div className="w-24 text-[var(--color-text-muted)] text-xs flex items-center shrink-0">
                    {formatDate(repo.added_at)}
                </div>

                {/* Deleted Date (Replaces Last Push) */}
                <div className="w-24 text-[var(--color-danger)] text-xs flex items-center gap-1 shrink-0 font-medium">
                    <CalendarX className="h-3 w-3 opacity-70" />
                    {daysAgo === 0 ? 'Today' : `${daysAgo}d ago`}
                </div>

                {/* Release */}
                <div className="w-16 pr-2 text-[var(--color-text-muted)] text-xs font-mono flex items-center shrink-0">
                    <span className="truncate min-w-0">{repo.latest_release ?? '—'}</span>
                </div>

                {/* Actions */}
                <div className="w-[112px] flex items-center justify-end shrink-0 gap-1">
                    <button
                        onClick={() => onRestore(item)}
                        className="rounded p-1.5 text-[var(--color-text-muted)] hover:text-[var(--color-accent)] hover:bg-[var(--color-accent)]/10 transition-colors"
                        title="Restore to shelf"
                    >
                        <RotateCcw className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => onPurge(item)}
                        className="rounded p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-danger)] hover:text-[var(--color-danger)] transition-colors"
                        title="Delete permanently"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {/* Topics & Folder Row */}
            {(folder || (repo.topics && repo.topics.length > 0)) && (
                <div className="flex flex-wrap items-center gap-1 mt-2 pl-12 pr-4 relative min-h-[22px]">
                    <div className="absolute top-0 left-6 w-0.5 h-2 bg-[var(--color-border)]/50 -translate-y-full" />
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

                    {repo.topics?.map(topic => (
                        <span key={topic} className="px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-xs text-[var(--color-accent)]">
                            {topic}
                        </span>
                    ))}
                </div>
            )}

            {/* Note Row */}
            {repo.note && (
                <div className="flex items-start pl-12 pr-4 mt-1">
                    <p className="text-[10px] text-orange-400 leading-relaxed">{repo.note}</p>
                </div>
            )}
        </div>
    )
}

export const TrashView = React.memo(function TrashView() {
    const { data, restoreTrashItem, removeTrashItem, emptyTrash } = useStore()
    const retentionDays = data.settings.trash_retention_days ?? 30

    const trashDict = data.trash || {}
    const items = Object.values(trashDict).sort((a, b) => b.deletedAt - a.deletedAt)

    const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set())
    
    // For confirm dialogs
    const [confirmAction, setConfirmAction] = useState<{
        isOpen: boolean
        title: string
        description: React.ReactNode
        variant: 'danger' | 'warning' | 'default'
        confirmLabel?: string
        onConfirm: () => void
    }>({ isOpen: false, title: '', description: '', variant: 'default', confirmLabel: 'Confirm', onConfirm: () => {} })

    const handleRestore = (item: TrashedRepo) => {
        restoreTrashItem(item.repo.id)
        setSelectedRepoIds(prev => { const n = new Set(prev); n.delete(item.repo.id); return n })
    }

    const handleBulkRestore = () => {
        for (const id of selectedRepoIds) {
            restoreTrashItem(id)
        }
        setSelectedRepoIds(new Set())
    }

    const confirmRestore = (item: TrashedRepo) => {
        setConfirmAction({
            isOpen: true,
            title: 'Restore Repository',
            description: <>Are you sure you want to restore <strong>{item.repo.owner}/{item.repo.name}</strong> to your shelf?</>,
            variant: 'default',
            confirmLabel: 'Restore',
            onConfirm: () => handleRestore(item)
        })
    }

    const confirmBulkRestore = () => {
        setConfirmAction({
            isOpen: true,
            title: 'Restore Repositories',
            description: <>Are you sure you want to restore <strong>{selectedRepoIds.size} items</strong> to your shelf?</>,
            variant: 'default',
            confirmLabel: 'Restore All',
            onConfirm: handleBulkRestore
        })
    }

    const handlePurge = (item: TrashedRepo) => {
        removeTrashItem(item.repo.id)
    }

    const handleClearAll = () => {
        emptyTrash()
        setSelectedRepoIds(new Set())
    }

    const handleBulkPurge = () => {
        for (const id of selectedRepoIds) {
            removeTrashItem(id)
        }
        setSelectedRepoIds(new Set())
    }

    const toggleSelect = (id: string) => {
        setSelectedRepoIds(prev => {
            const n = new Set(prev)
            if (n.has(id)) n.delete(id)
            else n.add(id)
            return n
        })
    }

    const toggleAll = () => {
        if (selectedRepoIds.size === items.length) setSelectedRepoIds(new Set())
        else setSelectedRepoIds(new Set(items.map(i => i.repo.id)))
    }

    const confirmPurge = (item: TrashedRepo) => {
        setConfirmAction({
            isOpen: true,
            title: 'Permanently Delete',
            description: <>Are you sure you want to permanently delete <strong>{item.repo.owner}/{item.repo.name}</strong>?<br /><br />This action cannot be undone.</>,
            variant: 'danger',
            confirmLabel: 'Delete Forever',
            onConfirm: () => handlePurge(item)
        })
    }

    const confirmBulkPurge = () => {
        setConfirmAction({
            isOpen: true,
            title: 'Permanently Delete',
            description: <>Are you sure you want to permanently delete <strong>{selectedRepoIds.size} items</strong>?<br /><br />This action cannot be undone.</>,
            variant: 'danger',
            confirmLabel: 'Delete Forever',
            onConfirm: handleBulkPurge
        })
    }

    const confirmClearAll = () => {
        setConfirmAction({
            isOpen: true,
            title: 'Empty Trash',
            description: <>This will permanently delete all <strong>{items.length}</strong> items in the trash.<br /><br />This action cannot be undone.</>,
            variant: 'danger',
            confirmLabel: 'Empty Trash',
            onConfirm: handleClearAll
        })
    }

    return (
        <div className="flex flex-1 flex-col min-h-0 bg-[var(--color-bg)]">
            <ConfirmDialog
                isOpen={confirmAction.isOpen}
                title={confirmAction.title}
                description={confirmAction.description}
                variant={confirmAction.variant}
                confirmLabel={confirmAction.confirmLabel}
                onConfirm={() => {
                    confirmAction.onConfirm()
                    setConfirmAction(prev => ({ ...prev, isOpen: false }))
                }}
                onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Toolbar (Mimic RepoList) */}
            <div className="h-[58px] flex items-center gap-2 border-b border-[var(--color-border)] px-4 shrink-0">
                {selectedRepoIds.size > 0 ? (
                    <div className="flex-1 h-full flex items-center bg-[var(--color-accent)]/10 -mx-4 px-4">
                        <div className="flex items-center gap-4 mr-4">
                            <span className="font-semibold text-[var(--color-accent)]">{selectedRepoIds.size} selected</span>
                            <div className="h-4 w-px bg-[var(--color-accent)]/20" />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={confirmBulkRestore}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--color-surface)] text-[var(--color-text)] text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-all"
                            >
                                <RotateCcw className="h-3.5 w-3.5 text-[var(--color-accent)]" /> Restore
                            </button>
                            <button
                                onClick={confirmBulkPurge}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--color-surface)] text-[var(--color-danger)] text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-danger)] hover:text-white hover:border-transparent transition-all"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete Forever
                            </button>
                        </div>
                        <div className="flex-1" />
                        <button
                            onClick={() => setSelectedRepoIds(new Set())}
                            className="p-1.5 hover:bg-[var(--color-accent)]/20 rounded text-[var(--color-accent)]"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center gap-2">
                            <Trash2 className="h-4 w-4 text-[var(--color-danger)]" />
                            <span className="text-sm font-semibold text-[var(--color-text)]">Trash</span>
                            <span className="text-[var(--color-text-muted)]">/</span>
                        </div>
                        <div className="flex flex-1 items-center gap-2 px-2 py-1.5 text-xs text-[var(--color-text-muted)] bg-[var(--color-surface-2)]/50 rounded-lg">
                            <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                            Items are automatically purged after <strong className="text-[var(--color-text)]">{retentionDays} days</strong>. Duplicate repos restored will overwrite existing ones.
                        </div>
                        <div className="flex items-center gap-2">
                            {items.length > 0 && (
                                <button
                                    onClick={confirmClearAll}
                                    className="flex h-[30px] items-center gap-1.5 rounded-lg border border-[var(--color-danger)]/20 px-3 text-xs font-semibold text-[var(--color-danger)] transition-all hover:bg-[var(--color-danger)] hover:text-white"
                                >
                                    Empty Trash
                                </button>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* List Header */}
            {items.length > 0 && (
                <div className="flex items-center w-full px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/50 text-xs font-semibold text-[var(--color-text-muted)] sticky top-0 z-10 shadow-sm backdrop-blur-sm">
                    <div className="w-10 flex justify-center shrink-0">
                        <input
                            type="checkbox"
                            checked={selectedRepoIds.size === items.length && items.length > 0}
                            ref={el => { if (el) el.indeterminate = selectedRepoIds.size > 0 && selectedRepoIds.size < items.length }}
                            onChange={toggleAll}
                            className="h-3.5 w-3.5 rounded border-[var(--color-border)] text-[var(--color-accent)] focus:ring-[var(--color-accent)]"
                        />
                    </div>
                    <div className="flex-[3] min-w-0 pr-4">Repository</div>
                    <div className="w-24 shrink-0">Status</div>
                    <div className="w-24 shrink-0">Stars</div>
                    <div className="w-48 px-4 shrink-0">Language</div>
                    <div className="w-24 shrink-0">Added</div>
                    <div className="w-24 shrink-0">Deleted</div>
                    <div className="w-16 shrink-0">Release</div>
                    <div className="w-[112px] shrink-0 text-right">Actions</div>
                </div>
            )}

            {/* List */}
            <div className="flex-1 overflow-y-auto">
                {items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-8">
                        <Trash2 className="h-10 w-10 text-[var(--color-text-muted)]/30" />
                        <p className="text-sm font-medium text-[var(--color-text-muted)]">Trash is empty</p>
                        <p className="text-xs text-[var(--color-text-subtle)]">Deleted repositories will appear here.</p>
                    </div>
                ) : (
                    <div className="flex flex-col">
                        {items.map(item => (
                            <TrashItemTableView
                                key={item.repo.id}
                                item={item}
                                selected={selectedRepoIds.has(item.repo.id)}
                                existsInDatabase={!!data.repositories[item.repo.id]}
                                folder={item.repo.folder_id ? data.folders?.[item.repo.folder_id] : null}
                                onToggle={() => toggleSelect(item.repo.id)}
                                onRestore={confirmRestore}
                                onPurge={confirmPurge}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Status bar */}
            <div className="px-4 py-1.5 flex items-center text-xs text-[var(--color-text-subtle)] border-t border-[var(--color-border)] bg-[var(--color-surface)] select-none shrink-0">
                <span className="font-semibold text-[var(--color-text)]">{items.length}</span>
                <span className="ml-1">item{items.length !== 1 ? 's' : ''} in trash</span>
            </div>
        </div>
    )
})
