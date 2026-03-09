import { useState, useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { Tag as TagIcon, Plus, X, Undo, Redo } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { generateTagColor, nanoid } from '@/lib/utils'
import type { Tag } from '@/types'

import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent
} from '@dnd-kit/core'
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy,
    useSortable
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface SortableTagProps {
    tag: Tag
    isEditing: boolean
    editingName: string
    setEditingName: (val: string) => void
    commitEdit: () => void
    cancelEdit: () => void
    startEdit: (tag: Tag) => void
    handleDelete: (id: string, e: React.MouseEvent) => void
}

const SortableTag = memo(function SortableTag({ tag, isEditing, editingName, setEditingName, commitEdit, cancelEdit, startEdit, handleDelete }: SortableTagProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging
    } = useSortable({ id: tag.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        backgroundColor: isEditing ? 'var(--color-surface)' : `${tag.color}15`,
        borderColor: isEditing ? 'var(--color-accent)' : `${tag.color}30`,
        color: isEditing ? 'var(--color-text)' : tag.color,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
    }

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...(isEditing ? {} : attributes)}
            {...(isEditing ? {} : listeners)}
            onDoubleClick={(e) => {
                e.stopPropagation()
                startEdit(tag)
            }}
            className={`
                group flex items-center justify-center gap-1.5 relative px-3 py-1.5 rounded-full text-xs font-medium border touch-none outline-none select-none
                ${isEditing ? 'ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-surface)]' : 'cursor-grab'}
            `}
        >
            {isEditing ? (
                <input
                    autoFocus
                    value={editingName}
                    onChange={e => setEditingName(e.target.value.slice(0, 20))}
                    onKeyDown={e => {
                        if (e.key === 'Enter') commitEdit()
                        if (e.key === 'Escape') cancelEdit()
                    }}
                    onDoubleClick={e => e.stopPropagation()}
                    onPointerDown={e => e.stopPropagation()}
                    maxLength={20}
                    className="w-min min-w-[60px] max-w-[120px] bg-transparent outline-none text-center"
                    style={{ width: `${Math.max(editingName.length, 4)}ch` }}
                />
            ) : (
                <span className="truncate max-w-[150px]">{tag.name}</span>
            )}

            {!isEditing && (
                <button
                    onClick={(e) => handleDelete(tag.id, e)}
                    onPointerDown={e => e.stopPropagation()}
                    className="ml-1 p-0.5 rounded opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-opacity"
                >
                    <X className="h-3 w-3" />
                </button>
            )}
        </div>
    )
})

interface ManageTagDialogProps {
    onClose: () => void
}

