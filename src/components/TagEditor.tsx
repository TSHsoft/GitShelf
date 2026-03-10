import { useState } from 'react'
import { Tag as TagIcon, Plus } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { TagEditModal } from './TagEditModal'

interface TagEditorProps {
    repoId: string
    currentTags: string[]
}

/**
 * Button that opens a modal to edit tags.
 */
export function TagEditor({ repoId, currentTags }: TagEditorProps) {
    const [open, setOpen] = useState(false)
    const isSyncing = useStore(state => state.isSyncing)

    return (
        <>
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(true) }}
                disabled={isSyncing}
                title={isSyncing ? "Tagging unavailable during global sync" : "Edit tags"}
                className={`rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
                <TagIcon className="h-3.5 w-3.5" />
            </button>
            {open && <TagEditModal repoId={repoId} initialTags={currentTags} onClose={() => setOpen(false)} />}
        </>
    )
}

export { Plus }
