import { useState, useEffect, useRef, memo } from 'react'
import { createPortal } from 'react-dom'
import { Tag as TagIcon, Plus, X, Undo, Redo, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { generateTagColor, nanoid, TAG_COLORS } from '@/lib/utils'
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
    setError: (err: string | null) => void
    onColorDotClick: (tagId: string, anchorEl: HTMLButtonElement) => void
    colorPickerTagId: string | null
}

const SortableTag = memo(function SortableTag({ tag, isEditing, editingName, setEditingName, commitEdit, cancelEdit, startEdit, handleDelete, setError, onColorDotClick, colorPickerTagId }: SortableTagProps) {
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
                group flex items-center relative min-w-[55px] max-w-[200px] h-[28px] rounded-full text-xs font-medium border touch-none outline-none select-none px-1
                ${isEditing ? 'ring-2 ring-[var(--color-accent)] ring-offset-1 ring-offset-[var(--color-surface)]' : 'cursor-grab'}
            `}
        >
            {isEditing ? (
                <div className="flex-1 flex justify-center">
                    <input
                        autoFocus
                        value={editingName}
                        onChange={e => { setEditingName(e.target.value.slice(0, 25)); setError(null) }}
                        onKeyDown={e => {
                            if (e.key === 'Enter') commitEdit()
                            if (e.key === 'Escape') cancelEdit()
                        }}
                        onDoubleClick={e => e.stopPropagation()}
                        onPointerDown={e => e.stopPropagation()}
                        maxLength={25}
                        className="w-min min-w-[60px] max-w-[120px] bg-transparent outline-none text-center"
                        style={{ width: `${Math.max(editingName.length, 4)}ch` }}
                    />
                </div>
            ) : (
                <>
                    {/* Color dot — click to open swatch popover */}
                    <button
                        onPointerDown={e => e.stopPropagation()}
                        onClick={(e) => {
                            e.stopPropagation()
                            onColorDotClick(tag.id, e.currentTarget)
                        }}
                        className={`w-2.5 h-2.5 rounded-full shrink-0 transition-all ring-offset-1 ring-offset-[var(--color-surface)] hover:ring-2 hover:ring-[var(--color-border)] ${
                            colorPickerTagId === tag.id ? 'ring-2 ring-[var(--color-accent)]' : ''
                        }`}
                        style={{ backgroundColor: tag.color }}
                        title="Change color"
                    />
                    <span className="truncate flex-1 text-center pl-2 pr-1 leading-normal">
                        {tag.name}
                    </span>
                    <button
                        onClick={(e) => handleDelete(tag.id, e)}
                        onPointerDown={e => e.stopPropagation()}
                        className="w-5 h-5 flex items-center justify-center rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-all shrink-0"
                    >
                        <X className="h-3 w-3" />
                    </button>
                </>
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
    const [colorPickerTagId, setColorPickerTagId] = useState<string | null>(null)
    const [pickerPos, setPickerPos] = useState({ top: 0, left: 0 })
    const pickerRef = useRef<HTMLDivElement>(null)

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
        if (name.length > 25) {
            setError('Tag name must be 25 characters or less')
            return
        }
        if (tags.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            setError('Tags already exists')
            return
        }
        const lastColor = tags.length > 0 ? tags[0].color : undefined
        const newTag: Tag = { id: nanoid(), name, color: generateTagColor(lastColor) }
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
        if (name.length > 25) {
            setError('Tag name must be 25 characters or less')
            return
        }
        if (tags.some(t => t.id !== editingId && t.name.toLowerCase() === name.toLowerCase())) {
            setError('Tags already exists')
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

    // Close color picker when clicking outside it
    useEffect(() => {
        if (!colorPickerTagId) return
        const handlePointerDown = (e: PointerEvent) => {
            if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
                setColorPickerTagId(null)
            }
        }
        document.addEventListener('pointerdown', handlePointerDown)
        return () => document.removeEventListener('pointerdown', handlePointerDown)
    }, [colorPickerTagId])

    const handleColorDotClick = (tagId: string, anchorEl: HTMLButtonElement) => {
        if (colorPickerTagId === tagId) {
            setColorPickerTagId(null)
            return
        }
        const rect = anchorEl.getBoundingClientRect()
        // Position popover centered below the dot
        setPickerPos({
            top: rect.bottom + 6,
            left: rect.left + rect.width / 2,
        })
        setColorPickerTagId(tagId)
        setIsAdding(false)
        setEditingId(null)
        setError(null)
    }

    const handleColorChange = (tagId: string, color: string) => {
        const newTags = tags.map(t => t.id === tagId ? { ...t, color } : t)
        pushHistory(newTags)
        setColorPickerTagId(null)
    }

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (colorPickerTagId) { setColorPickerTagId(null); return }
                if (isAdding) setIsAdding(false)
                else if (editingId) setEditingId(null)
                else onClose()
            }
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [isAdding, editingId, colorPickerTagId, onClose])

    const mainPortal = createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
            onPointerDown={(e) => {
                e.stopPropagation();
            }}
            onClick={(e) => {
                e.stopPropagation();
            }}
        >
            <div 
                className="w-full max-w-2xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl flex flex-col max-h-[85vh]"
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        const target = e.target as HTMLElement;
                        // Only allow Enter if we are typing in a tag input (handled in TagSelector/local inputs)
                        if (target.tagName !== 'INPUT') {
                            e.preventDefault();
                        }
                    }
                }}
            >
                <div className="p-6 flex items-center justify-between border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-accent)] shadow-sm">
                            <TagIcon className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[var(--color-text)] leading-tight">Manage Tags</h2>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">Drag to reorder. Double-click to edit.</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1">
                        <div className="flex items-center gap-1 group-h-header-actions">
                            <button
                                type="button"
                                onClick={handleUndo}
                                disabled={history.past.length === 0}
                                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                title="Undo"
                            >
                                <Undo className="h-4 w-4" />
                            </button>
                            <button
                                type="button"
                                onClick={handleRedo}
                                disabled={history.future.length === 0}
                                className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] disabled:opacity-30 disabled:hover:bg-transparent transition-all"
                                title="Redo"
                            >
                                <Redo className="h-4 w-4" />
                            </button>
                        </div>
                        <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
                        <button 
                            type="button" 
                            onClick={onClose} 
                            className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-all shrink-0"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <div className="p-6 overflow-y-auto flex-1 bg-[var(--color-surface-2)]/30 min-h-[240px]" onClick={() => { setIsAdding(false); setEditingId(null); setError(null); setColorPickerTagId(null) }}>
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={tags.map(t => t.id)}
                            strategy={rectSortingStrategy}
                        >
                            <div className="flex flex-wrap gap-3 items-start content-start">
                                <div className="relative">
                                    {isAdding ? (
                                        <div className="flex items-center gap-2 px-3 h-[28px] rounded-full border border-[var(--color-accent)] bg-[var(--color-surface)] shadow-sm animate-in zoom-in-95 duration-150" onClick={e => e.stopPropagation()}>
                                            <input
                                                ref={addInputRef}
                                                value={newTagName}
                                                onChange={e => { setNewTagName(e.target.value.slice(0, 25)); setError(null) }}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter') commitAdd()
                                                    if (e.key === 'Escape') setIsAdding(false)
                                                }}
                                                maxLength={25}
                                                placeholder="Tag name"
                                                autoComplete="off"
                                                className="w-24 bg-transparent text-xs text-[var(--color-text)] outline-none font-medium"
                                            />
                                            <span className="text-[10px] text-[var(--color-text-muted)] shrink-0 font-bold">{newTagName.length}/25</span>
                                        </div>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={(e) => { e.stopPropagation(); setIsAdding(true); setNewTagName(''); setError(null) }}
                                            className="flex items-center justify-center px-3 py-1.5 rounded-full border border-dashed border-[var(--color-border)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors text-xs font-medium h-[28px]"
                                        >
                                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                                            Add Tag
                                        </button>
                                    )}
                                </div>

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
                                        setError={setError}
                                        onColorDotClick={handleColorDotClick}
                                        colorPickerTagId={colorPickerTagId}
                                    />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                <div className="p-6 pt-4 flex items-center justify-between border-t border-[var(--color-border)]">
                    <div className="flex-1 min-w-0">
                        {error && (
                            <p className="text-xs font-medium text-[var(--color-danger)] animate-in fade-in slide-in-from-left-2 duration-200 truncate">
                                {error}
                            </p>
                        )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="px-4 py-2 rounded-xl bg-[var(--color-accent)] text-white text-xs font-semibold hover:bg-[var(--color-accent-hover)] shadow-sm transition-all active:scale-[0.98]"
                        >
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )

    const pickerTag = colorPickerTagId ? tags.find(t => t.id === colorPickerTagId) ?? null : null

    return (
        <>
            {mainPortal}
            {pickerTag && createPortal(
                <div
                    ref={pickerRef}
                    className="fixed z-[200] animate-in fade-in zoom-in-90 duration-100"
                    style={{
                        top: Math.min(pickerPos.top, window.innerHeight - 130),
                        left: Math.min(
                            Math.max(pickerPos.left - 44, 8),
                            window.innerWidth - 96
                        ),
                    }}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => e.stopPropagation()}
                >
                    <div className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl p-2">
                        <div className="grid grid-cols-3 gap-1.5">
                            {TAG_COLORS.map(color => {
                                const pt = pickerTag
                                return (
                                    <button
                                        key={color}
                                        onClick={() => handleColorChange(pt.id, color)}
                                        className="relative w-5 h-5 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-[var(--color-surface)] focus:ring-[var(--color-accent)]"
                                        style={{ backgroundColor: color }}
                                    >
                                        {pt.color === color && (
                                            <Check className="absolute inset-0 m-auto h-3 w-3 text-white drop-shadow" />
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </>
    )
}
