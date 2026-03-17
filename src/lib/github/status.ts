import { RepoFlags, type Repository } from '@/types'

export function computeRepoFlags(repo: Partial<Repository>): number {
    let f = 0;

    // --- 1. 设置核心互斥状态 (Low 4 bits) ---
    if (repo.status === 'deleted') {
        f |= RepoFlags.StatusDeleted;
    } else if (repo.status === 'renamed') {
        f |= RepoFlags.StatusRenamed;
    } else if (repo.status === 'not_found') {
        f |= RepoFlags.StatusNotFound;
    } else {
        f |= RepoFlags.StatusActive;
    }

    // --- 2. 叠加特征标记 (Trait Flags) ---
    if (repo.archived) f |= RepoFlags.Archived
    if (repo.is_favorite) f |= RepoFlags.Favorite
    if (repo.is_private) f |= RepoFlags.Private
    if (repo.is_fork) f |= RepoFlags.Fork
    if (repo.type === 'profile') f |= RepoFlags.Profile
    if (repo.is_disabled) f |= RepoFlags.Disabled
    if (repo.is_locked) f |= RepoFlags.Locked
    if (repo.is_empty) f |= RepoFlags.Empty
    if (repo.latest_release || repo.has_new_release) f |= RepoFlags.HasRelease

    // Stale check (活跃度检测，超过6个月未更新)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const pushDate = repo.last_push_at ? new Date(repo.last_push_at) : (repo.updated_at ? new Date(repo.updated_at) : new Date())
    if (pushDate < sixMonthsAgo) f |= RepoFlags.Stale

    return f
}

export function calculateRepoStatus(
    existingId: string,
    newId: string | undefined,
    isArchived: boolean,
    pushedAt: string | null | undefined,
    existingLastPushAt: string | null | undefined
): 'active' | 'archived' | 'stale' | 'renamed' | 'deleted' {
    if (newId && newId !== existingId) return 'renamed'
    if (isArchived) return 'archived'

    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const lastPush = new Date(pushedAt ?? existingLastPushAt ?? Date.now())
    return lastPush < sixMonthsAgo ? 'stale' : 'active'
}

export function formatStars(count: number): string {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`
    return String(count)
}

export function getLanguageColor(lang: string | null): string {
    const colors: Record<string, string> = {
        TypeScript: '#3178c6',
        JavaScript: '#f7df1e',
        Python: '#3572A5',
        Rust: '#dea584',
        Go: '#00ADD8',
        Java: '#b07219',
        'C++': '#f34b7d',
        C: '#555555',
        Ruby: '#701516',
        Swift: '#F05138',
        Kotlin: '#A97BFF',
        Dart: '#00B4AB',
        Shell: '#89e051',
        Vue: '#41b883',
    }
    return lang ? (colors[lang] || '#cccccc') : '#cccccc'
}
