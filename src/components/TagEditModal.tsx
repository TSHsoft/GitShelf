import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X, Tag as TagIcon } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { TagSelector } from './TagSelector'

interface TagEditModalProps {
    repoId: string
    initialTags: string[]
    onClose: () => void
}

export function TagEditModal({ repoId, initialTags, onClose }: TagEditModalProps) {
    const { updateRepository, data } = useStore()
    const [selectedTagIds, setSelectedTagIds] = useState(initialTags)
    const repo = data.repositories[repoId]

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [onClose])

    const handleSave = () => {
        updateRepository(repoId, { tags: selectedTagIds })
        onClose()
    }

    if (!repo) return null

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
            onPointerDown={(e) => {
                e.stopPropagation()
            }}
            onClick={(e) => {
                e.stopPropagation()
            }}
        >
            <div
                className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
            >
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-surface-2)]"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="p-6">
                    <div className="mb-6 flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-accent)] shadow-sm">
                            <TagIcon className="h-6 w-6" />
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-base font-bold text-[var(--color-text)] leading-tight">Edit Tags</h2>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                                For {repo.owner}/{repo.name}
                            </p>
                        </div>
                    </div>

                    <div className="mb-6 overflow-y-auto min-h-[120px] pr-1">
                        <TagSelector
                            selectedTagIds={selectedTagIds}
                            onChange={setSelectedTagIds}
                        />
                    </div>

                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 rounded-xl border border-[var(--color-border)] py-2 text-xs font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleSave}
                            className="flex-1 rounded-xl bg-[var(--color-accent)] py-2 text-xs font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98] shadow-sm"
                        >
                            Save Tags
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
