import { useEffect, useRef } from 'react'
import { Settings, Tag, Sun, Moon, LogOut } from 'lucide-react'
import { createPortal } from 'react-dom'

interface AvatarMenuProps {
    anchorRef: React.RefObject<HTMLElement | null>
    userProfile: { avatarUrl: string; name: string | null; login: string } | null
    theme: 'dark' | 'light'
    onSettings: () => void
    onManageTags: () => void
    onToggleTheme: () => void
    onSignOut: () => void
    onClose: () => void
}

export function AvatarMenu({
    anchorRef,
    userProfile,
    theme,
    onSettings,
    onManageTags,
    onToggleTheme,
    onSignOut,
    onClose,
}: AvatarMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null)

    // Position the menu above the anchor
    const anchor = anchorRef.current?.getBoundingClientRect()
    const menuStyle: React.CSSProperties = anchor
        ? {
            position: 'fixed',
            bottom: window.innerHeight - anchor.top + 8,
            left: anchor.left,
            minWidth: 220,
            zIndex: 9999,
        }
        : { display: 'none' }

    // Close on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            const target = e.target as Node
            if (
                menuRef.current && !menuRef.current.contains(target) &&
                anchorRef.current && !anchorRef.current.contains(target)
            ) {
                onClose()
            }
        }
        document.addEventListener('mousedown', handler)
        return () => document.removeEventListener('mousedown', handler)
    }, [onClose, anchorRef])

    const initials = userProfile
        ? (userProfile.name || userProfile.login).slice(0, 2).toUpperCase()
        : '??'

    return createPortal(
        <div
            ref={menuRef}
            style={menuStyle}
            className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl overflow-hidden animate-fade-in"
        >
            {/* Profile Header */}
            <div className="flex items-center gap-3 px-3 py-3 border-b border-[var(--color-border)]">
                {userProfile?.avatarUrl ? (
                    <img src={userProfile.avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full border border-[var(--color-border)]" />
                ) : (
                    <div className="w-8 h-8 rounded-full bg-[var(--color-accent)]/20 flex items-center justify-center">
                        <span className="text-xs font-bold text-[var(--color-accent)]">{initials}</span>
                    </div>
                )}
                <div className="flex flex-col min-w-0">
                    <span className="text-sm font-semibold text-[var(--color-text)] truncate">
                        {userProfile?.name || userProfile?.login || 'GitHub User'}
                    </span>
                    {userProfile?.login && (
                        <span className="text-xs text-[var(--color-text-muted)] truncate">@{userProfile.login}</span>
                    )}
                </div>
            </div>

            {/* Menu Items */}
            <div className="p-1">
                <MenuItem icon={<Settings className="h-3.5 w-3.5" />} label="Settings" onClick={() => { onSettings(); onClose() }} />
                <MenuItem icon={<Tag className="h-3.5 w-3.5" />} label="Manage Tags" onClick={() => { onManageTags(); onClose() }} />
            </div>

            <div className="border-t border-[var(--color-border)] p-1">
                <MenuItem
                    icon={theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
                    label={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                    onClick={() => { onToggleTheme(); onClose() }}
                />
            </div>

            <div className="border-t border-[var(--color-border)] p-1">
                <MenuItem
                    icon={<LogOut className="h-3.5 w-3.5" />}
                    label="Sign Out"
                    onClick={() => { onSignOut(); onClose() }}
                    danger
                />
            </div>
        </div>,
        document.body
    )
}

function MenuItem({
    icon,
    label,
    onClick,
    danger = false,
}: {
    icon: React.ReactNode
    label: string
    onClick: () => void
    danger?: boolean
}) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer
                ${danger
                    ? 'text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10'
                    : 'text-[var(--color-text)] hover:bg-[var(--color-surface-2)]'
                }
            `}
        >
            <span className={danger ? 'text-[var(--color-danger)]' : 'text-[var(--color-text-muted)]'}>{icon}</span>
            {label}
        </button>
    )
}
