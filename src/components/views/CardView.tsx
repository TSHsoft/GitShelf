import type { Repository } from '@/types'
import { useStore } from '@/store/useStore'
import { RepoCard } from '@/components/RepoCard'

interface CardViewProps {
    repos: Repository[]
}

export function CardView({ repos }: CardViewProps) {
    const { activeRepoId, setActiveRepoId, githubToken } = useStore()

    // Export SortableCard for GroupedView? 
    // Wait, GroupedView needs plain cards now.
    // I will remove SortableCard export and GroupedView import.

    return (
        <div className="h-full overflow-y-auto p-4">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {repos.map((repo) => (
                    <RepoCard
                        key={repo.id}
                        repo={repo}
                        isActive={activeRepoId === repo.id}
                        onClick={() => {
                            if (!githubToken) return
                            setActiveRepoId(activeRepoId === repo.id ? null : repo.id)
                        }}
                    />
                ))}
            </div>
        </div>
    )
}

// Export a plain wrapper if GroupedView expects it, or just update GroupedView to use RepoCard directly.
// I'll export a simple wrapper for now to minimize GroupedView changes if it imports SortableCard.
export function SortableCard({ repo }: { repo: Repository }) {
    const { activeRepoId, setActiveRepoId, githubToken } = useStore()
    return (
        <RepoCard
            repo={repo}
            isActive={activeRepoId === repo.id}
            onClick={() => {
                if (!githubToken) return
                setActiveRepoId(activeRepoId === repo.id ? null : repo.id)
            }}
        />
    )
}
