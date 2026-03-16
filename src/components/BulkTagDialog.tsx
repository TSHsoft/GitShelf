import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Tag as TagIcon, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'

interface BulkTagDialogProps {
    repoIds: Set<string>
    onClose: () => void
}

export function BulkTagDialog({ repoIds, onClose }: BulkTagDialogProps) {
    const { data, bulkAddTags } = useStore()
    const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())

    // Get all tags sorted by name
    const allTags = Object.values(data.tags).sort((a, b) => a.name.localeCompare(b.name))

    const handleToggleTag = (tagId: string) => {
        const next = new Set(selectedTagIds)
        if (next.has(tagId)) {
            next.delete(tagId)
        } else {
            next.add(tagId)
        }
        setSelectedTagIds(next)
    }

    const handleSave = () => {
        if (selectedTagIds.size > 0) {
            bulkAddTags(Array.from(repoIds), Array.from(selectedTagIds))
        }
        onClose()
    }

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => {
            window.removeEventListener('keydown', handleEscape)
        }
    }, [onClose])

    useLockBodyScroll()

    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 animate-fade-in"
            onPointerDown={(e) => {
                e.stopPropagation()
            }}
            onClick={(e) => {
                e.stopPropagation()
            }}
        >
            <div
                className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl scale-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-5 pb-0 flex items-start justify-between">
                    <div className="flex gap-3">
                        <div className={`mt-0.5 p-2 rounded-full bg-[var(--color-surface-2)] shrink-0 self-start`}>
                            <TagIcon className="h-5 w-5 text-[var(--color-accent)]" />
                        </div>
                        <div className="flex-1">
                            <h3 className="text-base font-bold text-[var(--color-text)] leading-none mb-2">
                                Add Tags to {repoIds.size} Repositories
                            </h3>
                            <p className="text-xs text-[var(--color-text-muted)] leading-relaxed">
                                Select tags to add to the selected repositories. Existing tags will be preserved.
                            </p>
                        </div>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors shrink-0">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Tag Cloud Content */}
                <div className="p-5 overflow-y-auto min-h-[100px]">
                    {allTags.length === 0 ? (
                        <p className="text-sm text-[var(--color-text-subtle)] text-center py-4">
                            No tags available. Create some tags first!
                        </p>
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {allTags.map(tag => {
                                const isSelected = selectedTagIds.has(tag.id)
                                return (
                                    <button
                                        key={tag.id}
                                        onClick={() => handleToggleTag(tag.id)}
                                        className={`
                                            flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                            ${isSelected
                                                ? 'border-[var(--color-accent)] shadow-sm'
                                                : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)] hover:border-[var(--color-text-muted)]'
                                            }
                                        `}
                                        style={isSelected ? {
                                            backgroundColor: `${tag.color}20`,
                                            color: tag.color,
                                            borderColor: tag.color
                                        } : {}}
                                    >
                                        {tag.name}
                                    </button>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-5 pt-0 flex items-center justify-between mt-auto">
                    {selectedTagIds.size > 0 ? (
                        <button
                            type="button"
                            onClick={() => setSelectedTagIds(new Set())}
                            className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                        >
                            Clear All
                        </button>
                    ) : (
                        <div />
                    )}
                    <div className="flex items-center gap-2 h-[34px]">
                        <button
                            type="button"
                            onClick={onClose}
                            className="h-full px-4 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface)] transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            disabled={selectedTagIds.size === 0}
                            className="h-full px-4 rounded-lg bg-[var(--color-accent)] text-white text-xs font-semibold hover:bg-[var(--color-accent-hover)] border-transparent shadow-sm transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Add Tags
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
