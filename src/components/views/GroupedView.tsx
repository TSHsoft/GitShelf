import React, { useState, useMemo, useRef, useEffect } from 'react'
import { ChevronRight, Tag as TagIcon, Code2, AlertTriangle, Layers, Activity, Archive, Trash2, Clock, RefreshCw, Calendar } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import type { Repository, ViewMode, GroupBy } from '@/types'
import { useStore } from '@/store/useStore'
import { getLanguageColor } from '@/lib/github'
import { SortableCard } from './CardView'
import { TableRow } from './TableView'
import { COLUMNS } from './columns'
import { RepoDrawer } from '@/components/RepoDrawer'
import { useVirtualizer } from '@tanstack/react-virtual'

interface Group {
    key: string
    label: string
    color?: string
    repos: Repository[]
}

function buildGroups(repos: Repository[], groupBy: GroupBy, tags: Record<string, { id: string; name: string; color: string }>): Group[] {
    const sortByName = (g: Group) => {
        g.repos.sort((a, b) => a.name.localeCompare(b.name))
        return g
    }

    if (groupBy === 'tag') {
        const tagGroups: Record<string, Group> = {}
        const untagged: Repository[] = []
        for (const repo of repos) {
            if (repo.tags.length === 0) untagged.push(repo)
            else {
                for (const tagId of repo.tags) {
                    const tag = tags[tagId]
                    if (!tag) continue
                    if (!tagGroups[tagId]) tagGroups[tagId] = { key: tagId, label: tag.name, color: tag.color, repos: [] }
                    tagGroups[tagId].repos.push(repo)
                }
            }
        }
        const result = Object.values(tagGroups).sort((a, b) => a.label.localeCompare(b.label)).map(sortByName)
        if (untagged.length > 0) result.push(sortByName({ key: '__untagged__', label: 'Untagged', repos: untagged }))
        return result
    }

    if (groupBy === 'language') {
        const langGroups: Record<string, Group> = {}
        for (const repo of repos) {
            const lang = repo.language ?? 'Unknown'
            if (!langGroups[lang]) langGroups[lang] = { key: lang, label: lang, color: getLanguageColor(repo.language), repos: [] }
            langGroups[lang].repos.push(repo)
        }
        return Object.values(langGroups).sort((a, b) => b.repos.length - a.repos.length).map(sortByName)
    }

    if (groupBy === 'status') {
        const order = ['active', 'stale', 'archived', 'renamed', 'not_found', 'deleted']
        const statusGroups: Record<string, Group> = {}
        for (const repo of repos) {
            const s = repo.status
            if (!statusGroups[s]) statusGroups[s] = { key: s, label: s === 'not_found' ? 'Not Found' : s.charAt(0).toUpperCase() + s.slice(1), repos: [] }
            statusGroups[s].repos.push(repo)
        }
        return order.filter(s => statusGroups[s]).map(s => sortByName(statusGroups[s]))
    }

    if (groupBy === 'added_at') {
        const monthGroups: Record<string, Group> = {}
        for (const repo of repos) {
            const date = new Date(repo.added_at)
            const year = date.getFullYear()
            const month = date.getMonth()
            const monthName = new Intl.DateTimeFormat('en-US', { month: 'long' }).format(date)
            const sortKey = `${year}-${String(month).padStart(2, '0')}`
            if (!monthGroups[sortKey]) monthGroups[sortKey] = { key: sortKey, label: `${monthName} ${year}`, repos: [] }
            monthGroups[sortKey].repos.push(repo)
        }
        return Object.values(monthGroups).sort((a, b) => b.key.localeCompare(a.key)).map(sortByName)
    }

    return [{ key: 'all', label: 'All', repos: [...repos].sort((a, b) => a.name.localeCompare(b.name)) }]
}

function GroupHeader({ group, groupBy, collapsed, onToggle }: {
    group: Group
    groupBy: GroupBy
    collapsed: boolean
    onToggle: () => void
}) {
    let Icon = Layers
    if (groupBy === 'tag') Icon = TagIcon
    else if (groupBy === 'language') Icon = Code2
    else if (groupBy === 'added_at') Icon = Calendar
    else if (groupBy === 'status') {
        switch (group.key) {
            case 'active': Icon = Activity; break;
            case 'archived': Icon = Archive; break;
            case 'deleted': Icon = Trash2; break;
            case 'stale': Icon = Clock; break;
            case 'renamed': Icon = RefreshCw; break;
            default: Icon = AlertTriangle;
        }
    }

    return (
        <button
            onClick={onToggle}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[var(--color-surface-2)] bg-[var(--color-bg)] border-b border-[var(--color-border)]"
        >
            <ChevronRight className={`h-4 w-4 text-[var(--color-text-muted)] transition-transform shrink-0 ${collapsed ? '' : 'rotate-90'}`} />
            {group.color ? (
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: group.color }} />
            ) : (
                <Icon className="h-3.5 w-3.5 text-[var(--color-text-muted)] shrink-0" />
            )}
            <span className="text-sm font-semibold text-[var(--color-text)]">{group.label}</span>
            <span className="ml-auto rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] px-2 py-0.5 text-xs font-medium text-[var(--color-text-muted)]">
                {group.repos.length}
            </span>
        </button>
    )
}

