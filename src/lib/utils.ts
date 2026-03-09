import { nanoid } from 'nanoid'

export { nanoid }

export function formatDate(timestamp: number | string): string {
    const date = typeof timestamp === 'number' ? new Date(timestamp) : new Date(timestamp)
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): T {
    let timer: ReturnType<typeof setTimeout>
    return ((...args: unknown[]) => {
        clearTimeout(timer)
        timer = setTimeout(() => fn(...args), delay)
    }) as T
}

export function generateTagColor(): string {
    const colors = [
        '#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b',
        '#10b981', '#06b6d4', '#f97316', '#84cc16',
    ]
    return colors[Math.floor(Math.random() * colors.length)]
}
