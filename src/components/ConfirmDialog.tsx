import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { AlertTriangle, AlertCircle, Info, X } from 'lucide-react'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'

interface ConfirmDialogProps {
    isOpen: boolean
    title: string
    description: ReactNode
    confirmLabel?: string
    cancelLabel?: string
    variant?: 'danger' | 'warning' | 'default'
    onConfirm: () => void
    onClose: () => void
}

export function ConfirmDialog({
    isOpen,
    title,
    description,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    variant = 'default',
    onConfirm,
    onClose
}: ConfirmDialogProps) {
    const overlayRef = useRef<HTMLDivElement>(null)

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        if (isOpen) {
            window.addEventListener('keydown', handleEscape)
        }
        return () => {
            window.removeEventListener('keydown', handleEscape)
        }
    }, [isOpen, onClose])

    useLockBodyScroll(isOpen)

    if (!isOpen) return null

    const getIcon = () => {
        switch (variant) {
            case 'danger': return <AlertCircle className="h-5 w-5 text-[var(--color-danger)]" />
            case 'warning': return <AlertTriangle className="h-5 w-5 text-[var(--color-warning)]" />
            default: return <Info className="h-5 w-5 text-[var(--color-accent)]" />
        }
    }

    const getConfirmButtonStyle = () => {
        switch (variant) {
            case 'danger':
                return 'bg-[var(--color-danger)] text-white hover:bg-[var(--color-danger)]/90 border-transparent'
            case 'warning':
                return 'bg-[var(--color-warning)] text-white hover:bg-[var(--color-warning)]/90 border-transparent'
            default:
                return 'bg-[var(--color-accent)] text-white hover:bg-[var(--color-accent)]/90 border-transparent'
        }
    }

    return createPortal(
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 animate-fade-in"
            onPointerDown={(e) => {
                e.stopPropagation()
            }}
            onClick={(e) => {
                e.stopPropagation()
            }}
        >
            <div
                ref={overlayRef}
                className="w-full max-w-sm rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl scale-100 animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="p-5 flex flex-col gap-4">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                        <div className="flex gap-3">
                            <div className={`mt-0.5 p-2 rounded-full bg-[var(--color-surface-2)] shrink-0 self-start`}>
                                {getIcon()}
                            </div>
                            <div className="flex-1">
                                <h3 className="text-base font-semibold text-[var(--color-text)] leading-none mb-2">
                                    {title}
                                </h3>
                                <p className="text-sm text-[var(--color-text-muted)] leading-relaxed">
                                    {description}
                                </p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-[var(--color-text-muted)] hover:bg-[var(--color-surface-2)] hover:text-[var(--color-text)] transition-colors shrink-0">
                            <X className="h-4 w-4" />
                        </button>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2 mt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-3 py-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] text-xs font-medium text-[var(--color-text)] hover:bg-[var(--color-surface)] hover:text-[var(--color-text-muted)] transition-colors"
                        >
                            {cancelLabel}
                        </button>
                        <button
                            type="button"
                            onClick={() => { onConfirm(); onClose() }}
                            className={`px-3 py-2 rounded-lg text-xs font-medium border shadow-sm transition-all active:scale-[0.98] ${getConfirmButtonStyle()}`}
                        >
                            {confirmLabel}
                        </button>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    )
}
