import { useState, useMemo, memo, useEffect, useRef } from 'react'
import { Folder as FolderIcon, MoreHorizontal, FolderPlus, Edit2, Trash2 } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { FolderEditModal } from './FolderEditModal'
import { ConfirmDialog } from './ConfirmDialog'
import { useDroppable } from '@dnd-kit/core'
import { useSortable, SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

const DroppableFolder = memo(function DroppableFolder({
    id,
    name,
    color,
    isSelected,
    onClick,
    onEdit,
    onDelete,
    isCollapsed,
    count,
    isSortable
}: {
    id: string
    name: string
    color?: string
    isSelected: boolean
    onClick: () => void
    onEdit?: () => void
    onDelete?: () => void
    isCollapsed: boolean
    count?: number
    isSortable?: boolean
}) {
    const { setNodeRef: setDroppableRef } = useDroppable({
        id: `folder-${id}`,
        data: {
            type: 'folder',
            folderId: id === 'sys:all' || id === 'sys:uncategorized' ? null : id,
            isSystem: id === 'sys:all' || id === 'sys:uncategorized'
        },
        disabled: id === 'sys:all'
    })

    const {
        attributes,
        listeners,
        setNodeRef: setSortableRef,
        transform,
        transition,
        isDragging
    } = useSortable({
        id: `sort-folder-${id}`,
        disabled: !isSortable,
        data: {
            type: 'folder-item',
            folderId: id
        }
    })

    const [showMenu, setShowMenu] = useState(false)
    const [showStatusBriefly, setShowStatusBriefly] = useState(false)
    const lastCount = useRef(count)
    const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    useEffect(() => {
        if (lastCount.current !== undefined && count !== lastCount.current) {
            lastCount.current = count
            if (statusTimer.current) clearTimeout(statusTimer.current)
            statusTimer.current = setTimeout(() => setShowStatusBriefly(true), 0)
            statusTimer.current = setTimeout(() => setShowStatusBriefly(false), 1000)
        } else {
            lastCount.current = count
        }
    }, [count])

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0 : 1,
        zIndex: isDragging ? 50 : (showMenu ? 40 : 1),
    }

    const setNodeRef = (node: HTMLElement | null) => {
        setDroppableRef(node)
        if (isSortable) setSortableRef(node)
    }

    return (
        <div
            ref={setNodeRef}
            id={`folder-${id}`}
            style={isSortable ? style : undefined}
            {...(isSortable ? attributes : {})}
            {...(isSortable ? listeners : {})}
            onClick={onClick}
            data-folder-droppable={id !== 'sys:all' ? 'true' : undefined}
            className={`group relative flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium cursor-pointer border transition-all ${
                isDragging
                    ? 'border-dashed border-[var(--color-accent)] ring-2 ring-[var(--color-accent)]/20 shadow-sm'
                    : isSelected
                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] border-transparent'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)] border-transparent'
                }`}
            onMouseLeave={() => setShowMenu(false)}
        >
            <div className="flex items-center gap-2 min-w-0 flex-1">
                <FolderIcon
                    className={`h-4 w-4 shrink-0 transition-colors ${isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
                    style={color && !isSelected ? { color } : undefined}
                />
                {!isCollapsed && <span className="truncate">{name}</span>}
            </div>

            {!isCollapsed && (
                <div className="flex items-center justify-end shrink-0 ml-2 relative min-w-[24px] h-6">
                    {count !== undefined && (
                        <span className={`absolute right-0 flex items-center justify-center text-[10px] font-medium px-1.5 py-0.5 rounded-full tabular-nums transition-all duration-300 ${isSelected ? 'text-[var(--color-accent)] bg-[var(--color-accent)]/10' : 'text-[var(--color-text-muted)] bg-[var(--color-surface-2)]'} ${showStatusBriefly ? 'scale-110 !opacity-100 z-20 shadow-sm ring-1 ring-[var(--color-accent)]/30' : (onEdit ? 'group-hover:opacity-0 group-hover:scale-90 pointer-events-none' : 'opacity-100')}`}>
                            {count}
                        </span>
                    )}
                    {onEdit && onDelete && (
                        <>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowMenu(!showMenu) }}
                                className={`absolute right-0 p-1 flex items-center justify-center rounded transition-all duration-200 hover:bg-[var(--color-surface-3)] z-10 ${showMenu ? 'opacity-100 bg-[var(--color-surface-3)]' : showStatusBriefly ? 'opacity-0 scale-75 pointer-events-none' : 'opacity-0 group-hover:opacity-100'}`}
                            >
                                <MoreHorizontal className="h-3 w-3" />
                            </button>
                            {showMenu && (
                                <div className="absolute right-0 top-7 z-50 w-24 rounded-md border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-lg">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onEdit() }}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-[var(--color-surface-2)]"
                                    >
                                        <Edit2 className="h-3 w-3" />
                                        Edit
                                    </button>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setShowMenu(false); onDelete() }}
                                        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10"
                                    >
                                        <Trash2 className="h-3 w-3" />
                                        Delete
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    )
})

import { useShallow } from 'zustand/react/shallow'
import type { GitShelfStore } from '@/store/types'

export function FolderList({ isCollapsed }: { isCollapsed: boolean }) {
    const { data, selectedFolderId, setSelectedFolderId, removeFolder } = useStore(useShallow((state: GitShelfStore) => ({
        data: state.data,
        selectedFolderId: state.selectedFolderId,
        setSelectedFolderId: state.setSelectedFolderId,
        removeFolder: state.removeFolder
    })))
    const [isEditModalOpen, setIsEditModalOpen] = useState(false)
    const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
    const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null)

    const folderCounts = useMemo(() => {
        const counts: Record<string, number> = { 'sys:all': 0, 'sys:uncategorized': 0 }
        const repos = Object.values(data.repositories || {})
        counts['sys:all'] = repos.length
        
        for (const r of repos) {
            if (!r.folder_id) {
                counts['sys:uncategorized']++
            } else {
                counts[r.folder_id] = (counts[r.folder_id] || 0) + 1
            }
        }
        return counts
    }, [data.repositories])

    const folders = Object.values(data.folders || {}).sort((a, b) => {
        if (a.sort_order !== undefined && b.sort_order !== undefined) return a.sort_order - b.sort_order
        return a.name.localeCompare(b.name)
    })

    const handleEdit = (id?: string) => {
        setEditingFolderId(id || null)
        setIsEditModalOpen(true)
    }

    const handleDelete = (id: string) => {
        setDeletingFolderId(id)
    }

    const confirmDelete = () => {
        if (deletingFolderId) {
            removeFolder(deletingFolderId)
            setDeletingFolderId(null)
        }
    }

    // Always sort All Repos first, then Uncategorized, then user folders
    return (
        <div className="flex flex-col gap-0.5">
            {!isCollapsed && (
                <div className="flex items-center justify-between px-3 py-2 group/header">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">Folders</span>
                    <button
                        onClick={() => handleEdit()}
                        className="rounded p-1 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors"
                        title="Add Folder"
                    >
                        <FolderPlus className="h-4 w-4" />
                    </button>
                </div>
            )}

            <div className="flex flex-col gap-0.5 px-2">
                <DroppableFolder
                    id="sys:all"
                    name="All Repos"
                    isSelected={selectedFolderId === 'sys:all'}
                    onClick={() => setSelectedFolderId('sys:all')}
                    isCollapsed={isCollapsed}
                    count={folderCounts['sys:all']}
                />
                <DroppableFolder
                    id="sys:uncategorized"
                    name="Uncategorized"
                    isSelected={selectedFolderId === null || selectedFolderId === 'sys:uncategorized'}
                    onClick={() => setSelectedFolderId(null)}
                    isCollapsed={isCollapsed}
                    count={folderCounts['sys:uncategorized']}
                />

                {!isCollapsed && folders.length > 0 && <div className="my-1 h-px bg-[var(--color-border)] mx-2" />}
                
                <SortableContext 
                    items={folders.map(f => `sort-folder-${f.id}`)}
                    strategy={verticalListSortingStrategy}
                >
                    {folders.map(folder => (
                        <DroppableFolder
                            key={folder.id}
                            id={folder.id}
                            name={folder.name}
                            color={folder.color}
                            isSelected={selectedFolderId === folder.id}
                            onClick={() => setSelectedFolderId(folder.id)}
                            onEdit={() => handleEdit(folder.id)}
                            onDelete={() => handleDelete(folder.id)}
                            isCollapsed={isCollapsed}
                            isSortable={true}
                            count={folderCounts[folder.id] || 0}
                        />
                    ))}
                </SortableContext>
            </div>

            {isCollapsed && (
                <div className="px-2 mt-2">
                    <button
                        onClick={() => handleEdit()}
                        className="flex w-full items-center justify-center rounded-lg p-2.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors"
                        title="Add Folder"
                    >
                        <FolderPlus className="h-4 w-4 text-[var(--color-accent)]" />
                    </button>
                </div>
            )}

            {isEditModalOpen && (
                <FolderEditModal
                    folderId={editingFolderId}
                    onClose={() => {
                        setIsEditModalOpen(false)
                        setEditingFolderId(null)
                    }}
                />
            )}

            {deletingFolderId && (
                <ConfirmDialog
                    isOpen={!!deletingFolderId}
                    title="Delete Folder"
                    description={<>Are you sure you want to delete folder <strong>{data.folders[deletingFolderId]?.name}</strong>? Repositories in this folder will be moved to <strong>Uncategorized</strong>.<br/><br/>This action cannot be undone.</>}
                    variant="danger"
                    confirmLabel="Delete"
                    onConfirm={confirmDelete}
                    onClose={() => setDeletingFolderId(null)}
                />
            )}
        </div>
    )
}
