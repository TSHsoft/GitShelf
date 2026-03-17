import type { StateCreator } from 'zustand'
import type { GitShelfStore, DataSlice } from '../types'
import { DEFAULT_DATA, GitShelfDataSchema } from '@/types'
import type { Repository } from '@/types'
import { computeRepoFlags } from '@/lib/github/status'

/**
 * Builds the tag-to-repository index.
 * Optimized for larger datasets using a single pass.
 */
function buildTagIndex(repositories: Record<string, Repository>): Record<string, string[]> {
    const index: Record<string, string[]> = {}
    const entries = Object.entries(repositories)
    
    for (let i = 0; i < entries.length; i++) {
        const [id, repo] = entries[i]
        const tags = repo.tags
        for (let j = 0; j < tags.length; j++) {
            const tagId = tags[j]
            if (!index[tagId]) index[tagId] = []
            index[tagId].push(id)
        }
    }
    return index
}

/**
 * Helper to update flags bitmask on a repository object.
 */
function withFlags(repo: Repository): Repository {
    const flags = computeRepoFlags(repo)
    if (repo.flags === flags) return repo
    return { ...repo, flags }
}

export const createDataSlice: StateCreator<GitShelfStore, [], [], DataSlice> = (set, get) => ({
    data: DEFAULT_DATA,
    tagToRepos: {},
    isLoaded: false,
    setData: (data) => {
        // Migration: Ensure folders exist for older backups
        if (!data.folders) {
            data.folders = {}
        }
        const nextRepos: Record<string, Repository> = {}
        Object.entries(data.repositories).forEach(([id, repo]) => {
            nextRepos[id] = withFlags(repo)
        })

        set({
            data: { ...data, repositories: nextRepos },
            tagToRepos: buildTagIndex(nextRepos),
            isLoaded: true,
            viewMode: data.settings.view_mode ?? 'card',
            // Hydrate last sync time from persisted data
            lastSyncTime: data.last_sync_time ?? null,
        })
    },
    addRepository: (repo) =>
        set((state) => {
            const repoWithFlags = withFlags(repo)
            const nextTagToRepos = { ...state.tagToRepos }
            repoWithFlags.tags.forEach(tagId => {
                if (!nextTagToRepos[tagId]) nextTagToRepos[tagId] = []
                if (!nextTagToRepos[tagId].includes(repoWithFlags.id)) {
                    nextTagToRepos[tagId] = [...nextTagToRepos[tagId], repoWithFlags.id]
                }
            })

            return {
                data: {
                    ...state.data,
                    last_modified: Date.now(),
                    repositories: { ...state.data.repositories, [repoWithFlags.id]: repoWithFlags },
                },
                tagToRepos: nextTagToRepos
            }
        }),
    removeRepository: (id) =>
        set((state) => {
            let keyToRemove = id
            const repo = state.data.repositories[id]
            if (!repo) {
                // Fallback: find by case-insensitive key or repo.id
                const entry = Object.entries(state.data.repositories).find(
                    ([key, r]) => key.toLowerCase() === id.toLowerCase() || r.id.toLowerCase() === id.toLowerCase()
                )
                if (!entry) return state
                keyToRemove = entry[0]
            }
            
            const targetRepo = state.data.repositories[keyToRemove]
            const nextTagToRepos = { ...state.tagToRepos }
            if (targetRepo) {
                targetRepo.tags.forEach(tagId => {
                    if (nextTagToRepos[tagId]) {
                        nextTagToRepos[tagId] = nextTagToRepos[tagId].filter(rid => rid !== keyToRemove)
                        if (nextTagToRepos[tagId].length === 0) delete nextTagToRepos[tagId]
                    }
                })
            }

            const { [keyToRemove]: _repo, ...rest } = state.data.repositories
            return {
                data: { ...state.data, last_modified: Date.now(), repositories: rest },
                tagToRepos: nextTagToRepos,
                activeRepoId: state.activeRepoId === id || state.activeRepoId === keyToRemove ? null : state.activeRepoId,
            }
        }),
    updateRepository: (id, updates) =>
        set((state) => {
            const repo = state.data.repositories[id]
            if (!repo) return state

            const nextRepo = withFlags({ ...repo, ...updates })
            const nextTagToRepos = { ...state.tagToRepos }
            
            if (updates.tags) {
                // Remove from old tags
                repo.tags.forEach(tagId => {
                    if (nextTagToRepos[tagId]) {
                        nextTagToRepos[tagId] = nextTagToRepos[tagId].filter(rid => rid !== id)
                        if (nextTagToRepos[tagId].length === 0) delete nextTagToRepos[tagId]
                    }
                })
                // Add to new tags
                nextRepo.tags.forEach(tagId => {
                    if (!nextTagToRepos[tagId]) nextTagToRepos[tagId] = []
                    if (!nextTagToRepos[tagId].includes(id)) {
                        nextTagToRepos[tagId] = [...nextTagToRepos[tagId], id]
                    }
                })
            }

            return {
                data: {
                    ...state.data,
                    last_modified: Date.now(),
                    repositories: {
                        ...state.data.repositories,
                        [id]: nextRepo,
                    },
                },
                tagToRepos: nextTagToRepos
            }
        }),
    toggleFavorite: (id) =>
        set((state) => {
            const repo = state.data.repositories[id]
            if (!repo) return state
            const currentFav = repo.is_favorite ?? false
            const nextRepo = withFlags({ ...repo, is_favorite: !currentFav })
            return {
                data: {
                    ...state.data,
                    last_modified: Date.now(),
                    repositories: {
                        ...state.data.repositories,
                        [id]: nextRepo
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
        set((state) => {
            // Validate incoming data
            const result = GitShelfDataSchema.safeParse(incoming)
            if (!result.success) {
                console.error('Import validation failed:', result.error)
                throw new Error('Invalid backup data format.')
            }

            const validated = result.data
            const nextRepos: Record<string, Repository> = {}
            Object.entries(validated.repositories).forEach(([id, repo]) => {
                nextRepos[id] = withFlags(repo)
            })

            return {
                data: {
                    ...validated,
                    repositories: nextRepos,
                    last_modified: Date.now(),
                    settings: { ...state.data.settings, ...validated.settings },
                },
                tagToRepos: buildTagIndex(nextRepos)
            }
        }),
    setRepositories: (repos) =>
        set((state) => {
            const oldRepos = state.data.repositories
            const nextTagToRepos = { ...state.tagToRepos }
            const processedRepos: Record<string, Repository> = {}
            
            // Only update indices for repositories that changed their tags
            // or perform a full rebuild if the list is completely different.
            // For now, we perform a smart merged update.
            Object.entries(repos).forEach(([id, repo]) => {
                const updatedRepo = withFlags(repo)
                processedRepos[id] = updatedRepo
                
                const oldRepo = oldRepos[id]
                const tagsChanged = !oldRepo || JSON.stringify(oldRepo.tags) !== JSON.stringify(updatedRepo.tags)
                
                if (tagsChanged) {
                    // Remove from old tags
                    if (oldRepo) {
                        oldRepo.tags.forEach(tagId => {
                            if (nextTagToRepos[tagId]) {
                                nextTagToRepos[tagId] = nextTagToRepos[tagId].filter(rid => rid !== id)
                                if (nextTagToRepos[tagId].length === 0) delete nextTagToRepos[tagId]
                            }
                        })
                    }
                    // Add to new tags
                    updatedRepo.tags.forEach(tagId => {
                        if (!nextTagToRepos[tagId]) nextTagToRepos[tagId] = []
                        if (!nextTagToRepos[tagId].includes(id)) {
                            nextTagToRepos[tagId] = [...nextTagToRepos[tagId], id]
                        }
                    })
                }
            })

            // Clean up tags for removed repositories
            Object.keys(oldRepos).forEach(id => {
                if (!repos[id]) {
                    const oldRepo = oldRepos[id]
                    oldRepo.tags.forEach(tagId => {
                        if (nextTagToRepos[tagId]) {
                            nextTagToRepos[tagId] = nextTagToRepos[tagId].filter(rid => rid !== id)
                            if (nextTagToRepos[tagId].length === 0) delete nextTagToRepos[tagId]
                        }
                    })
                }
            })

            return {
                data: { ...state.data, last_modified: Date.now(), repositories: processedRepos },
                tagToRepos: nextTagToRepos
            }
        }),
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
            const repoIds = state.tagToRepos[id] || []
            const nextRepos = { ...state.data.repositories }
            
            repoIds.forEach(repoId => {
                const repo = nextRepos[repoId]
                if (repo) {
                    nextRepos[repoId] = {
                        ...repo,
                        tags: repo.tags.filter(t => t !== id)
                    }
                }
            })
            
            const { [id]: _removed, ...nextTagToRepos } = state.tagToRepos

            return {
                data: { ...state.data, last_modified: Date.now(), tags: restTags, repositories: nextRepos },
                tagToRepos: nextTagToRepos,
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
            const nextTagToRepos = { ...state.tagToRepos }

            repoIds.forEach((repoId) => {
                const repo = state.data.repositories[repoId]
                if (!repo) return

                const newTags = new Set(repo.tags)
                let added = false
                tagIds.forEach(tId => {
                    if (!newTags.has(tId)) {
                        newTags.add(tId)
                        added = true
                        if (!nextTagToRepos[tId]) nextTagToRepos[tId] = []
                        if (!nextTagToRepos[tId].includes(repoId)) {
                            nextTagToRepos[tId] = [...nextTagToRepos[tId], repoId]
                        }
                    }
                })

                if (added) {
                    updates[repoId] = { ...repo, tags: Array.from(newTags) }
                    hasChanges = true
                }
            })

            if (!hasChanges) return {}

            return {
                data: {
                    ...state.data,
                    last_modified: Date.now(),
                    repositories: { ...state.data.repositories, ...updates },
                },
                tagToRepos: nextTagToRepos
            }
        }),
    addFolder: (folder) =>
        set((state) => ({
            data: {
                ...state.data,
                last_modified: Date.now(),
                folders: { ...state.data.folders, [folder.id]: folder },
            },
        })),
    removeFolder: (id) =>
        set((state) => {
            const { [id]: _folder, ...restFolders } = state.data.folders
            let hasChanges = false
            const nextRepos = { ...state.data.repositories }

            // Move repos in the deleted folder back to Uncategorized (folder_id: null)
            for (const [repoId, repo] of Object.entries(nextRepos)) {
                if (repo.folder_id === id) {
                    nextRepos[repoId] = {
                        ...repo,
                        folder_id: null
                    }
                    hasChanges = true
                }
            }

            return {
                data: { ...state.data, last_modified: Date.now(), folders: restFolders, repositories: hasChanges ? nextRepos : state.data.repositories },
                // Reset selected folder if it was deleted, otherwise keep it
                selectedFolderId: get().selectedFolderId === id ? 'sys:all' : get().selectedFolderId,
            }
        }),
    updateFolder: (id, updates) =>
        set((state) => ({
            data: {
                ...state.data,
                last_modified: Date.now(),
                folders: { ...state.data.folders, [id]: { ...state.data.folders[id], ...updates } },
            },
        })),
    moveRepoToFolder: (repoId, folderId) =>
        set((state) => {
            const repo = state.data.repositories[repoId]
            if (!repo) return state
            if (repo.folder_id === folderId) return state

            return {
                data: {
                    ...state.data,
                    last_modified: Date.now(),
                    repositories: {
                        ...state.data.repositories,
                        [repoId]: { ...repo, folder_id: folderId }
                    }
                }
            }
        }),
    bulkMoveReposToFolder: (repoIds, folderId) =>
        set((state) => {
            const updates: Record<string, Repository> = {}
            let hasChanges = false

            repoIds.forEach((repoId) => {
                const repo = state.data.repositories[repoId]
                if (repo && repo.folder_id !== folderId) {
                    updates[repoId] = { ...repo, folder_id: folderId }
                    hasChanges = true
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
    resetData: () => set({ data: DEFAULT_DATA, tagToRepos: {}, isLoaded: true }),
})
