import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store/useStore'
import { Loader2 } from 'lucide-react'
import { fetchAuthenticatedUserProfile, getGistBackup } from '@/lib/github'
import { GitShelfDataSchema } from '@/types'
import { saveLocalData } from '@/lib/db'

export function AuthCallback() {
    const { setGithubToken, setUserProfile, setData, resetData } = useStore()
    const processed = useRef(false)
    const [status, setStatus] = useState('Completing GitHub sign in...')

    useEffect(() => {
        if (processed.current) return

        const urlParams = new URLSearchParams(window.location.search)
        const code = urlParams.get('code')
        const error = urlParams.get('error')

        if (error) {
            console.error('GitHub OAuth Error:', urlParams.get('error_description'))
            window.location.href = '/'
            return
        }

        if (code) {
            processed.current = true
            handleOAuthCallback(code)
        }
    }, [])

    const handleOAuthCallback = async (code: string) => {
        try {
            // Step 1: Exchange code for token
            setStatus('Connecting to GitHub...')
            const response = await fetch(import.meta.env.VITE_WORKER_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code })
            })

            if (!response.ok) throw new Error('Failed to exchange token')

            const data = await response.json()
            if (!data.access_token) throw new Error('No access_token in response')

            const rawToken = data.access_token

            // Step 2: Save token (encrypted)
            await setGithubToken(rawToken)

            // Step 3: Fetch user profile
            setStatus('Loading your profile...')
            try {
                const profile = await fetchAuthenticatedUserProfile(rawToken)
                if (profile) setUserProfile(profile)
            } catch {
                console.warn('Could not load profile, continuing anyway')
            }

            // Step 4: Restore from Gist
            setStatus('Restoring your bookmarks...')
            try {
                const backup = await getGistBackup(rawToken)
                if (backup) {
                    const parsed = GitShelfDataSchema.safeParse(JSON.parse(backup.content))
                    if (parsed.success) {
                        setData(parsed.data)
                        await saveLocalData(parsed.data)
                    }
                } else {
                    // New user — start with empty data
                    resetData()
                }
            } catch {
                console.warn('Could not restore Gist backup, starting fresh')
                resetData()
            }

            // Step 5: Redirect to app
            window.history.replaceState({}, document.title, window.location.pathname)
            window.location.replace('/')
        } catch (err) {
            console.error('OAuth callback failed:', err)
            window.location.href = '/'
        }
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-[var(--color-bg)]">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-8 w-8 animate-spin text-[var(--color-accent)]" />
                <p className="text-sm font-medium text-[var(--color-text)]">{status}</p>
            </div>
        </div>
    )
}
