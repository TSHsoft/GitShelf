import { getLanguageColor } from '@/lib/github'

interface LanguageBarProps {
    languages?: Record<string, number>
    language?: string | null
    /** Show labels next to dots. Default: true for 'bar', false for 'dots' */
    mode?: 'bar' | 'dots'
}

/**
 * Multi-language display for repositories.
 * - 'bar' mode: proportional color bar + labels (for card view)
 * - 'dots' mode: compact colored dots (for list/table view)
 *
 * Falls back to single-language display when `languages` data is not available.
 */
export function LanguageBar({ languages, language, mode = 'bar' }: LanguageBarProps) {
    // Build sorted entries
    const entries = languages
        ? Object.entries(languages).sort(([, a], [, b]) => b - a)
        : language
            ? [[language, 1] as [string, number]]
            : []

    if (entries.length === 0) return null

    const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0)

    // Dots mode — compact, for list/table
    if (mode === 'dots') {
        const top = entries.slice(0, 4)

        // Special case: Single language -> show name
        if (entries.length === 1) {
            const [lang] = entries[0]
            return (
                <div className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: getLanguageColor(lang) }} />
                    <span className="text-xs text-[var(--color-text-subtle)] truncate">{lang}</span>
                </div>
            )
        }

        return (
            <div className="flex items-center gap-1.5" title={entries.map(([l, b]) => `${l} ${((b / total) * 100).toFixed(1)}%`).join('\n')}>
                {top.map(([lang]) => (
                    <span
                        key={lang}
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: getLanguageColor(lang) }}
                        title={lang}
                    />
                ))}
                {entries.length > 4 && (
                    <span className="text-xs text-[var(--color-text-muted)]">+{entries.length - 4}</span>
                )}
            </div>
        )
    }

    // Bar mode — proportional colors + top labels
    const top = entries.slice(0, 5)
    const otherBytes = entries.slice(5).reduce((sum, [, b]) => sum + b, 0)

    return (
        <div className="flex flex-col gap-1.5">
            {/* Color bar */}
            <div
                className="flex h-1.5 w-full overflow-hidden rounded-full"
                title={entries.map(([l, b]) => `${l} ${((b / total) * 100).toFixed(1)}%`).join('\n')}
            >
                {entries.map(([lang, bytes]) => (
                    <div
                        key={lang}
                        className="h-full transition-all"
                        style={{
                            width: `${(bytes / total) * 100}%`,
                            backgroundColor: getLanguageColor(lang),
                            minWidth: bytes / total > 0.01 ? '3px' : '0px',
                        }}
                    />
                ))}
            </div>

            {/* Labels */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
                {top.map(([lang, bytes]) => (
                    <div key={lang} className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: getLanguageColor(lang) }} />
                        <span className="text-xs text-[var(--color-text-muted)]">
                            {lang} <span className="opacity-60">{((bytes / total) * 100).toFixed(1)}%</span>
                        </span>
                    </div>
                ))}
                {otherBytes > 0 && (
                    <span className="text-xs text-[var(--color-text-muted)] opacity-60">
                        +{entries.length - 5} others
                    </span>
                )}
            </div>
        </div>
    )
}
