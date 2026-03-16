import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

interface PortalMenuProps {
    triggerRef: React.RefObject<HTMLElement | null>
    onClose: () => void
    children: React.ReactNode
    className?: string
    placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end'
}

export function PortalMenu({
    triggerRef,
    onClose,
    children,
    className = '',
    placement = 'bottom-end'
}: PortalMenuProps) {
    const [coords, setCoords] = useState({ top: 0, left: 0, opacity: 0 })
    const menuRef = useRef<HTMLDivElement>(null)

    const updatePosition = useCallback(() => {
        if (!triggerRef.current || !menuRef.current) return

        const trigger = triggerRef.current.getBoundingClientRect()
        const menu = menuRef.current.getBoundingClientRect()

        let top = trigger.bottom + window.scrollY + 4
        let left = trigger.right - menu.width + window.scrollX

        if (placement === 'bottom-start') {
            left = trigger.left + window.scrollX
        } else if (placement === 'top-end') {
            top = trigger.top + window.scrollY - menu.height - 4
            left = trigger.right - menu.width + window.scrollX
        } else if (placement === 'top-start') {
            top = trigger.top + window.scrollY - menu.height - 4
            left = trigger.left + window.scrollX
        }

        // Boundary checks
        if (left < 10) left = 10
        if (left + menu.width > window.innerWidth - 10) {
            left = window.innerWidth - menu.width - 10
        }

        if (top + menu.height > window.innerHeight + window.scrollY - 10) {
            // Flip to top if it overflows bottom
            top = trigger.top + window.scrollY - menu.height - 4
        }

        setCoords({ top, left, opacity: 1 })
    }, [triggerRef, placement])

    useEffect(() => {
        const frameId = requestAnimationFrame(() => {
            updatePosition()
        })

        const handleEvents = (e: MouseEvent | TouchEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node) &&
                triggerRef.current && !triggerRef.current.contains(e.target as Node)) {
                onClose()
            }
        }

        const handleScroll = () => updatePosition()
        const handleResize = () => updatePosition()

        window.addEventListener('mousedown', handleEvents)
        window.addEventListener('touchstart', handleEvents)
        window.addEventListener('scroll', handleScroll, true)
        window.addEventListener('resize', handleResize)

        return () => {
            cancelAnimationFrame(frameId)
            window.removeEventListener('mousedown', handleEvents)
            window.removeEventListener('touchstart', handleEvents)
            window.removeEventListener('scroll', handleScroll, true)
            window.removeEventListener('resize', handleResize)
        }
    }, [onClose, updatePosition, triggerRef])

    return createPortal(
        <div
            ref={menuRef}
            style={{
                position: 'absolute',
                top: coords.top,
                left: coords.left,
                opacity: coords.opacity,
                zIndex: 9999,
                pointerEvents: 'auto'
            }}
            className={`min-w-32 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] py-1 shadow-2xl ${className}`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
        >
            {children}
        </div>,
        document.body
    )
}
