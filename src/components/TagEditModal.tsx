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

    // Sync if repo changes (e.g. external update)
    useEffect(() => {
        if (repo) setSelectedTagIds(repo.tags)
    }, [repo?.tags])

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
                className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl flex flex-col max-h-[85vh]"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="mb-5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <TagIcon className="h-4 w-4 text-[var(--color-text-muted)]" />
                        <h2 className="text-base font-semibold text-[var(--color-text)]">Edit Tags</h2>
                    </div>
                    <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors">
                        <X className="h-4 w-4" />
                    </button>
                </div>

                <div className="mb-4 flex-1 overflow-y-auto min-h-[100px] pr-2">
                    <p className="text-sm text-[var(--color-text-subtle)] mb-4">
                        Manage tags for <span className="font-semibold text-[var(--color-text)]">{repo.owner}/{repo.name}</span>
                    </p>

                    <TagSelector
                        selectedTagIds={selectedTagIds}
                        onChange={setSelectedTagIds}
                    />
                </div>

                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-[var(--color-border)] py-2.5 text-sm font-medium text-[var(--color-text)] transition-colors hover:bg-[var(--color-surface-2)]"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        className="flex-1 rounded-lg bg-[var(--color-accent)] py-2.5 text-sm font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.98]"
                    >
                        Save Tags
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
