import type { Repository } from '@/types'
import { useStore } from '@/store/useStore'
import { RepoCard } from '@/components/RepoCard'
import { RepoDrawer } from '@/components/RepoDrawer'

interface CardViewProps {
    repos: Repository[]
    selectedIds: Set<string> | null
}

export function CardView({ repos, selectedIds }: CardViewProps) {
    const { activeRepoId, setActiveRepoId } = useStore()

    return (
        <div className="h-full overflow-y-auto p-4">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {repos.map((repo) => (
                    <SortableCard
                        key={repo.id}
                        repo={repo}
                        selected={selectedIds?.has(repo.id) ?? false}
                        selectedIds={selectedIds ? Array.from(selectedIds) : []}
                    />
                ))}
            </div>

            {/* Drawer */}
            {activeRepoId && (
                <RepoDrawer
                    repoId={activeRepoId}
                    onClose={() => setActiveRepoId(null)}
                />
            )}
        </div>
    )
}

export function SortableCard({ repo, selected, selectedIds }: {
    repo: Repository,
    selected?: boolean,
    selectedIds?: string[]
}) {
    const { activeRepoId, setActiveRepoId, githubToken } = useStore()
    return (
        <RepoCard
            repo={repo}
            isActive={activeRepoId === repo.id}
            selected={selected}
            selectedIds={selectedIds}
            onClick={() => {
                if (!githubToken) return
                setActiveRepoId(activeRepoId === repo.id ? null : repo.id)
            }}
        />
    )
}
