import type { StateCreator } from 'zustand'
import type { GitShelfStore, SyncSlice } from '../types'
import { syncRepository as syncRepoLib } from '@/lib/github'

// Internal abort controller — held outside Zustand state to avoid serialization issues
let _syncAbortController: AbortController | null = null

export const createSyncSlice: StateCreator<GitShelfStore, [], [], SyncSlice> = (set, get) => ({
    patStatus: 'unknown',
    isSyncing: false,
    isOnline: navigator.onLine,
    syncProgress: null,
    syncingRepoIds: [],
    syncErrors: {},
    rateLimitRemaining: null,
    lastSyncTime: null,

    setPatStatus: (patStatus) => set({ patStatus }),
    setIsSyncing: (isSyncing) => set({ isSyncing }),
    setIsOnline: (isOnline: boolean) => set({ isOnline }),
    setSyncProgress: (syncProgress) => set({ syncProgress }),
    setRateLimitRemaining: (rateLimitRemaining) => set({ rateLimitRemaining }),
    clearSyncError: (id) => set((s) => {
        const { [id]: _, ...rest } = s.syncErrors
        return { syncErrors: rest }
    }),

    abortSync: () => {
        _syncAbortController?.abort()
        _syncAbortController = null
        set({ isSyncing: false, syncProgress: null })
    },

    syncRepository: async (id, throwOnError = false) => {
        const state = get()
        if (state.syncingRepoIds.includes(id)) return

        set((s) => ({
            syncingRepoIds: [...s.syncingRepoIds, id],
            syncErrors: (() => { const { [id]: _, ...rest } = s.syncErrors; return rest })(),
        }))

        try {
            const repo = state.data.repositories[id]
            if (!repo) throw new Error('Repository not found')

            const token = await state.getDecryptedToken()

            const updated = await syncRepoLib(repo, token)

            // Validate that the synced data has required fields before saving
            if (!updated.name || !updated.owner) {
                throw new Error('Sync returned incomplete data')
            }

            const isRenamed = updated.id !== id

            set((s) => {
                const { [id]: _oldRepo, ...restRepos } = s.data.repositories
                return {
                    data: {
                        ...s.data,
                        last_modified: Date.now(),
                        repositories: {
                            ...restRepos,
                            [updated.id]: updated
                        }
                    },
                    // If renamed, also update activeRepoId to point to new ID
                    ...(isRenamed && s.activeRepoId === id ? { activeRepoId: updated.id } : {}),
                }
            })
        } catch (error: unknown) {
            const msg = error instanceof Error ? error.message : String(error)
            console.error(`Failed to sync repo ${id}:`, error)

            // Store error in ephemeral UI state only — never corrupt the database
            set((s) => ({
                syncErrors: { ...s.syncErrors, [id]: msg }
            }))

            if (throwOnError) throw error
        } finally {
            set((s) => ({
                syncingRepoIds: s.syncingRepoIds.filter(i => i !== id)
            }))
        }
    },
})
