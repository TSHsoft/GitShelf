import { useEffect, useCallback, useRef } from 'react'
import { useStore } from '@/store/useStore'
import { loadLocalData, saveLocalData } from '@/lib/db'
import { getGistBackup, upsertGistBackup } from '@/lib/github'
import type { GitShelfData } from '@/types'

// Local Persistence Hook
export function useLocalPersistence() {
    const setData = useStore(state => state.setData)
    const setLoaded = useStore(state => state.setLoaded)

    useEffect(() => {
        let mounted = true
        const init = async () => {
            try {
                const stored = await loadLocalData()
                if (!mounted) return
                
                if (stored) {
                    console.log('[Init] Local data loaded successfully')
                    setData(stored)
                } else {
                    console.log('[Init] No local data found, initializing fresh')
                    setLoaded(true)
                }
            } catch (err) {
                console.error('[Init] Failed to load local data:', err)
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
            saveLocalData(data).catch(err => {
                if (err.message && err.message.includes('CONSISTENCY_ERROR')) {
                    console.debug('[AutoSave] Skip: DB is newer than current memory state')
                } else {
                    console.error('[AutoSave] Failed:', err)
                }
            })
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
        const { gistId } = state
        const existing = await getGistBackup(token, gistId).catch(() => null)
        if (existing?.id && !gistId) state.setGistId(existing.id)
        
        // Exclude pending_repos AND trash from main JSON
        // trash → gitshelf_trash.json (separate file in same gist)
        // pending_repos → gitshelf_pending.json (mobile inbox)
        const { pending_repos, trash, ...dataToBackup } = state.data;
        const content = JSON.stringify(dataToBackup)

        const savedGistId = await upsertGistBackup(token, content, existing?.id)
        
        // Ensure gistId is stored after creating a new gist
        const currentGistId = useStore.getState().gistId || savedGistId
        if (savedGistId && !useStore.getState().gistId) state.setGistId(savedGistId)

        // Backup trash to gitshelf_trash.json in the same gist
        const trashContent = JSON.stringify(trash || {})
        const { updateGistFile } = await import('@/lib/github/gists')
        await updateGistFile(token, 'GitShelf_trash.json', trashContent, currentGistId)

        // If local has pending_repos when backing up, push them to the separate remote queue
        if (pending_repos && pending_repos.length > 0) {
            try {
                const { getGistFile } = await import('@/lib/github/gists')
                const result = await getGistFile(token, 'gitshelf_pending.json', currentGistId)
                const remoteRepos = result ? JSON.parse(result.content) : []
                const merged = Array.from(new Set([...remoteRepos, ...pending_repos]))
                await updateGistFile(token, 'gitshelf_pending.json', JSON.stringify(merged), currentGistId || result?.id)
            } catch (e) {
                console.error('Failed to sync pending_repos to wrapper', e)
            }
        }

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
    const data = useStore(state => state.data)
    const gistSyncStatus = useStore(state => state.gistSyncStatus)

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
