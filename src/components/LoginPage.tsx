const GITHUB_CLIENT_ID = import.meta.env.VITE_GITHUB_CLIENT_ID
const SCOPE = 'gist read:user'

import { BookMarked } from 'lucide-react'

export function LoginPage() {
    const handleLogin = () => {
        window.location.href = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&scope=${encodeURIComponent(SCOPE)}`
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-[var(--color-bg)]">
            <div className="flex flex-col items-center gap-8 px-6">
                {/* Logo + Title */}
                <div className="flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--color-accent)] shadow-sm">
                        <BookMarked className="h-8 w-8 text-white" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-[var(--color-text)] tracking-tight">GitShelf</h1>
                        <p className="text-sm text-[var(--color-text-muted)] mt-1">Your personal GitHub repository shelf</p>
                    </div>
                </div>

                {/* Sign In Card */}
                <div className="w-full max-w-sm rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-xl flex flex-col gap-4">
                    <p className="text-xs text-center text-[var(--color-text-muted)] leading-relaxed">
                        Sign in with your GitHub account to access your personal bookmark shelf. Your data is stored privately in your GitHub Gist.
                    </p>

                    <button
                        onClick={handleLogin}
                        className="flex items-center justify-center gap-2.5 w-full rounded-lg bg-[#24292e] hover:bg-[#2b3137] active:scale-[0.98] text-white px-5 py-3 text-sm font-semibold transition-all"
                    >
                        <svg height="18" aria-hidden="true" viewBox="0 0 16 16" version="1.1" width="18" className="fill-current">
                            <path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z" />
                        </svg>
                        Sign in with GitHub
                    </button>
                </div>

                <p className="text-[11px] text-[var(--color-text-subtle)] text-center max-w-xs">
                    Only <strong>gist</strong> and <strong>read:user</strong> permissions are requested. No write access to your repositories.
                </p>
            </div>
        </div>
    )
}
