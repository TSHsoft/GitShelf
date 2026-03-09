import { useState, useMemo } from 'react'
import { Search, Plus, Trash2, X } from 'lucide-react'
import { useStore } from '@/store/useStore'
import { AddRepoModal } from './AddRepoModal'
import { ViewSwitcher } from './ViewSwitcher'
import { SyncButton } from './SyncButton'
import { TableView } from './views/TableView'
import { CardView } from './views/CardView'
import { GroupedView } from './views/GroupedView'
import type { Repository } from '@/types'

/** Compute the sorted flat list of repos (shared across all views) */
function useSortedRepos(): Repository[] {
    const { data, searchQuery, selectedTagId, sortField, sortDir, viewMode, filterLanguage, filterStars, filterUpdated, filterTag, filterType } = useStore()

    return useMemo(() => {
        let list = Object.values(data.repositories)

        // Filter by tag
        if (selectedTagId) {
            list = list.filter((r) => r.tags.includes(selectedTagId))
        }

        // Filter by type
        if (filterType) {
            list = list.filter((r) => r.type === filterType)
        }

        // Filter by search
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase()
            list = list.filter(
                (r) =>
                    (r.name || '').toLowerCase().includes(q) ||
                    (r.owner || '').toLowerCase().includes(q) ||
                    (r.description ?? '').toLowerCase().includes(q) ||
                    (r.language ?? '').toLowerCase().includes(q)
            )
        }

        // Advanced Filters
        if (filterLanguage) {
            list = list.filter(r => r.language === filterLanguage)
        }

        if (filterStars) {
            list = list.filter(r => {
                const stars = r.stars
                if (filterStars === '>1k') return stars > 1000
                if (filterStars === '>5k') return stars > 5000
                if (filterStars === '>10k') return stars > 10000
                if (filterStars === '>50k') return stars > 50000
                return true
            })
        }

        if (filterUpdated) {
            const now = Date.now()
            const oneDay = 24 * 60 * 60 * 1000
            list = list.filter(r => {
                const lastPush = r.last_push_at ? new Date(r.last_push_at).getTime() : 0
                // Active filters: updated within X days
                if (filterUpdated === 'week') return (now - lastPush) < (7 * oneDay)
                if (filterUpdated === 'month') return (now - lastPush) < (30 * oneDay)
                if (filterUpdated === 'year') return (now - lastPush) < (365 * oneDay)
                // Stale filters: NOT updated for X days
                if (filterUpdated === 'stale_1m') return (now - lastPush) > (30 * oneDay)
                if (filterUpdated === 'stale_3m') return (now - lastPush) > (90 * oneDay)
                if (filterUpdated === 'stale_6m') return (now - lastPush) > (180 * oneDay)
                if (filterUpdated === 'stale_1y') return (now - lastPush) > (365 * oneDay)
                return true
            })
        }



        if (filterTag) {
            list = list.filter(r => r.tags.includes(filterTag))
        }

        if (filterTag) {
            list = list.filter(r => r.tags.includes(filterTag))
        }





        // Sort logic
        return [...list].sort((a, b) => {
            // Card View: Sort by Tag (first alphabetical) -> then Repo Name
            if (viewMode === 'card') {
                // Get first tag name for a
                const aTags = a.tags.map(id => data.tags[id]?.name || '').sort()
                const aTag = aTags.length > 0 ? aTags[0].toLowerCase() : 'zzz' // Untagged at end

                // Get first tag name for b
                const bTags = b.tags.map(id => data.tags[id]?.name || '').sort()
                const bTag = bTags.length > 0 ? bTags[0].toLowerCase() : 'zzz'

                if (aTag !== bTag) return aTag.localeCompare(bTag)
                return a.name.localeCompare(b.name)
            }

            // Table View (or other): Sort by column
            let av: string | number = a[sortField] ?? ''
            let bv: string | number = b[sortField] ?? ''

            // Special case for language: sort by primary language name
            if (sortField === 'language') {
                av = a.language || ''
                bv = b.language || ''
            }
            // Special case for stars
            if (sortField === 'stars') { av = a.stars; bv = b.stars }

            // Special case for date fields
            if (sortField === 'last_push_at' || sortField === 'added_at') {
                // Handle empty strings for dates (treat as old)
                if (av === '') av = '0'
                if (bv === '') bv = '0'
            }

            const cmp = av < bv ? -1 : av > bv ? 1 : 0
            return sortDir === 'asc' ? cmp : -cmp
        })
    }, [data.repositories, searchQuery, selectedTagId, sortField, sortDir, viewMode, data.tags, filterLanguage, filterStars, filterUpdated, filterTag, filterType])
}

