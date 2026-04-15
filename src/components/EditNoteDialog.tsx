import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { StickyNote, X } from 'lucide-react'
import { useStore } from '@/store/useStore'

interface EditNoteDialogProps {
    repoId: string
    initialNote?: string
    onClose: () => void
}

export function EditNoteDialog({ repoId, initialNote = '', onClose }: EditNoteDialogProps) {
    const updateRepository = useStore(state => state.updateRepository)
    const [note, setNote] = useState(initialNote)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [])

    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [onClose])

    const handleSave = () => {
        updateRepository(repoId, { note: note.trim() || undefined })
        onClose()
    }

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 animate-fade-in"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div
                className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 flex items-center justify-between border-b border-[var(--color-border)]">
                    <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-orange-500 shadow-sm">
                            <StickyNote className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[var(--color-text)] leading-tight">Edit Note</h2>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">Add a personal note for this repository.</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-lg text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-all shrink-0"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 flex flex-col gap-3">
                    <input
                        type="text"
                        ref={inputRef}
                        value={note}
                        maxLength={100}
                        onChange={(e) => setNote(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault()
                                handleSave()
                            }
                        }}
                        placeholder="Write a note for this repository (max 100 chars)..."
                        className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition-all leading-relaxed"
                    />
                    <div className="flex items-center justify-between text-[10px] text-[var(--color-text-subtle)]">
                        <span>{note.length} characters</span>
                        {note.trim() && (
                            <button
                                type="button"
                                onClick={() => setNote('')}
                                className="text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                            >
                                Clear note
                            </button>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-6 flex items-center justify-end gap-3">
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
                        className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold hover:bg-orange-600 shadow-sm transition-all active:scale-[0.98]"
                    >
                        Save Note
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
