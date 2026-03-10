import { useState } from 'react'
import { LayoutGrid, Table2, Layers, ChevronDown, Check } from 'lucide-react'
import type { ViewMode, GroupBy } from '@/types'
import { useStore } from '@/store/useStore'

const VIEWS: { mode: ViewMode; icon: typeof LayoutGrid; label: string }[] = [
    { mode: 'card', icon: LayoutGrid, label: 'Card' },
    { mode: 'table', icon: Table2, label: 'Table' },
]

const GROUP_OPTIONS: { value: GroupBy; label: string }[] = [
    { value: 'none', label: 'No grouping' },
    { value: 'tag', label: 'Group by Tag' },
    { value: 'language', label: 'Group by Language' },
    { value: 'status', label: 'Group by Status' },
    { value: 'added_at', label: 'Group by Added Date' },
]

export function ViewSwitcher() {
    const { viewMode, setViewMode, groupBy, setGroupBy } = useStore()
    const [groupOpen, setGroupOpen] = useState(false)

    const activeGroup = GROUP_OPTIONS.find((o) => o.value === groupBy)

    return (
        <div className="flex items-center gap-1.5">
            {/* View mode toggle */}
            <div className="flex items-center gap-0.5 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-0.5">
                {VIEWS.map(({ mode, icon: Icon, label }) => (
                    <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        title={label}
                        className={`flex items-center justify-center rounded-md p-1.5 transition-all ${viewMode === mode
                            ? 'bg-[var(--color-accent)] text-white shadow-sm'
                            : 'text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                            }`}
                    >
                        <Icon className="h-3.5 w-3.5" />
                    </button>
                ))}
            </div>

            {/* Group by dropdown */}
            <div className="relative">
                <button
                    onClick={() => setGroupOpen((v) => !v)}
                    title="Group by"
                    className={`flex h-[30px] items-center gap-1.5 rounded-lg border px-2.5 text-xs font-semibold transition-all ${groupBy !== 'none'
                        ? 'border-[var(--color-accent)]/50 bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                        : 'border-[var(--color-border)] bg-[var(--color-surface-2)] text-[var(--color-text-muted)] hover:text-[var(--color-text)]'
                        }`}
                >
                    <Layers className="h-3.5 w-3.5" />
                    {groupBy !== 'none' ? activeGroup?.label.replace('Group by ', '') : 'Group'}
                    <ChevronDown className={`h-3 w-3 transition-transform ${groupOpen ? 'rotate-180' : ''}`} />
                </button>

                {groupOpen && (
                    <div
                        className="absolute right-0 top-full z-50 mt-1 w-44 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl shadow-black/30 animate-fade-in"
                        onMouseLeave={() => setGroupOpen(false)}
                    >
                        <p className="px-3 pt-2.5 pb-1 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
                            Group by
                        </p>
                        <div className="flex flex-col pb-1.5">
                            {GROUP_OPTIONS.map((opt) => (
                                <button
                                    key={opt.value}
                                    onClick={() => { setGroupBy(opt.value); setGroupOpen(false) }}
                                    className="flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--color-text-subtle)] transition-colors hover:bg-[var(--color-surface-2)]"
                                >
                                    <span className="flex-1 text-left">{opt.label}</span>
                                    {groupBy === opt.value && <Check className="h-3.5 w-3.5 text-[var(--color-accent)]" />}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
