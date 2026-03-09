import { useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { loadLocalData, saveLocalData } from '@/lib/db'
import { getGistBackup, upsertGistBackup } from '@/lib/github'
import { decryptTokenAsync } from '@/lib/crypto'
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

// Gist Sync Hook
export function useGistSync() {
    const {
        data,
        gistSyncStatus,
        setGistSyncStatus,
        setLastGistSyncTime,
        setGistSyncError,
        githubToken
    } = useStore()

    const manualBackup = async () => {
        const encToken = githubToken
        if (!encToken) {
            setGistSyncError('GitHub token is missing')
            throw new Error('No GitHub token')
        }

        const token = await decryptTokenAsync(encToken)
        setGistSyncStatus('syncing')
        setGistSyncError(null)

        try {
            // First check if backup exists to get ID
            const existing = await getGistBackup(token)
            const content = JSON.stringify(data)

            await upsertGistBackup(token, content, existing?.id)

            setGistSyncStatus('success')
            setLastGistSyncTime(Date.now())
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error('Gist backup failed:', error)
            setGistSyncStatus('error')
            setGistSyncError(msg || 'Failed to backup to Gist')
            throw error
        }
    }

    // Auto backup effect based on interval
    useEffect(() => {
        const intervalMins = data.settings.backup_interval_minutes || 0
        if (intervalMins <= 0) return

        const intervalMs = intervalMins * 60 * 1000
        const intervalId = setInterval(() => {
            manualBackup().catch(() => { })
        }, intervalMs)

        return () => clearInterval(intervalId)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data.settings.backup_interval_minutes])

    return { manualBackup, gistSyncStatus }
}
