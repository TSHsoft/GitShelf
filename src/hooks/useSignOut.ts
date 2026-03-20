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
            const repositories = useStore.getState().data.repositories;
            const repoCount = Object.keys(repositories).length;
            
            if (repoCount > 0) {
                setSigningOutStatus('Backing up your bookmarks...')
                await executeGistBackup()
            } else {
                console.log('[SignOut] Skipping backup because shelf is empty')
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

        // --- NEW: Sync logout to extension ---
        const extId = import.meta.env.VITE_EXTENSION_ID;
        const chrome = (window as Window & { chrome?: { runtime?: { sendMessage: (id: string, msg: unknown) => void } } }).chrome;
        if (typeof chrome !== 'undefined' && chrome.runtime && extId) {
            try {
                chrome.runtime.sendMessage(extId, { type: 'APP_SIGN_OUT' });
                console.log('[SignOut] Sign out message sent to extension');
            } catch (err) {
                console.warn('[SignOut] Failed to message extension:', err);
            }
        }

        setSigningOutStatus(null)
        // App.tsx renders LoginPage when githubToken is null
    }

    return { signOut, signingOutStatus }
}