interface GroupedViewProps {
    repos: Repository[]
    viewMode: ViewMode
    groupBy: GroupBy
    selectedIds: Set<string> | null
    onToggle: ((repoId: string) => void) | undefined
}

interface FlattenedEntry {
    type: 'header' | 'row'
    group: Group
    repos?: Repository[] // For type: row
}

export const GroupedView = React.memo(function GroupedView({ repos, viewMode, groupBy, selectedIds, onToggle }: GroupedViewProps) {
    const { tags, githubToken, activeRepoId, setActiveRepoId } = useStore(useShallow(state => ({
        tags: state.data.tags,
        githubToken: state.githubToken,
        activeRepoId: state.activeRepoId,
        setActiveRepoId: state.setActiveRepoId
    })))
    const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
    const parentRef = useRef<HTMLDivElement>(null)
    const [columns, setColumns] = useState(2)

    useEffect(() => {
        if (viewMode !== 'card') return
        const updateColumns = () => setColumns(window.innerWidth >= 1280 ? 3 : 2)
        updateColumns()
        window.addEventListener('resize', updateColumns)
        return () => window.removeEventListener('resize', updateColumns)
    }, [viewMode])

    const groups = useMemo(() => buildGroups(repos, groupBy, tags), [repos, groupBy, tags])

    const entries = useMemo(() => {
        const list: FlattenedEntry[] = []
        groups.forEach(group => {
            list.push({ type: 'header', group })
            if (!(collapsed[group.key] ?? true)) {
                const groupRepos = group.repos
                const chunkSize = viewMode === 'card' ? columns : 1
                for (let i = 0; i < groupRepos.length; i += chunkSize) {
                    list.push({
                        type: 'row',
                        group,
                        repos: groupRepos.slice(i, i + chunkSize)
                    })
                }
            }
        })
        return list
    }, [groups, collapsed, viewMode, columns])

    // eslint-disable-next-line react-hooks/incompatible-library
    const virtualizer = useVirtualizer({
        count: entries.length,
        getScrollElement: () => parentRef.current,
        estimateSize: (index) => entries[index].type === 'header' ? 44 : (viewMode === 'card' ? 200 : 64),
        overscan: 10,
    })

    const toggle = (key: string) => {
        setCollapsed((prev) => ({ ...prev, [key]: !(prev[key] ?? true) }))
    }

    const handleRowClick = (repoId: string) => {
        if (!githubToken) return
        setActiveRepoId(repoId)
    }

    const selectedIdsArray: string[] = useMemo(() => selectedIds ? Array.from(selectedIds) : [], [selectedIds])

    return (
        <div className="flex flex-col h-full overflow-hidden">
            {(viewMode === 'table' || viewMode === 'list') && (
                <div className="flex items-center border-b border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-2 text-xs font-semibold text-[var(--color-text-muted)] shrink-0 z-10 w-full">
                    {COLUMNS.map((col, i) => (
                        <div key={i} className={`flex items-center gap-1 ${col.width}`}>{col.label}</div>
                    ))}
                    <div className="w-24" />
                </div>
            )}

            <div ref={parentRef} className="flex-1 overflow-y-auto">
                <div style={{ height: `${virtualizer.getTotalSize()}px`, width: '100%', position: 'relative' }}>
                    {virtualizer.getVirtualItems().map((virtualItem) => {
                        const entry = entries[virtualItem.index]
                        return (
                            <div
                                key={`${entry.group.key}-${virtualItem.index}`}
                                data-index={virtualItem.index}
                                ref={virtualizer.measureElement}
                                style={{
                                    position: 'absolute',
                                    top: 0, left: 0, width: '100%',
                                    transform: `translateY(${virtualItem.start}px)`,
                                }}
                            >
                                {entry.type === 'header' ? (
                                    <GroupHeader
                                        group={entry.group}
                                        groupBy={groupBy}
                                        collapsed={collapsed[entry.group.key] ?? true}
                                        onToggle={() => toggle(entry.group.key)}
                                    />
                                ) : (
                                    <div className={viewMode === 'card' ? 'grid grid-cols-2 xl:grid-cols-3 gap-3 p-4 pt-0' : ''}>
                                        {entry.repos?.map(repo => (
                                            viewMode === 'card' ? (
                                                <SortableCard
                                                    key={repo.id}
                                                    repo={repo}
                                                    selected={selectedIds?.has(repo.id) ?? false}
                                                    selectedIds={selectedIdsArray}
                                                />
                                            ) : (
                                                <TableRow
                                                    key={repo.id}
                                                    repo={repo}
                                                    selected={selectedIds?.has(repo.id) ?? false}
                                                    selectedIds={selectedIdsArray}
                                                    onClick={() => handleRowClick(repo.id)}
                                                    onToggle={() => onToggle?.(repo.id)}
                                                    githubToken={githubToken}
                                                />
                                            )
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </div>
            </div>

            {activeRepoId && (
                <RepoDrawer
                    repoId={activeRepoId}
                    onClose={() => setActiveRepoId(null)}
                />
            )}
        </div>
    )
})
