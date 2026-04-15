import { z } from 'zod'

// --- Constants & Flags ---
export const MAX_ITEMS_LIMIT = 10000;

export const RepoFlags = {
    // --- 核心生命周期状态 (低 4 位，互斥) ---
    STATUS_MASK: 0xF,
    StatusActive: 0,
    StatusDeleted: 1,
    StatusRenamed: 2,
    StatusNotFound: 3,

    // --- 叠加特征标记 (高位，可组合) ---
    Archived: 1 << 4,
    Favorite: 1 << 5,
    Private: 1 << 6,
    Fork: 1 << 7,
    Stale: 1 << 8,
    HasRelease: 1 << 9,
    Profile: 1 << 10, // 代替 type === 'profile'
    Locked: 1 << 11,
    Disabled: 1 << 12,
    Empty: 1 << 13,
} as const;

// --- Zod Schemas ---

export const TagSchema = z.object({
    id: z.string(),
    name: z.string().max(25),
    color: z.string(),
    sort_order: z.number().optional(),
})

export const FolderSchema = z.object({
    id: z.string(),
    name: z.string().max(25),
    color: z.string().optional(),
    sort_order: z.number().optional(),
})

export const RepositorySchema = z.object({
    id: z.string(), // "owner/repo"
    url: z.string(),
    name: z.string(),
    owner: z.string(),
    description: z.string().catch('').default(''),
    stars: z.number(),
    language: z.string().nullable(),
    updated_at: z.string(),
    last_push_at: z.string().default(''),
    latest_release: z.string().nullable().default(null),
    flags: z.number().default(0),
    archived: z.boolean().default(false),
    status: z.enum(['active', 'deleted', 'renamed', 'stale', 'archived', 'not_found']).default('active'),
    default_branch: z.string().default('master'), // Default to master if unknown, but sync will update it
    // New fields
    type: z.enum(['repository', 'profile']).default('repository'),
    node_id: z.string().optional(),
    is_fork: z.boolean().default(false),
    is_mirror: z.boolean().default(false),
    is_disabled: z.boolean().default(false),
    is_locked: z.boolean().default(false),
    is_private: z.boolean().default(false),
    is_empty: z.boolean().default(false),
    is_favorite: z.boolean().default(false),

    topics: z.array(z.string()).default([]),

    prev_stars: z.number().optional(),
    has_new_release: z.boolean().default(false),
    last_viewed_at: z.number().optional(),
    last_synced_at: z.number().optional(), // Last time we synced this repo (independent of updated_at)
    // User-specific
    tags: z.array(z.string()),
    folder_id: z.string().nullable().optional(),
    added_at: z.number(),
    languages: z.record(z.string(), z.number()).optional(),
    profile_type: z.enum(['user', 'org']).optional(), // Only set when type === 'profile'
    note: z.string().optional(), // User-written note for this repo
})

export const SettingsSchema = z.object({
    theme: z.enum(['light', 'dark', 'system']).default('dark'),
    view_mode: z.enum(['table', 'card', 'list']).default('card'),
    backup_interval_minutes: z.number().default(0), // 0 = disabled; valid: 5,10,15,20,25,30
    trash_retention_days: z.number().default(30),   // 0 = keep forever; e.g. 7, 14, 30, 60, 90
})

export const TrashedRepoSchema = z.object({
    repo: RepositorySchema,
    deletedAt: z.number()
})

export const GitShelfDataSchema = z.object({
    version: z.number(),
    last_modified: z.number(),
    last_sync_time: z.number().optional(),
    repositories: z.record(z.string(), RepositorySchema),
    trash: z.record(z.string(), TrashedRepoSchema).default({}),
    tags: z.record(z.string(), TagSchema),
    folders: z.record(z.string(), FolderSchema).default({}),
    pending_repos: z.array(z.string()).default([]),
    settings: SettingsSchema,
})

// --- TypeScript Types ---

export type Tag = z.infer<typeof TagSchema>
export type Folder = z.infer<typeof FolderSchema>
export type Repository = z.infer<typeof RepositorySchema>
export type Settings = z.infer<typeof SettingsSchema>
export type GitShelfData = z.infer<typeof GitShelfDataSchema>
export type TrashedRepo = z.infer<typeof TrashedRepoSchema>
export type ViewMode = 'table' | 'card' | 'list'
// ...
export type RepoStatus = 'active' | 'deleted' | 'renamed' | 'stale' | 'archived' | 'not_found'
// ...
export type SortField = 'name' | 'stars' | 'language' | 'last_push_at' | 'latest_release' | 'added_at' | 'status'
export type SortDir = 'asc' | 'desc'
export type GroupBy = 'none' | 'tag' | 'language' | 'status' | 'added_at'

// --- Default Data ---

export const DEFAULT_DATA: GitShelfData = {
    version: 1,
    last_modified: Date.now(),
    repositories: {},
    trash: {},
    tags: {},
    folders: {},
    pending_repos: [],
    settings: {
        theme: 'dark',
        view_mode: 'card',
        backup_interval_minutes: 0,
        trash_retention_days: 30,
    },
}
