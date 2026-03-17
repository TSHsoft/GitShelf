import { useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { loadLocalData, saveLocalData } from '@/lib/db'
import { getGistBackup, upsertGistBackup } from '@/lib/github'
import type { GitShelfData } from '@/types'

// Local Persistence Hook
export function useLocalPersistence() {
    const { setData, setLoaded } = useStore()

    useEffect(() => {
        let mounted = true
        const init = async () => {
            try {
                const stored = await loadLocalData()
                if (mounted && stored) {
                    setData(stored)
                } else if (mounted) {
                    setLoaded(true)
                }
            } catch (err) {
                console.error('Failed to load local data:', err)
                if (mounted) setLoaded(true)
            }
        }
        init()
        return () => { mounted = false }
    }, [setData, setLoaded])
}

// Auto Save Hook
export function useAutoSave() {
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const scheduleSave = useCallback((data: GitShelfData) => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current)
        timeoutRef.current = setTimeout(() => {
            saveLocalData(data).catch(console.error)
        }, 1000)
    }, [])

    return { scheduleSave }
}

export async function executeGistBackup() {
    const state = useStore.getState()
    const encToken = state.githubToken
    if (!encToken) {
        state.setGistSyncError('GitHub token is missing')
        throw new Error('No GitHub token')
    }

    if (state.isSyncing) {
        console.log('Skipping Gist backup because a global sync is in progress')
        return
    }

    const token = await state.getDecryptedToken()
    if (!token) return // Should not happen if githubToken is present
    state.setGistSyncStatus('syncing')
    state.setGistSyncError(null)

    try {
        const existing = await getGistBackup(token).catch(() => null)
        const content = JSON.stringify(state.data)

        await upsertGistBackup(token, content, existing?.id)

        state.setGistSyncStatus('success')
        state.setLastGistSyncTime(Date.now())
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error)
        console.error('Gist backup failed:', error)
        state.setGistSyncStatus('error')
        state.setGistSyncError(msg || 'Failed to backup to Gist')
        throw error
    }
}

export function useGistSync() {
    const {
        data,
        gistSyncStatus
    } = useStore()

    const manualBackup = async () => executeGistBackup()


    // Auto backup effect based on interval
    useEffect(() => {
        const intervalMins = data.settings.backup_interval_minutes || 0
        if (intervalMins <= 0) return

        const intervalMs = intervalMins * 60 * 1000
        const intervalId = setInterval(() => {
            manualBackup().catch(() => { })
        }, intervalMs)

        return () => clearInterval(intervalId)
    }, [data.settings.backup_interval_minutes])

    return { manualBackup, gistSyncStatus }
}
