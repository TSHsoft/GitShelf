import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from 'react'
import { Search, X } from 'lucide-react'
import { useStore } from '@/store/useStore'

interface Props {
    /** Called whenever the plain-text part of the query changes */
    onSearchChange: (text: string) => void
    /** Called whenever the @topic tokens change */
    onTopicsChange: (topics: string[]) => void
    value: string
    topics: string[]
}

/** Topic badge — same visual style as the topic chips on repo cards */
function TopicPill({ label, onRemove }: { label: string; onRemove: () => void }) {
    return (
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/20 text-xs text-[var(--color-accent)] shrink-0 select-none">
            {label}
            <button
                type="button"
                onClick={onRemove}
                className="flex items-center hover:opacity-70 transition-opacity"
                tabIndex={-1}
            >
                <X className="h-2.5 w-2.5" />
            </button>
        </span>
    )
}

export function TokenizedSearch({ onSearchChange, onTopicsChange, value, topics }: Props) {
    const { data } = useStore()

    /** Text the user is currently composing */
    const [inputValue, setInputValue] = useState(value)
    /** Substring after the last `@` currently being typed, or null if not in @ mode */
    const [mentionQuery, setMentionQuery] = useState<string | null>(null)
    /** Index of the highlighted item in the dropdown */
    const [dropdownIndex, setDropdownIndex] = useState(0)

    const inputRef = useRef<HTMLInputElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)

    // Sync external text value into local state
    useEffect(() => {
        setInputValue(value)
    }, [value])

    // ---- Compute available topics from all repos ----
    const allTopics = Array.from(
        new Set(
            Object.values(data.repositories)
                .flatMap(r => r.topics ?? [])
                .filter(Boolean)
        )
    ).sort()

    // Filter by what the user has typed after @
    const dropdownOptions = mentionQuery === null
        ? []
        : allTopics.filter(
            t =>
                (mentionQuery === '' || t.toLowerCase().includes(mentionQuery.toLowerCase())) &&
                !topics.includes(t)           // hide already-selected ones
        )

    // ---- Handle text input changes ----
    const handleInput = useCallback(
        (raw: string) => {
            const atIdx = raw.lastIndexOf('@')

            if (atIdx !== -1) {
                const after = raw.slice(atIdx + 1)
                // Only open dropdown if the fragment contains no spaces (we're mid-token)
                if (!after.includes(' ')) {
                    setMentionQuery(after)
                    setDropdownIndex(0)
                    // Strip the @-token from the visible plain-text query sent upwards
                    const plainText = raw.slice(0, atIdx).trimEnd()
                    setInputValue(raw)
                    onSearchChange(plainText)
                    return
                }
            }

            // Normal typing — no active mention
            setMentionQuery(null)
            setInputValue(raw)
            onSearchChange(raw)
        },
        [onSearchChange]
    )

    // ---- Confirm a topic from the dropdown ----
    const confirmTopic = useCallback(
        (topic: string) => {
            const atIdx = inputValue.lastIndexOf('@')
            const plainText = atIdx !== -1 ? inputValue.slice(0, atIdx).trimEnd() : inputValue

            setInputValue(plainText)
            onSearchChange(plainText)
            onTopicsChange([...topics, topic])
            setMentionQuery(null)
            setDropdownIndex(0)
            inputRef.current?.focus()
        },
        [inputValue, topics, onSearchChange, onTopicsChange]
    )

    // ---- Keyboard handling ----
    const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        // Navigate / confirm dropdown
        if (mentionQuery !== null && dropdownOptions.length > 0) {
            if (e.key === 'ArrowDown') {
                e.preventDefault()
                setDropdownIndex(i => Math.min(i + 1, dropdownOptions.length - 1))
                return
            }
            if (e.key === 'ArrowUp') {
                e.preventDefault()
                setDropdownIndex(i => Math.max(i - 1, 0))
                return
            }
            if (e.key === 'Enter') {
                e.preventDefault()
                confirmTopic(dropdownOptions[dropdownIndex])
                return
            }
        }

        // Escape closes dropdown
        if (e.key === 'Escape' && mentionQuery !== null) {
            setMentionQuery(null)
            return
        }

        // Backspace with empty input removes last pill
        if (e.key === 'Backspace' && inputValue === '' && topics.length > 0) {
            onTopicsChange(topics.slice(0, -1))
        }
    }

    // Close dropdown when clicking outside
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setMentionQuery(null)
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [])

    const clearAll = () => {
        setInputValue('')
        onSearchChange('')
        onTopicsChange([])
        setMentionQuery(null)
        inputRef.current?.focus()
    }

    const hasContent = topics.length > 0 || inputValue.length > 0

    return (
        <div ref={containerRef} className="relative flex-1">
            {/* The composite input row */}
            <div
                className="flex items-center flex-wrap gap-1 w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] px-2 min-h-[30px] py-0.5 cursor-text focus-within:border-[var(--color-accent)] transition-colors"
                onClick={() => inputRef.current?.focus()}
            >
                {/* Search icon — only show when no pills */}
                {topics.length === 0 && (
                    <Search className="h-4 w-4 text-[var(--color-text-muted)] shrink-0 ml-1" />
                )}

                {/* Topic pills */}
                {topics.map(t => (
                    <TopicPill
                        key={t}
                        label={t}
                        onRemove={() => onTopicsChange(topics.filter(x => x !== t))}
                    />
                ))}

                {/* Text input — grows to fill remaining space */}
                <input
                    ref={inputRef}
                    value={inputValue}
                    onChange={e => handleInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={topics.length === 0 ? 'Search repos… or type @ for topics' : 'Add @topic or text…'}
                    className="flex-1 min-w-[80px] bg-transparent text-xs font-semibold text-[var(--color-text)] outline-none placeholder:text-[var(--color-text-muted)]"
                />

                {/* Clear-all button */}
                {hasContent && (
                    <button
                        type="button"
                        onClick={clearAll}
                        className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text)] rounded-full transition-colors shrink-0"
                        title="Clear search"
                    >
                        <X className="h-3.5 w-3.5" />
                    </button>
                )}
            </div>

            {/* @ Topics dropdown */}
            {mentionQuery !== null && dropdownOptions.length > 0 && (
                <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-56 max-h-52 overflow-y-auto rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg">
                    {dropdownOptions.map((opt, i) => (
                        <button
                            key={opt}
                            type="button"
                            className={`w-full text-left px-3 py-1.5 text-xs font-medium transition-colors ${
                                i === dropdownIndex
                                    ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                            }`}
                            onMouseEnter={() => setDropdownIndex(i)}
                            onMouseDown={e => {
                                e.preventDefault()         // don't blur the input
                                confirmTopic(opt)
                            }}
                        >
                            <span className="text-[var(--color-accent)]">@</span>
                            {opt}
                        </button>
                    ))}
                </div>
            )}

            {/* Nudge hint when @ is typed but no topics exist yet */}
            {mentionQuery !== null && dropdownOptions.length === 0 && (
                <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-56 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg px-3 py-2 text-xs text-[var(--color-text-muted)]">
                    {allTopics.length === 0
                        ? 'No topics found. Try syncing your repos first.'
                        : mentionQuery.length > 0
                            ? `No topics match "${mentionQuery}"`
                            : 'No more topics to add.'}
                </div>
            )}
        </div>
    )
}
