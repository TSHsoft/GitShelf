import { nanoid } from 'nanoid'

export { nanoid }

export function formatDate(timestamp: number | string): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function formatRelativeTime(ts: number | null): string {
    if (!ts) return 'Never'
    const diffSec = Math.floor((Date.now() - ts) / 1000)
    if (diffSec < 60) return 'Just now'
    const diffMin = Math.floor(diffSec / 60)
    if (diffMin < 60) return `${diffMin}m ago`
    const diffHour = Math.floor(diffMin / 60)
    if (diffHour < 24) return `${diffHour}h ago`
    const diffDay = Math.floor(diffHour / 24)
    if (diffDay < 7) return `${diffDay}d ago`
    const diffWeek = Math.floor(diffDay / 7)
    if (diffWeek < 5) return `${diffWeek}w ago`
    const diffMonth = Math.floor(diffDay / 30)
    if (diffMonth < 12) return `${diffMonth}mo ago`
    return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
    let timer: ReturnType<typeof setTimeout>
    return ((...args: unknown[]) => {
        clearTimeout(timer)
        timer = setTimeout(() => fn(...args), delay)
    }) as T
}

export const TAG_COLORS = [
    '#ec4899', // Pink
    '#ef4444', // Red
    '#f97316', // Orange
    '#eab308', // Yellow
    '#84cc16', // Lime
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#6366f1', // Indigo
    '#8b5cf6'  // Violet
]

export function generateTagColor(excludeColor?: string): string {
    const availableColors = excludeColor 
        ? TAG_COLORS.filter(c => c !== excludeColor)
        : TAG_COLORS
    return availableColors[Math.floor(Math.random() * availableColors.length)]
}
