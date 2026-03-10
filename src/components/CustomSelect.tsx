import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search, X } from 'lucide-react'

export interface SelectOption {
    value: string
    label: string
    color?: string
    icon?: React.ReactNode
}

interface CustomSelectProps {
    value: string | null
    onChange: (value: string | null) => void
    options: SelectOption[]
    placeholder?: string
    searchable?: boolean
    icon?: React.ReactNode
    className?: string
    clearable?: boolean
    disabled?: boolean
}

export function CustomSelect({
    value,
    onChange,
    options,
    placeholder = 'Select...',
    searchable = false,
    clearable = true,
    icon,
    className = '',
    disabled = false
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [search, setSearch] = useState('')
    const triggerRef = useRef<HTMLButtonElement>(null)
    const dropdownRef = useRef<HTMLDivElement>(null)
    const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0, transform: 'none' })

    const selectedOption = options.find(o => o.value === value)

    const updatePosition = useCallback(() => {
        if (!triggerRef.current) return
        const rect = triggerRef.current.getBoundingClientRect()
        const dropdownHeight = 250 // Estimated max height
        const spaceBelow = window.innerHeight - rect.bottom
        const shouldOpenUp = spaceBelow < dropdownHeight && rect.top > spaceBelow

        let left = rect.left
        const width = rect.width
        if (left + width > window.innerWidth - 16) {
            left = rect.right - width
        }
        if (left < 16) left = 16

        setDropdownPos({
            top: shouldOpenUp ? rect.top - 4 : rect.bottom + 4,
            left,
            width,
            transform: shouldOpenUp ? 'translateY(-100%)' : 'none'
        })
    }, [])

    // Close on click outside
    useEffect(() => {
        if (!isOpen) return
        updatePosition()
        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setIsOpen(false)
                setSearch('')
            }
        }
        const handleScroll = () => updatePosition()
        document.addEventListener('mousedown', handleClick)
        window.addEventListener('scroll', handleScroll, true)
        return () => {
            document.removeEventListener('mousedown', handleClick)
            window.removeEventListener('scroll', handleScroll, true)
        }
    }, [isOpen, updatePosition])

    const filteredOptions = searchable
        ? options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()))
        : options

    const handleToggle = () => {
        if (disabled) return
        if (!isOpen) updatePosition()
        setIsOpen(!isOpen)
    }

    return (
        <div className={`relative ${className}`}>
            {/* Trigger */}
            <button
                ref={triggerRef}
                onClick={handleToggle}
                disabled={disabled}
                className={`
                    flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all w-full min-w-[100px] justify-between
                    ${disabled ? 'opacity-50 cursor-not-allowed bg-[var(--color-surface-2)] border-[var(--color-border)]' :
                        isOpen
                            ? 'border-[var(--color-accent)] ring-1 ring-[var(--color-accent)]/20 bg-[var(--color-surface)]'
                            : 'border-[var(--color-border)] bg-[var(--color-surface-2)] hover:bg-[var(--color-surface)] hover:border-[var(--color-border-hover)]'
                    }
                `}
            >
                <div className="flex items-center gap-2 truncate">
                    {icon && <span className="text-[var(--color-text-muted)]">{icon}</span>}
                    {selectedOption ? (
                        <div className="flex items-center gap-1.5 truncate">
                            {selectedOption.color && (
                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: selectedOption.color }} />
                            )}
                            <span className="text-[var(--color-text)]">{selectedOption.label}</span>
                        </div>
                    ) : (
                        <span className="text-[var(--color-text-muted)]">{placeholder}</span>
                    )}
                </div>
                <ChevronDown className={`h-3.5 w-3.5 text-[var(--color-text-muted)] transition-transform shrink-0 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown - rendered via portal to avoid overflow clipping */}
            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-[9999] rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl overflow-hidden"
                    style={{ top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width, transform: dropdownPos.transform }}
                >
                    {/* Search Input */}
                    {searchable && (
                        <div className="p-2 border-b border-[var(--color-border)]">
                            <div className="relative">
                                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-text-muted)]" />
                                <input
                                    autoFocus
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search..."
                                    className="w-full bg-[var(--color-surface-2)] rounded-md pl-8 pr-2 py-1.5 text-xs text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] outline-none border border-transparent focus:border-[var(--color-accent)] transition-all"
                                />
                            </div>
                        </div>
                    )}

                    {/* Options List */}
                    <div className="max-h-[200px] overflow-y-auto p-1">
                        {/* Clear Option */}
                        {clearable && value && (
                            <button
                                onClick={() => { onChange(null); setIsOpen(false); setSearch(''); }}
                                className="flex w-full items-center gap-2 px-2 py-1.5 rounded-md text-xs text-[var(--color-text-subtle)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition-colors mb-1"
                            >
                                <X className="h-3.5 w-3.5" />
                                Clear
                            </button>
                        )}

                        {filteredOptions.length > 0 ? (
                            filteredOptions.map(option => {
                                const isSelected = option.value === value
                                return (
                                    <button
                                        key={option.value}
                                        onClick={() => { onChange(option.value); setIsOpen(false); setSearch(''); }}
                                        className={`
                                            flex w-full items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors
                                            ${isSelected
                                                ? 'bg-[var(--color-accent)]/10 text-[var(--color-accent)]'
                                                : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                                            }
                                        `}
                                    >
                                        <div className="flex items-center gap-2 truncate">
                                            {option.color && (
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: option.color }} />
                                            )}
                                            {option.icon && <span className={isSelected ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}>{option.icon}</span>}
                                            <span className="truncate">{option.label}</span>
                                        </div>
                                        {isSelected && <Check className="h-3.5 w-3.5 shrink-0" />}
                                    </button>
                                )
                            })
                        ) : (
                            <div className="px-2 py-3 text-center text-xs text-[var(--color-text-muted)]">
                                No results found
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </div>
    )
}
