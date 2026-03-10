import type { StateCreator } from 'zustand'
import type { GitShelfStore, DataSlice } from '../types'
import { DEFAULT_DATA } from '@/types'
import type { Repository } from '@/types'

export const createDataSlice: StateCreator<GitShelfStore, [], [], DataSlice> = (set) => ({
    data: DEFAULT_DATA,
    isLoaded: false,
    setData: (data) =>
        set({
            data,
            isLoaded: true,
            viewMode: data.settings.view_mode ?? 'card',
            // Hydrate last sync time from persisted data
            lastSyncTime: data.last_sync_time ?? null,
        }),
    addRepository: (repo) =>
        set((state) => ({
            data: {
                ...state.data,
                last_modified: Date.now(),
                repositories: { ...state.data.repositories, [repo.id]: repo },
            },
        })),
    removeRepository: (id) =>
        set((state) => {
            let keyToRemove = id
            if (!state.data.repositories[id]) {
                // Fallback: find by case-insensitive key or repo.id (handles key/id mismatches and not_found case issues)
                const entry = Object.entries(state.data.repositories).find(
                    ([key, r]) => key.toLowerCase() === id.toLowerCase() || r.id.toLowerCase() === id.toLowerCase()
                )
                if (!entry) return state // Repo not found in store, safe exit
                keyToRemove = entry[0]
            }
            const { [keyToRemove]: _repo, ...rest } = state.data.repositories
            return {
                data: { ...state.data, last_modified: Date.now(), repositories: rest },
                activeRepoId: state.activeRepoId === id || state.activeRepoId === keyToRemove ? null : state.activeRepoId,
            }
        }),
    updateRepository: (id, updates) =>
        set((state) => ({
            data: {
                ...state.data,
                last_modified: Date.now(),
                repositories: {
                    ...state.data.repositories,
                    [id]: { ...state.data.repositories[id], ...updates },
                },
            },
        })),
    toggleFavorite: (id) =>
        set((state) => {
            const repo = state.data.repositories[id]
            if (!repo) return state
            const currentFav = repo.is_favorite ?? false
            return {
                data: {
                    ...state.data,
                    last_modified: Date.now(),
                    repositories: {
                        ...state.data.repositories,
                        [id]: { ...repo, is_favorite: !currentFav }
                    }
                }
            }
        }),
    markAsViewed: (id) =>
        set((state) => {
            const repo = state.data.repositories[id]
            if (!repo) return state
            return {
                data: {
                    ...state.data,
                    repositories: {
                        ...state.data.repositories,
                        [id]: { ...repo, last_viewed_at: Date.now() }
                    }
                }
            }
        }),
    importData: (incoming) =>
        set((state) => ({
            data: {
                ...incoming,
                last_modified: Date.now(),
                settings: { ...state.data.settings, ...incoming.settings },
            },
        })),
    setRepositories: (repos) =>
        set((state) => ({
            data: { ...state.data, last_modified: Date.now(), repositories: repos },
        })),
    addTag: (tag) =>
        set((state) => ({
            data: {
                ...state.data,
                last_modified: Date.now(),
                tags: { ...state.data.tags, [tag.id]: tag },
            },
        })),
    removeTag: (id) =>
        set((state) => {
            const { [id]: _tag, ...restTags } = state.data.tags
            let hasChanges = false
            const nextRepos = { ...state.data.repositories }

            // Optimization for O(N) Traversal over entries instead of keys
            for (const [repoId, repo] of Object.entries(nextRepos)) {
                if (repo.tags.includes(id)) {
                    nextRepos[repoId] = {
                        ...repo,
                        tags: repo.tags.filter(t => t !== id)
                    }
                    hasChanges = true
                }
            }

            return {
                data: { ...state.data, last_modified: Date.now(), tags: restTags, repositories: hasChanges ? nextRepos : state.data.repositories },
                selectedTagId: state.selectedTagId === id ? null : state.selectedTagId,
            }
        }),
    updateTag: (id, updates) =>
        set((state) => ({
            data: {
                ...state.data,
                last_modified: Date.now(),
                tags: { ...state.data.tags, [id]: { ...state.data.tags[id], ...updates } },
            },
        })),
    bulkAddTags: (repoIds, tagIds) =>
        set((state) => {
            const updates: Record<string, Repository> = {}
            let hasChanges = false

            repoIds.forEach((repoId) => {
                const repo = state.data.repositories[repoId]
                if (repo) {
                    const newTags = Array.from(new Set([...repo.tags, ...tagIds]))
                    if (newTags.length !== repo.tags.length) {
                        updates[repoId] = { ...repo, tags: newTags }
                        hasChanges = true
                    }
                }
            })

            if (!hasChanges) return {}

            return {
                data: {
                    ...state.data,
                    last_modified: Date.now(),
                    repositories: { ...state.data.repositories, ...updates },
                },
            }
        }),
    updateSettings: (updates) =>
        set((state) => {
            const nextSettings = { ...state.data.settings, ...updates }
            return {
                data: {
                    ...state.data,
                    last_modified: Date.now(),
                    settings: nextSettings,
                },
            }
        }),
    setLoaded: (loaded) => set({ isLoaded: loaded }),
    resetData: () => set({ data: DEFAULT_DATA, isLoaded: true }),
})
