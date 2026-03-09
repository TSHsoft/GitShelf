import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { decryptTokenAsync } from '@/lib/crypto'
import { getGistBackup, upsertGistBackup } from '@/lib/github'
import { clearLocalData } from '@/lib/db'

/**
 * Shared sign-out logic: backup to Gist, then clear local data + token.
 * Returns { signOut, signingOutStatus } — signOut is async.
 */
export function useSignOut() {
    const { data, githubToken, setGithubToken, setGithubTokenExpiry, setUserProfile, resetData } = useStore()
    const [signingOutStatus, setSigningOutStatus] = useState<string | null>(null)

    const signOut = async () => {
        if (!githubToken) {
            setGithubToken(null)
            return
        }

        try {
            const rawToken = await decryptTokenAsync(githubToken)
            if (!rawToken || rawToken === githubToken) {
                console.warn('Token decryption failed or token is invalid. Skipping backup to prevent data corruption.')
            } else {
                setSigningOutStatus('Backing up your bookmarks...')
                const existing = await getGistBackup(rawToken).catch(() => null)
                const content = JSON.stringify(data)
                await upsertGistBackup(rawToken, content, existing?.id || undefined)
            }
        } catch (e) {
            console.warn('Backup before sign out failed, proceeding anyway', e)
        }

        setSigningOutStatus('Signing out...')
        await clearLocalData()
        resetData()
        await setGithubToken(null)
        setGithubTokenExpiry(null)
        setUserProfile(null)
        setSigningOutStatus(null)
        // App.tsx renders LoginPage when githubToken is null
    }

    return { signOut, signingOutStatus }
}
