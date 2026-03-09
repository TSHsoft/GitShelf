import { useState } from 'react'
import { Tag as TagIcon, Plus } from 'lucide-react'
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

    return (
        <>
            <button
                onClick={(e) => { e.stopPropagation(); setOpen(true) }}
                title="Edit tags"
                className="rounded p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
                <TagIcon className="h-3.5 w-3.5" />
            </button>
            {open && <TagEditModal repoId={repoId} initialTags={currentTags} onClose={() => setOpen(false)} />}
        </>
    )
}

export { Plus }
