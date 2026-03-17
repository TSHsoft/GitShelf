import { describe, it, expect, beforeEach } from 'vitest'
import { createStore } from 'zustand'
import { createDataSlice } from './createDataSlice'
import { DEFAULT_DATA } from '@/types'
import type { Repository } from '@/types'
import type { GitShelfStore } from '../types'

// Simple mock for useStore state access in removeFolder/moveRepo if needed
const createMockStore = () => createStore<GitShelfStore>((set, get, store) => ({
    ...createDataSlice(set, get, store),
    selectedFolderId: 'sys:all',
    setSelectedFolderId: (id: string | null) => set({ selectedFolderId: id } as Partial<GitShelfStore>),
} as GitShelfStore))

describe('Data Slice', () => {
    let store: ReturnType<typeof createMockStore>

    beforeEach(() => {
        store = createMockStore()
    })

    const mockRepo: Repository = {
        id: 'user/repo',
        node_id: 'n1',
        url: 'https://github.com/user/repo',
        name: 'repo',
        owner: 'user',
        description: 'desc',
        stars: 10,
        language: 'TypeScript',
        topics: ['topic1'],
        updated_at: '2025-01-01',
        last_push_at: '2025-01-01',
        latest_release: null,
        has_new_release: false,
        archived: false,
        is_favorite: false,
        is_disabled: false,
        is_locked: false,
        is_private: false,
        is_empty: false,
        status: 'active',
        default_branch: 'main',
        tags: ['tag1'],
        added_at: Date.now(),
        last_synced_at: Date.now(),
        type: 'repository',
        is_fork: false,
        is_mirror: false,
        flags: 0,
    }

    it('should initialize with default data', () => {
        const state = store.getState()
        expect(state.data).toEqual(DEFAULT_DATA)
        expect(state.tagToRepos).toEqual({})
        expect(state.isLoaded).toBe(false)
    })

    it('should set data and build tag index', () => {
        const newData = {
            ...DEFAULT_DATA,
            repositories: { [mockRepo.id]: mockRepo }
        }
        store.getState().setData(newData)
        
        const state = store.getState()
        expect(state.data).toEqual(newData)
        expect(state.tagToRepos).toEqual({ 'tag1': [mockRepo.id] })
        expect(state.isLoaded).toBe(true)
    })

    it('should add a repository and update tag index', () => {
        store.getState().setData(DEFAULT_DATA)
        store.getState().addRepository(mockRepo)
        
        const state = store.getState()
        expect(state.data.repositories[mockRepo.id]).toEqual(mockRepo)
        expect(state.tagToRepos['tag1']).toContain(mockRepo.id)
    })

    it('should remove a repository and clean up tag index', () => {
        store.getState().setData({
            ...DEFAULT_DATA,
            repositories: { [mockRepo.id]: mockRepo }
        })
        
        store.getState().removeRepository(mockRepo.id)
        
        const state = store.getState()
        expect(state.data.repositories[mockRepo.id]).toBeUndefined()
        expect(state.tagToRepos['tag1']).toBeUndefined()
    })

    it('should update a repository and its tag index association', () => {
        store.getState().setData({
            ...DEFAULT_DATA,
            repositories: { [mockRepo.id]: mockRepo }
        })

        // Change tags from [tag1] to [tag2]
        store.getState().updateRepository(mockRepo.id, { tags: ['tag2'] })

        const state = store.getState()
        expect(state.data.repositories[mockRepo.id].tags).toEqual(['tag2'])
        expect(state.tagToRepos['tag1']).toBeUndefined()
        expect(state.tagToRepos['tag2']).toEqual([mockRepo.id])
    })

    it('should handle repository removal case-insensitively', () => {
        store.getState().setData({
            ...DEFAULT_DATA,
            repositories: { [mockRepo.id]: mockRepo }
        })

        // Remove using UPPERCASE ID
        store.getState().removeRepository(mockRepo.id.toUpperCase())

        const state = store.getState()
        expect(state.data.repositories[mockRepo.id]).toBeUndefined()
    })
})
