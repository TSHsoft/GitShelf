import React, { useMemo, useCallback } from 'react'
import type { Repository } from '@/types'
import { useStore } from '@/store/useStore'
import { RepoCard } from '@/components/RepoCard'
import { RepoDrawer } from '@/components/RepoDrawer'

interface CardViewProps {
    repos: Repository[]
    selectedIds: Set<string> | null
}

export const CardView = React.memo(function CardView({ repos, selectedIds }: CardViewProps) {
    const { activeRepoId, setActiveRepoId } = useStore()
    const selectedIdsArray = useMemo(() => selectedIds ? Array.from(selectedIds) : [], [selectedIds])

    return (
        <div className="h-full overflow-y-auto p-4">
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
                {repos.map((repo) => (
                    <SortableCard
                        key={repo.id}
                        repo={repo}
                        selected={selectedIds?.has(repo.id) ?? false}
                        selectedIds={selectedIdsArray}
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
})
 
export const SortableCard = React.memo(function SortableCard({ repo, selected, selectedIds }: {
    repo: Repository,
    selected?: boolean,
    selectedIds?: string[]
}) {
    const { activeRepoId, setActiveRepoId, githubToken } = useStore()

    const handleClick = useCallback(() => {
        if (!githubToken) return
        setActiveRepoId(activeRepoId === repo.id ? null : repo.id)
    }, [activeRepoId, githubToken, repo.id, setActiveRepoId])
    return (
        <RepoCard
            repo={repo}
            isActive={activeRepoId === repo.id}
            selected={selected}
            selectedIds={selectedIds}
            onClick={handleClick}
        />
    )
})
