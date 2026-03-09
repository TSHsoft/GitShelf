import type { StateCreator } from 'zustand'
import type { GitShelfStore, UISlice, Theme } from '../types'

export const createUISlice: StateCreator<GitShelfStore, [], [], UISlice> = (set) => ({
    searchQuery: '',
    selectedTagId: null,
    activeRepoId: null,
    showTrash: false,
    groupBy: 'none',
    theme: (localStorage.getItem('gitshelf-theme') as Theme) || 'dark',
    drawerTheme: (localStorage.getItem('gitshelf-drawer-theme') as Theme) || 'dark',
    viewMode: 'card',
    sortField: 'added_at',
    sortDir: 'desc',
    statusFilter: 'all',
    filterLanguage: null,
    filterStars: null,
    filterUpdated: null,
    filterTag: null,
    filterType: null,

    setStatusFilter: (statusFilter) => set({ statusFilter }),
    setFilterLanguage: (filterLanguage) => set({ filterLanguage }),
    setFilterStars: (filterStars) => set({ filterStars }),
    setFilterUpdated: (filterUpdated) => set({ filterUpdated }),
    setFilterTag: (filterTag) => set({ filterTag }),
    setFilterType: (filterType) => set({ filterType }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setSelectedTagId: (selectedTagId) => set({ selectedTagId }),
    setActiveRepoId: (activeRepoId) => set({ activeRepoId }),
    setShowTrash: (showTrash) => set({ showTrash }),
    setViewMode: (viewMode) =>
        set((state) => ({
            viewMode,
            data: {
                ...state.data,
                settings: { ...state.data.settings, view_mode: viewMode },
            },
        })),
    setSortField: (sortField) => set({ sortField }),
    setSortDir: (sortDir) => set({ sortDir }),
    setGroupBy: (groupBy) => set({ groupBy }),
    toggleTheme: () =>
        set((state) => {
            const next = state.theme === 'dark' ? 'light' : 'dark'
            document.documentElement.setAttribute('data-theme', next)
            localStorage.setItem('gitshelf-theme', next)
            return { theme: next }
        }),
    toggleDrawerTheme: () =>
        set((state) => {
            const next = state.drawerTheme === 'dark' ? 'light' : 'dark'
            localStorage.setItem('gitshelf-drawer-theme', next)
            return { drawerTheme: next }
        }),
})