export function ManageTagDialog({ onClose }: ManageTagDialogProps) {
    const { data } = useStore()

    const initialTags = Object.values(data.tags).sort((a, b) => {
        if (a.sort_order !== undefined && b.sort_order !== undefined) {
            return a.sort_order - b.sort_order
        }
        return a.name.localeCompare(b.name)
    })

    const [tags, setTags] = useState<Tag[]>(initialTags)
    const [history, setHistory] = useState<{ past: Tag[][], future: Tag[][] }>({ past: [], future: [] })

    const [isAdding, setIsAdding] = useState(false)
    const [newTagName, setNewTagName] = useState('')
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editingName, setEditingName] = useState('')
    const [error, setError] = useState<string | null>(null)

    const addInputRef = useRef<HTMLInputElement>(null)

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                distance: 5, // Requires minimum moving distance before acting as drag, so clicks/double-clicks work perfectly
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const pushHistory = (newTags: Tag[]) => {
        setHistory(prev => ({
            past: [...prev.past, tags],
            future: []
        }))
        setTags(newTags)
    }

    const handleUndo = () => {
        if (history.past.length === 0) return
        const previous = history.past[history.past.length - 1]
        const newPast = history.past.slice(0, -1)

        setHistory(prev => ({
            past: newPast,
            future: [tags, ...prev.future]
        }))
        setTags(previous)
        setError(null)
    }

    const handleRedo = () => {
        if (history.future.length === 0) return
        const next = history.future[0]
        const newFuture = history.future.slice(1)

        setHistory(prev => ({
            past: [...prev.past, tags],
            future: newFuture
        }))
        setTags(next)
        setError(null)
    }

    const commitAdd = () => {
        const name = newTagName.trim()
        if (!name) {
            setIsAdding(false)
            return
        }
        if (name.length > 20) {
            setError('Tag name must be 20 characters or less')
            return
        }
        if (tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            setError('Tag already exists')
            return
        }
        const newTag: Tag = { id: nanoid(), name, color: generateTagColor() }
        pushHistory([newTag, ...tags])
        setIsAdding(false)
        setNewTagName('')
        setError(null)
    }

    const startEdit = (tag: Tag) => {
        setEditingId(tag.id)
        setEditingName(tag.name)
        setError(null)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditingName('')
        setError(null)
    }

    const commitEdit = () => {
        if (!editingId) return
        const name = editingName.trim()
        if (!name) {
            setEditingId(null)
            return
        }
        if (name.length > 20) {
            setError('Tag name must be 20 characters or less')
            return
        }
        if (tags.some(t => t.id !== editingId && t.name.toLowerCase() === name.toLowerCase())) {
            setError('Tag already exists')
            return
        }

        const newTags = tags.map(t => t.id === editingId ? { ...t, name } : t)
        pushHistory(newTags)
        setEditingId(null)
        setError(null)
    }

    const handleDelete = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        const newTags = tags.filter(t => t.id !== id)
        pushHistory(newTags)
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            const oldIndex = tags.findIndex(t => t.id === active.id)
            const newIndex = tags.findIndex(t => t.id === over.id)

            const newTags = arrayMove(tags, oldIndex, newIndex)
            pushHistory(newTags)
        }
    }

    const handleSave = () => {
        const newTagsRecord: Record<string, Tag> = {}
        // Assign sort_order based on the current visual array layout
        tags.forEach((t, index) => {
            newTagsRecord[t.id] = { ...t, sort_order: index }
        })

        const store = useStore.getState()

        const validTagIds = new Set(tags.map(t => t.id))
        const newRepos = { ...store.data.repositories }
        let reposChanged = false

        Object.keys(newRepos).forEach(repoId => {
            const repo = newRepos[repoId]
            const filteredTags = repo.tags.filter(id => validTagIds.has(id))
            if (filteredTags.length !== repo.tags.length) {
                newRepos[repoId] = { ...repo, tags: filteredTags }
                reposChanged = true
            }
        })

        store.setData({
            ...store.data,
            last_modified: Date.now(),
            tags: newTagsRecord,
            repositories: reposChanged ? newRepos : store.data.repositories
        })
        onClose()
    }

    useEffect(() => {
        if (isAdding && addInputRef.current) addInputRef.current.focus()
    }, [isAdding])

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (isAdding) setIsAdding(false)
                else if (editingId) setEditingId(null)
                else onClose()
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isAdding, editingId, onClose])

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
            onPointerDown={(e) => {
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation();
            }}
        >
            <div className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl flex flex-col max-h-[85vh]">
                <div className="p-6 pb-4 flex items-center justify-between border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-[var(--color-surface-2)]">
                            <TagIcon className="h-5 w-5 text-[var(--color-accent)]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-[var(--color-text)] leading-tight">Manage Tags</h2>
                            <p className="text-sm text-[var(--color-text-muted)] mt-0.5">Drag to reorder. Double-click to edit.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 bg-[var(--color-surface-2)] p-1 rounded-lg border border-[var(--color-border)]">
                        <button
                            type="button"
                            onClick={handleUndo}
                            disabled={history.past.length === 0}
                            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            title="Undo"
                        >
                            <Undo className="h-4 w-4" />
                        </button>
                        <button
                            type="button"
                            onClick={handleRedo}
                            disabled={history.future.length === 0}
                            className="p-1.5 rounded-md text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface)] disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                            title="Redo"
                        >
                            <Redo className="h-4 w-4" />
                        </button>
                        <button type="button" onClick={onClose} className="rounded-lg p-1.5 ml-2 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors shrink-0">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                {error && (
                    <div className="px-6 py-2 bg-[var(--color-danger)]/10 border-b border-[var(--color-danger)]/20 text-[var(--color-danger)] text-xs font-medium text-center">
                        {error}
                    </div>
                )}

                <div className="p-6 overflow-y-auto flex-1 bg-[var(--color-surface-2)]/30 min-h-[200px]" onClick={() => { setIsAdding(false); setEditingId(null) }}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={tags.map(t => t.id)}
                            strategy={rectSortingStrategy}
                        >
                            <div className="flex flex-wrap gap-2.5 items-start content-start">
                                {isAdding ? (
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[var(--color-accent)] bg-[var(--color-accent)]/10 shadow-sm" onClick={e => e.stopPropagation()}>
                                        <input
                                            ref={addInputRef}
                                            value={newTagName}
                                            onChange={e => setNewTagName(e.target.value.slice(0, 20))}
                                            onKeyDown={e => {
                                                if (e.key === 'Enter') commitAdd()
                                                if (e.key === 'Escape') setIsAdding(false)
                                            }}
                                            maxLength={20}
                                            placeholder="Tag name"
                                            className="w-24 bg-transparent text-xs text-[var(--color-text)] outline-none"
                                        />
                                        <span className="text-[10px] text-[var(--color-text-muted)] shrink-0">{newTagName.length}/20</span>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); setIsAdding(true); setNewTagName(''); setError(null) }}
                                        className="flex items-center justify-center px-3 py-1.5 rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors text-xs font-medium"
                                    >
                                        <Plus className="h-3.5 w-3.5 mr-1" />
                                        Add Tag
                                    </button>
                                )}

                                {tags.map((tag) => (
                                    <SortableTag
                                        key={tag.id}
                                        tag={tag}
                                        isEditing={editingId === tag.id}
                                        editingName={editingName}
                                        setEditingName={setEditingName}
                                        commitEdit={commitEdit}
                                        cancelEdit={cancelEdit}
                                        startEdit={startEdit}
                                        handleDelete={handleDelete}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                <div className="p-6 pt-4 flex items-center justify-end gap-3 border-t border-[var(--color-border)]">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-5 py-2.5 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-sm font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-muted)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="px-5 py-2.5 rounded-xl bg-[var(--color-accent)] text-white text-sm font-semibold hover:bg-[var(--color-accent)]/90 shadow-sm transition-all active:scale-[0.98]"
                    >
                        Save Changes
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
