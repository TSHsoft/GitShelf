import type { SortField } from '@/types'

export const COLUMNS: { key: SortField | 'select'; label: string; width: string }[] = [
    { key: 'select', label: '', width: 'w-10' },
    { key: 'name', label: 'Repository', width: 'flex-[3]' },
    { key: 'status', label: 'Status', width: 'w-24' },
    { key: 'stars', label: 'Stars', width: 'w-24' },
    { key: 'language', label: 'Language', width: 'w-24' },
    { key: 'added_at', label: 'Added', width: 'w-24' },
    { key: 'last_push_at', label: 'Last Push', width: 'w-24' },
    { key: 'latest_release', label: 'Release', width: 'w-24' },
]
