import { useState } from 'react'
import { useStore } from '@/store/useStore'
import { executeGistBackup } from './useGistSync'
import { clearLocalData } from '@/lib/db'

/**
 * Shared sign-out logic: backup to Gist, then clear local data + token.
 * Returns { signOut, signingOutStatus } — signOut is async.
 */
export function useSignOut() {
    const { githubToken, setGithubToken, setGithubTokenExpiry, setUserProfile, resetData } = useStore()
    const [signingOutStatus, setSigningOutStatus] = useState<string | null>(null)

    const signOut = async () => {
        if (!githubToken) {
            setGithubToken(null)
            return
        }

        try {
            setSigningOutStatus('Backing up your bookmarks...')
            await executeGistBackup()

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
