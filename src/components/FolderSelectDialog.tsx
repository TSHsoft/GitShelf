import { useState, useEffect } from 'react'
import { FolderInput, Folder, X, Search, Check } from 'lucide-react'
import { useStore } from '@/store/useStore'

interface FolderSelectDialogProps {
    repoIds: string[]
    onClose: () => void
}

import { createPortal } from 'react-dom'

export function FolderSelectDialog({ repoIds, onClose }: FolderSelectDialogProps) {
    const { data, bulkMoveReposToFolder, moveRepoToFolder } = useStore()
    const [searchQuery, setSearchQuery] = useState('')

    const folders = Object.values(data.folders || {}).sort((a, b) => {
        if (a.sort_order !== undefined && b.sort_order !== undefined) return a.sort_order - b.sort_order
        return a.name.localeCompare(b.name)
    })

    const filteredFolders = folders.filter(f =>
        f.name.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Determine if all selected repos share the same folder initially
    const commonFolderId = repoIds.length > 0
        ? repoIds.every(id => data.repositories[id]?.folder_id === data.repositories[repoIds[0]]?.folder_id)
            ? data.repositories[repoIds[0]]?.folder_id || null
            : undefined
        : undefined

    const [selectedFolderId, setSelectedFolderId] = useState<string | null | undefined>(commonFolderId)

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        window.addEventListener('keydown', handleEscape)
        return () => window.removeEventListener('keydown', handleEscape)
    }, [onClose])

    const handleSave = () => {
        if (selectedFolderId !== undefined) {
            if (repoIds.length === 1) {
                moveRepoToFolder(repoIds[0], selectedFolderId)
            } else {
                bulkMoveReposToFolder(repoIds, selectedFolderId)
            }
        }
        onClose()
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 animate-fade-in p-4"
            onClick={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
        >
            <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl relative animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                <button
                    onClick={onClose}
                    className="absolute right-4 top-4 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors p-1.5 rounded-lg hover:bg-[var(--color-surface-2)]"
                >
                    <X className="h-4 w-4" />
                </button>

                <div className="p-6 pb-0 flex-shrink-0">
                    <div className="mb-6 flex items-center gap-4">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-surface-2)] text-[var(--color-accent)] shadow-sm">
                            <FolderInput className="h-6 w-6" />
                        </div>
                        <div className="min-w-0 flex-1">
                            <h2 className="text-base font-bold text-[var(--color-text)] leading-tight">Move to Folder</h2>
                            {repoIds.length === 1 ? (
                                <p className="text-xs text-[var(--color-text-muted)] mt-1 truncate">
                                    {data.repositories[repoIds[0]]?.owner}/{data.repositories[repoIds[0]]?.name}
                                </p>
                            ) : (
                                <p className="text-xs text-[var(--color-text-muted)] mt-1">
                                    {repoIds.length} repositories selected
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="relative h-[34px]">
                        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                        <input
                            type="text"
                            placeholder="Find a folder..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault() }}
                            autoComplete="off"
                            className="w-full h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] pl-10 pr-4 text-xs font-semibold text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-accent)] focus:outline-none focus:ring-1 focus:ring-[var(--color-accent)] transition-all"
                            autoFocus
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto max-h-[40vh] px-6 py-4">
                    <div className="space-y-1">
                        <button
                            onClick={() => setSelectedFolderId(null)}
                            className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 text-xs transition-colors ${selectedFolderId === null
                                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold'
                                : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                                }`}
                        >
                            <div className="flex items-center gap-3">
                                <Folder className={`h-3.5 w-3.5 ${selectedFolderId === null ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`} />
                                Uncategorized
                            </div>
                            {selectedFolderId === null && <Check className="h-3.5 w-3.5" />}
                        </button>

                        {filteredFolders.map(folder => (
                            <button
                                key={folder.id}
                                onClick={() => setSelectedFolderId(folder.id)}
                                className={`w-full flex items-center justify-between rounded-xl px-3.5 py-2 text-xs transition-colors ${selectedFolderId === folder.id
                                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)] font-semibold'
                                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                                    }`}
                            >
                                <div className="flex items-center gap-3">
                                    <Folder
                                        className={`h-3.5 w-3.5 ${selectedFolderId === folder.id ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
                                        style={folder.color && selectedFolderId !== folder.id ? { color: folder.color } : undefined}
                                    />
                                    <span className="truncate">{folder.name}</span>
                                </div>
                                {selectedFolderId === folder.id && <Check className="h-3.5 w-3.5" />}
                            </button>
                        ))}

                        {filteredFolders.length === 0 && searchQuery && (
                            <div className="py-8 text-center text-sm text-[var(--color-text-muted)]">
                                No folders match "{searchQuery}"
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-6 pt-4 border-t border-[var(--color-border)] flex justify-end gap-2 flex-shrink-0 bg-[var(--color-surface)] rounded-b-2xl z-10 font-sans h-[82px] items-center">
                    <button
                        onClick={onClose}
                        className="rounded-lg px-4 h-[34px] text-xs font-semibold text-[var(--color-text)] hover:bg-[var(--color-surface-2)] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="rounded-lg bg-[var(--color-accent)] px-4 h-[34px] text-xs font-semibold text-white hover:bg-[var(--color-accent-hover)] transition-all shadow-sm focus:outline-none focus:ring-2 focus:ring-[var(--color-accent)] focus:ring-offset-2 focus:ring-offset-[var(--color-surface)] disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                        disabled={selectedFolderId === undefined}
                    >
                        Save Selection
                    </button>
                </div>
            </div>
        </div>,
        document.body
    )
}
