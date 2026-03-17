import React, { useMemo, useCallback, useRef, useState, useEffect } from 'react'
import type { Repository } from '@/types'
import { useStore } from '@/store/useStore'
import { RepoCard } from '@/components/RepoCard'
import { RepoDrawer } from '@/components/RepoDrawer'
import { useVirtualizer } from '@tanstack/react-virtual'

import { useShallow } from 'zustand/react/shallow'
import type { GitShelfStore } from '@/store/types'

interface CardViewProps {
    repos: Repository[]
    selectedIds: Set<string> | null
}

export const CardView = React.memo(function CardView({ repos, selectedIds }: CardViewProps) {
    const { activeRepoId, setActiveRepoId } = useStore(useShallow((state: GitShelfStore) => ({
        activeRepoId: state.activeRepoId,
        setActiveRepoId: state.setActiveRepoId
    })))
    
    const parentRef = useRef<HTMLDivElement>(null)
    const [columns, setColumns] = useState(2)

    // Detect column count based on Tailwind xl breakpoint (1280px)
    useEffect(() => {
        const updateColumns = () => {
            setColumns(window.innerWidth >= 1280 ? 3 : 2)
        }
        updateColumns()
        window.addEventListener('resize', updateColumns)
        return () => window.removeEventListener('resize', updateColumns)
    }, [])

    // Chunk repos into rows
    const rows = useMemo(() => {
        const chunks = []
        for (let i = 0; i < repos.length; i += columns) {
            chunks.push(repos.slice(i, i + columns))
        }
        return chunks
    }, [repos, columns])

    // eslint-disable-next-line react-hooks/incompatible-library
    const rowVirtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 200, // Estimate height of a RepoCard + gap
        overscan: 5,
    })

    const selectedIdsArray = useMemo(() => selectedIds ? Array.from(selectedIds) : [], [selectedIds])

    return (
        <div ref={parentRef} className="h-full overflow-y-auto p-4 scroll-smooth">
            <div
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                }}
            >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => (
                    <div
                        key={virtualRow.index}
                        data-index={virtualRow.index}
                        ref={rowVirtualizer.measureElement}
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            transform: `translateY(${virtualRow.start}px)`,
                        }}
                    >
                        <div className={`grid ${columns === 3 ? 'grid-cols-3' : 'grid-cols-2'} gap-3 p-1`}>
                            {rows[virtualRow.index].map((repo) => (
                                <SortableCard
                                    key={repo.id}
                                    repo={repo}
                                    selected={selectedIds?.has(repo.id) ?? false}
                                    selectedIds={selectedIdsArray}
                                />
                            ))}
                        </div>
                    </div>
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
    const { isActive, setActiveRepoId, githubToken } = useStore(useShallow((state: GitShelfStore) => ({
        isActive: state.activeRepoId === repo.id,
        setActiveRepoId: state.setActiveRepoId,
        githubToken: state.githubToken
    })))

    const handleClick = useCallback(() => {
        if (!githubToken) return
        setActiveRepoId(isActive ? null : repo.id)
    }, [isActive, githubToken, repo.id, setActiveRepoId])
    
    return (
        <RepoCard
            repo={repo}
            isActive={isActive}
            selected={selected}
            selectedIds={selectedIds}
            onClick={handleClick}
        />
    )
})
