import { useState, useEffect } from 'react'
import { Folder, X } from 'lucide-react'
import { nanoid } from 'nanoid'
import { useStore } from '@/store/useStore'
import { TAG_COLORS as FOLDER_COLORS } from '@/lib/utils'


interface FolderEditModalProps {
    folderId: string | null
    onClose: () => void
}

import { createPortal } from 'react-dom'

export function FolderEditModal({ folderId, onClose }: FolderEditModalProps) {
    const { data, addFolder, updateFolder } = useStore()

    const existingFolder = folderId ? data.folders?.[folderId] : null

    const [name, setName] = useState(existingFolder?.name || '')
    const [color, setColor] = useState(existingFolder?.color || FOLDER_COLORS[0])
    const [error, setError] = useState('')

    // Reset when modal opens for a different folder
    useEffect(() => {
        if (existingFolder) {
            setName(existingFolder.name)
            setColor(existingFolder.color || FOLDER_COLORS[0])
        } else {
            setName('')
            setColor(FOLDER_COLORS[0])
        }
        setError('')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [folderId])

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [onClose])

    const validate = () => {
        setError('')
        const trimmed = name.trim()
        if (!trimmed) {
            setError('Folder name is required')
            return false
        }

        if (trimmed.length > 25) {
            setError('Folder name must be 25 characters or less')
            return false
        }

        // Check for duplicate names
        const isDuplicate = Object.values(data.folders || {}).some(
            f => f.id !== folderId && f.name.toLowerCase() === trimmed.toLowerCase()
        )
        if (isDuplicate) {
            setError('Folder name already exists')
            return false
        }
        return true
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        if (!validate()) return

        const trimmed = name.trim()
        if (folderId) {
            updateFolder(folderId, { name: trimmed, color })
        } else {
            addFolder({ id: nanoid(), name: trimmed, color })
        }

        onClose()
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-fade-in p-4"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-surface-2)]"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="p-6">
                    <div className="mb-6 flex items-center gap-4">
                        <div
                           className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-accent)] shadow-sm">
                            <Folder className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-[var(--color-text)] leading-tight">
                                {folderId ? 'Edit Folder' : 'New Folder'}
                            </h2>
                            <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                Organize your repositories
                            </p>
                        </div>
                    </div>

                    <form
                        onSubmit={handleSubmit}
                        onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                        className="space-y-6"
                    >
                        <div className="relative">
                            <div className="flex items-center justify-between ml-0.5 mb-3">
                                <label htmlFor="folder-name" className="block text-xs font-bold text-[var(--color-text)] leading-none">
                                    Folder Name
                                </label>
                                <span className="text-[10px] text-[var(--color-text-muted)] font-bold tabular-nums">
                                    {name.length}/25
                                </span>
                            </div>
                            <input
                                id="folder-name"
                                autoFocus
                                value={name}
                                onChange={(e) => { setName(e.target.value.slice(0, 25)); setError('') }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault()
                                        validate()
                                    }
                                }}
                                maxLength={25}
                                placeholder="E.g., Documentation, Utilities, Tools..."
                                autoComplete="off"
                                className="w-full rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-2)] px-4 py-2.5 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none focus:border-[var(--color-accent)] transition-colors"
                            />
                            {error && (
                                <p className="absolute -bottom-5 left-0.5 text-xs text-[var(--color-danger)] font-medium animate-in fade-in slide-in-from-top-1 duration-200">
                                    {error}
                                </p>
                            )}
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-[var(--color-text)] ml-0.5 mb-4">
                                Folder Color
                            </label>
                            <div className="flex flex-wrap gap-2.5">
                                {FOLDER_COLORS.map(c => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        className={`h-7 w-7 rounded-full transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] ${color === c ? 'ring-2 ring-[var(--color-text)] scale-110' : 'ring-1 ring-black/10 dark:ring-white/10 hover:scale-110'}`}
                                        style={{ backgroundColor: c }}
                                        title={c}
                                    />
                                ))}
                            </div>
                        </div>

                        <div className="pt-2 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-xl px-4 py-2 text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="rounded-xl bg-[var(--color-accent)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                                disabled={!name.trim()}
                            >
                                {folderId ? 'Save Changes' : 'Create Folder'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>,
        document.body
    )
}
