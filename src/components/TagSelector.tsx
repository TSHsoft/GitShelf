import { Tag as TagIcon } from 'lucide-react'
import { useStore } from '@/store/useStore'

interface TagSelectorProps {
    selectedTagIds: string[]
    onChange: (ids: string[]) => void
}

export function TagSelector({ selectedTagIds, onChange }: TagSelectorProps) {
    const { data } = useStore()
    const allTags = Object.values(data.tags).sort((a, b) => {
        if (a.sort_order !== undefined && b.sort_order !== undefined) {
            return a.sort_order - b.sort_order
        }
        return a.name.localeCompare(b.name)
    })
    const toggleTag = (tagId: string) => {
        const newIds = selectedTagIds.includes(tagId)
            ? selectedTagIds.filter((t) => t !== tagId)
            : [...selectedTagIds, tagId]
        onChange(newIds)
    }

    const clearAll = () => onChange([])

    return (
        <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-[var(--color-text-muted)] flex items-center gap-1">
                    <TagIcon className="h-3 w-3" /> Tags (optional)
                </p>
                {selectedTagIds.length > 0 && (
                    <button
                        onClick={clearAll}
                        className="text-xs text-[var(--color-text-muted)] hover:text-[var(--color-danger)] transition-colors"
                    >
                        Clear All
                    </button>
                )}
            </div>

            {allTags.length === 0 ? (
                <p className="text-xs text-[var(--color-text-subtle)] text-center py-3">
                    No tags available. Create tags in the sidebar first.
                </p>
            ) : (
                <div className="flex flex-wrap gap-1.5">
                    {allTags.map(tag => {
                        const isSelected = selectedTagIds.includes(tag.id)
                        return (
                            <button
                                key={tag.id}
                                onClick={() => toggleTag(tag.id)}
                                className={`
                                    flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all
                                    ${isSelected
                                        ? 'border-[var(--color-accent)] shadow-sm'
                                        : 'border-transparent bg-[var(--color-surface-2)] text-[var(--color-text-subtle)] hover:bg-[var(--color-surface-3)] hover:text-[var(--color-text)]'
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
    )
}