import { ConfirmDialog } from './ConfirmDialog'
import { CustomSelect } from './CustomSelect'
import { BulkTagDialog } from './BulkTagDialog'

export function RepoList() {
    const { viewMode, groupBy, searchQuery, statusFilter, setStatusFilter, removeRepository, data, filterTag, setFilterTag, filterLanguage, setFilterLanguage, filterStars, setFilterStars, filterUpdated, setFilterUpdated, filterType, setFilterType, githubToken } = useStore()
    const [showAddModal, setShowAddModal] = useState(false)
    const [showBulkTagDialog, setShowBulkTagDialog] = useState(false)
    const [selectedRepoIds, setSelectedRepoIds] = useState<Set<string>>(new Set())

    // Confirmation State
    const [confirmAction, setConfirmAction] = useState<{
        isOpen: boolean
        title: string
        description: string
        variant: 'danger' | 'warning' | 'default'
        onConfirm: () => void
    }>({
        isOpen: false,
        title: '',
        description: '',
        variant: 'default',
        onConfirm: () => { }
    })

    // Sort & Filter
    const repos = useSortedRepos()

    // Filter by status (on top of useSortedRepos which handles trash/search)
    const filteredRepos = useMemo(() => {
        if (statusFilter === 'all') return repos
        return repos.filter(r => r.status === statusFilter)
    }, [repos, statusFilter])

    const isEmpty = filteredRepos.length === 0
    const isGrouped = groupBy !== 'none'

    // Selection Handlers
    const toggleSelection = (id: string) => {
        const next = new Set(selectedRepoIds)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setSelectedRepoIds(next)
    }

    const toggleAll = () => {
        if (selectedRepoIds.size === filteredRepos.length) {
            setSelectedRepoIds(new Set())
        } else {
            setSelectedRepoIds(new Set(filteredRepos.map(r => r.id)))
        }
    }

    const hasSelection = selectedRepoIds.size > 0

    const handleBulkDelete = () => {
        setConfirmAction({
            isOpen: true,
            title: 'Delete Repositories',
            description: `Are you sure you want to delete ${selectedRepoIds.size} repositories? This action cannot be undone.`,
            variant: 'danger',
            onConfirm: () => {
                selectedRepoIds.forEach(id => removeRepository(id))
                setSelectedRepoIds(new Set())
            }
        })
    }

    return (
        <div className="flex flex-1 flex-col min-h-0">
            {/* Confirmation Dialog */}
            <ConfirmDialog
                isOpen={confirmAction.isOpen}
                title={confirmAction.title}
                description={confirmAction.description}
                variant={confirmAction.variant}
                confirmLabel="Delete"
                onConfirm={confirmAction.onConfirm}
                onClose={() => setConfirmAction(prev => ({ ...prev, isOpen: false }))}
            />

            {/* Toolbar */}
            <div className="h-[58px] flex items-center gap-2 border-b border-[var(--color-border)] px-4">
                {hasSelection ? (
                    <div className="flex-1 h-full flex items-center bg-[var(--color-accent)]/10 -mx-4 px-4">
                        <div className="flex items-center gap-4 mr-4">
                            <span className="font-semibold text-[var(--color-accent)]">{selectedRepoIds.size} selected</span>
                            <div className="h-4 w-px bg-[var(--color-accent)]/20" />
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowBulkTagDialog(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--color-surface)] text-[var(--color-text)] text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-surface-2)] transition-all"
                            >
                                <Plus className="h-3.5 w-3.5" /> Tag
                            </button>
                            <button
                                onClick={handleBulkDelete}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[var(--color-surface)] text-[var(--color-danger)] text-xs font-medium border border-[var(--color-border)] hover:bg-[var(--color-danger)] hover:text-white hover:border-transparent transition-all"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                        </div>
                        <div className="flex-1" />
                        <button
                            onClick={() => setSelectedRepoIds(new Set())}
                            className="p-1.5 hover:bg-[var(--color-accent)]/20 rounded text-[var(--color-accent)]"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Search & Standard Tools */}
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-text-muted)]" />
                            <input
                                value={searchQuery}
                                onChange={(e) => useStore.getState().setSearchQuery(e.target.value)}
                                placeholder="Search repos..."
                                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] pl-9 pr-9 h-[30px] text-xs font-semibold text-[var(--color-text)] outline-none focus:border-[var(--color-accent)] transition-colors"
                            />
                            {searchQuery.length > 0 && (
                                <button
                                    onClick={() => useStore.getState().setSearchQuery('')}
                                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-full transition-colors"
                                    title="Clear search"
                                >
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            )}
                        </div>
                        <SyncButton />
                        <ViewSwitcher />
                        <button
                            onClick={() => setShowAddModal(true)}
                            disabled={!githubToken}
                            title={!githubToken ? "GitHub token required to add a repository" : "Add repository"}
                            className="flex h-[30px] items-center gap-1.5 rounded-lg bg-[var(--color-accent)] px-3 text-xs font-semibold text-white transition-all hover:bg-[var(--color-accent-hover)] active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Plus className="h-3.5 w-3.5" />
                            Add
                        </button>
                    </>
                )}
            </div>

            {/* Advanced Filters */}
            {(
                <div className="flex items-center gap-3 px-4 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]/30 overflow-x-auto">
                    {/* Type toggle: All / Repos / Profiles */}
                    <div className="flex items-center rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5 gap-0.5 shrink-0">
                        {(['all', 'repository', 'profile'] as const).map((t) => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t === 'all' ? null : t)}
                                className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${(t === 'all' && !filterType) || filterType === t
                                    ? 'bg-[var(--color-accent)] text-white shadow-sm'
                                    : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                                    }`}
                            >
                                {t === 'all' ? 'All' : t === 'repository' ? 'Repos' : 'Profiles'}
                            </button>
                        ))}
                    </div>

                    <div className="h-4 w-px bg-[var(--color-border)]" />

                    {/* Status Filter */}
                    <div className="flex items-center gap-1.5 min-w-[140px]">
                        <CustomSelect
                            value={statusFilter === 'all' ? null : statusFilter}
                            onChange={(val) => setStatusFilter((val as any) || 'all')}
                            options={[
                                { value: 'active', label: 'Active' },
                                { value: 'stale', label: 'Stale' },
                                { value: 'archived', label: 'Archived' },
                                { value: 'renamed', label: 'Renamed' },
                                { value: 'not_found', label: 'Not Found' },
                            ]}
                            placeholder="Status: All"
                            searchable={false}
                            className="w-full"
                        />
                    </div>



                    {/* Tags Filter */}
                    <div className="h-4 w-px bg-[var(--color-border)]" />

                    <div className="flex items-center gap-1.5 min-w-[150px]">
                        <CustomSelect
                            value={filterTag}
                            onChange={(val) => setFilterTag(val)}
                            options={Object.values(data.tags).map(t => ({
                                value: t.id,
                                label: t.name,
                                color: t.color
                            }))}
                            placeholder="Tag: Any"
                            searchable={true}
                            className="w-full"
                        />
                    </div>



                    <div className="h-4 w-px bg-[var(--color-border)]" />

                    <div className="flex items-center gap-1.5 min-w-[140px]">
                        <CustomSelect
                            value={filterLanguage}
                            onChange={(val) => setFilterLanguage(val)}
                            options={Array.from(new Set(Object.values(data.repositories).map(r => r.language).filter(Boolean))).sort().map(lang => ({
                                value: lang!,
                                label: lang!
                            }))}
                            placeholder="Language: Any"
                            searchable={true}
                            className="w-full"
                        />
                    </div>

                    <div className="h-4 w-px bg-[var(--color-border)]" />

                    {/* Stars */}
                    <div className="flex items-center gap-1.5 min-w-[120px]">
                        <CustomSelect
                            value={filterStars}
                            onChange={(val) => setFilterStars(val)}
                            options={[
                                { value: '>1k', label: '> 1k Stars' },
                                { value: '>5k', label: '> 5k Stars' },
                                { value: '>10k', label: '> 10k Stars' },
                                { value: '>50k', label: '> 50k Stars' },
                            ]}
                            placeholder="Stars: Any"
                            searchable={false}
                            className="w-full"
                        />
                    </div>

                    <div className="h-4 w-px bg-[var(--color-border)]" />

                    {/* Updated */}
                    <div className="flex items-center gap-1.5 min-w-[160px]">
                        <CustomSelect
                            value={filterUpdated}
                            onChange={(val) => setFilterUpdated(val)}
                            options={[
                                { value: 'week', label: 'Active: Past Week' },
                                { value: 'month', label: 'Active: Past Month' },
                                { value: 'year', label: 'Active: Past Year' },
                                { value: 'stale_1m', label: 'Stale: 1+ Month' },
                                { value: 'stale_3m', label: 'Stale: 3+ Months' },
                                { value: 'stale_6m', label: 'Stale: 6+ Months' },
                                { value: 'stale_1y', label: 'Stale: 1+ Year' },
                            ]}
                            placeholder="Updated: Any"
                            searchable={false}
                            className="w-full"
                        />
                    </div>

                    {/* Clear Button */}
                    {(filterLanguage || filterStars || filterUpdated || filterTag || statusFilter !== 'all' || filterType) && (
                        <button
                            onClick={() => {
                                setFilterLanguage(null)
                                setFilterStars(null)
                                setFilterUpdated(null)
                                setFilterTag(null)
                                setFilterType(null)
                                setStatusFilter('all')
                            }}
                            className="text-xs text-[var(--color-accent)] hover:underline ml-auto font-medium"
                        >
                            Clear Filters
                        </button>
                    )}
                </div>
            )}

            {/* Content */}
            {isEmpty ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center px-8">
                    {/* ... Empty State ... */}
                    <span className="text-[var(--color-text-muted)]">No repositories found.</span>
                </div>
            ) : (
                <div className="flex-1 overflow-hidden relative flex flex-col">
                    {isGrouped ? (
                        <GroupedView repos={filteredRepos} viewMode={viewMode} groupBy={groupBy} />
                    ) : viewMode === 'card' ? (
                        <CardView repos={filteredRepos} />
                    ) : (
                        <TableView
                            repos={filteredRepos}
                            selectedIds={selectedRepoIds}
                            onToggle={toggleSelection}
                            onToggleAll={toggleAll}
                        />
                    )}
                </div>
            )}

            {/* Status Bar Footer */}
            <div className="px-4 py-1.5 flex items-center text-xs text-[var(--color-text-subtle)] border-t border-[var(--color-border)] bg-[var(--color-surface)] select-none">
                {(() => {
                    const repoCount = filteredRepos.filter(r => r.type === 'repository').length
                    const profileCount = filteredRepos.filter(r => r.type === 'profile').length
                    const stats = [
                        { label: 'Total', value: filteredRepos.length },
                        { label: 'Repositories', value: repoCount },
                        { label: 'Profiles', value: profileCount },
                    ]
                    return stats.map((s, i) => (
                        <span key={s.label} className="flex items-center">
                            {i > 0 && <span className="mx-3 h-3 w-px bg-[var(--color-border)]" />}
                            <span className="font-semibold text-[var(--color-text)]">{s.value}</span>
                            <span className="ml-1">{s.label}</span>
                        </span>
                    ))
                })()}
                {statusFilter !== 'all' && (
                    <span className="ml-3 px-1.5 py-0.5 rounded bg-[var(--color-surface-2)] text-[10px] font-medium uppercase tracking-wide">
                        {statusFilter.replace('_', ' ')}
                    </span>
                )}
            </div>

            {showAddModal && <AddRepoModal onClose={() => setShowAddModal(false)} />}
            {showBulkTagDialog && (
                <BulkTagDialog
                    repoIds={selectedRepoIds}
                    onClose={() => setShowBulkTagDialog(false)}
                />
            )}
        </div>
    )
}
