import type { GitShelfData, Repository, Tag, Folder, Settings, ViewMode, SortField, SortDir, GroupBy, RepoStatus } from '@/types'

export type Theme = 'dark' | 'light'


export interface DataSlice {
    data: GitShelfData
    isLoaded: boolean
    setData: (data: GitShelfData) => void
    addRepository: (repo: Repository) => void
    removeRepository: (id: string) => void
    updateRepository: (id: string, updates: Partial<Repository>) => void
    toggleFavorite: (id: string) => void
    markAsViewed: (id: string) => void
    importData: (incoming: GitShelfData) => void
    setRepositories: (repos: Record<string, Repository>) => void
    addTag: (tag: Tag) => void
    removeTag: (id: string) => void
    updateTag: (id: string, updates: Partial<Tag>) => void
    bulkAddTags: (repoIds: string[], tagIds: string[]) => void
    addFolder: (folder: Folder) => void
    removeFolder: (id: string) => void
    updateFolder: (id: string, updates: Partial<Folder>) => void
    moveRepoToFolder: (repoId: string, folderId: string | null) => void
    bulkMoveReposToFolder: (repoIds: string[], folderId: string | null) => void
    updateSettings: (updates: Partial<Settings>) => void
    setLoaded: (loaded: boolean) => void
    resetData: () => void
}

export interface UISlice {
    searchQuery: string
    selectedTagId: string | null
    selectedFolderId: string | null
    activeRepoId: string | null
    showTrash: boolean
    groupBy: GroupBy
    theme: Theme
    drawerTheme: Theme
    viewMode: ViewMode
    sortField: SortField
    sortDir: SortDir
    statusFilter: 'all' | RepoStatus
    filterLanguage: string | null
    filterStars: string | null
    filterUpdated: string | null
    filterTag: string | null  // sidebar tag click — single
    filterTags: string[]       // filter bar — multi-select
    searchTopics: string[]     // topics tokens from the search box
    filterType: 'repository' | 'profile' | null
    filterFavorite: boolean
    selectedRepoIds: Set<string>


    setStatusFilter: (status: 'all' | RepoStatus) => void
    setFilterLanguage: (lang: string | null) => void
    setFilterStars: (stars: string | null) => void
    setFilterUpdated: (updated: string | null) => void
    setFilterTag: (tag: string | null) => void
    setFilterTags: (tags: string[]) => void
    setSearchTopics: (topics: string[]) => void
    setFilterType: (type: 'repository' | 'profile' | null) => void
    setFilterFavorite: (favorite: boolean) => void
    setSearchQuery: (q: string) => void
    setSelectedTagId: (id: string | null) => void
    setSelectedFolderId: (id: string | null) => void
    setActiveRepoId: (id: string | null) => void
    setShowTrash: (show: boolean) => void
    setViewMode: (mode: ViewMode) => void
    setSortField: (field: SortField) => void
    setSortDir: (dir: SortDir) => void
    setGroupBy: (g: GroupBy) => void
    toggleTheme: () => void
    toggleDrawerTheme: () => void
    setSelectedRepoIds: (ids: Set<string>) => void
    toggleRepoSelection: (id: string) => void
    clearSelection: () => void
}

export interface SyncSlice {
    patStatus: 'valid' | 'invalid' | 'unknown'
    isSyncing: boolean
    isOnline: boolean
    syncProgress: { done: number; total: number } | null
    syncingRepoIds: string[]
    syncErrors: Record<string, string>
    rateLimitRemaining: number | null
    lastSyncTime: number | null

    setPatStatus: (status: 'valid' | 'invalid' | 'unknown') => void
    setIsSyncing: (isSyncing: boolean) => void
    setIsOnline: (isOnline: boolean) => void
    setSyncProgress: (progress: { done: number; total: number } | null) => void
    setRateLimitRemaining: (remaining: number | null) => void
    syncRepository: (id: string, throwOnError?: boolean) => Promise<void>
    clearSyncError: (id: string) => void
    abortSync: () => void
}

export type BackupSyncStatus = 'idle' | 'syncing' | 'success' | 'error'

export interface AuthSlice {
    gistSyncStatus: BackupSyncStatus
    lastGistSyncTime: number | null
    gistSyncError: string | null
    githubToken: string | null
    githubTokenExpiry: string | null
    userProfile: { avatarUrl: string, name: string | null, login: string } | null

    setGistSyncStatus: (status: BackupSyncStatus) => void
    setLastGistSyncTime: (time: number | null) => void
    setGistSyncError: (error: string | null) => void
    setGithubToken: (token: string | null) => void
    setGithubTokenExpiry: (expiry: string | null) => void
    setUserProfile: (profile: { avatarUrl: string, name: string | null, login: string } | null) => void
}

export type GitShelfStore = DataSlice & UISlice & SyncSlice & AuthSlice
