import { Octokit } from 'octokit'
import type { Repository } from '@/types'
import { parseGitHubUrl } from './parser'
import { calculateRepoStatus, computeRepoFlags } from './status'

export async function fetchRepository(repoPath: string, token?: string, opts?: { skipRelease?: boolean; skipLanguages?: boolean }, signal?: AbortSignal): Promise<Repository> {
    const octokit = new Octokit({ auth: token })
    const parsed = parseGitHubUrl(repoPath) || repoPath
    const parts = parsed.split('/')
    const owner = parts[0]
    const repo = parts[1]

    if (!owner) {
        throw new Error('Invalid format. Use "owner/repo" or a GitHub URL.')
    }

    try {
        if (!repo) {
            // It's a profile
            const { data } = await octokit.rest.users.getByUsername({ username: owner, request: { signal } })
            const res = {
                id: data.login,
                node_id: data.node_id,
                url: data.html_url,
                name: data.name || data.login,
                owner: data.login,
                description: data.bio || data.company || '',
                stars: data.followers,
                prev_stars: undefined,
                language: null,
                languages: undefined,
                topics: [],
                updated_at: data.updated_at ?? new Date().toISOString(),
                last_push_at: new Date().toISOString(),
                latest_release: null,
                has_new_release: false,
                archived: false,
                is_favorite: false,
                is_disabled: false,
                is_locked: false,
                is_private: false,
                is_empty: false,
                status: 'active' as const,
                default_branch: 'master',
                tags: [],
                added_at: Date.now(),
                last_synced_at: Date.now(),
                type: 'profile' as const,
                profile_type: (data.type === 'Organization' ? 'org' : 'user') as 'org' | 'user',
                is_fork: false,
                is_mirror: false,
                flags: 0,
            }
            res.flags = computeRepoFlags(res)
            return res
        }

        const { data } = await octokit.rest.repos.get({ owner, repo, request: { signal } })

        let latest_release: string | null = null
        if (!opts?.skipRelease) {
            try {
                const { data: release } = await octokit.rest.repos.getLatestRelease({ owner, repo, request: { signal } })
                latest_release = release.tag_name
            } catch {
                // No releases
            }
        }

        let languages: Record<string, number> | undefined = undefined
        if (!opts?.skipLanguages) {
            try {
                const { data: langs } = await octokit.rest.repos.listLanguages({ owner, repo, request: { signal } })
                if (Object.keys(langs).length > 0) languages = langs
            } catch {
                // Not critical
            }
        }

        const res = {
            id: data.full_name,
            node_id: data.node_id,
            url: data.html_url,
            name: data.name,
            owner: data.owner.login,
            description: data.description ?? '',
            stars: data.stargazers_count,
            prev_stars: undefined,
            language: data.language ?? null,
            languages,
            topics: data.topics || [],
            updated_at: data.updated_at ?? new Date().toISOString(),
            last_push_at: data.pushed_at ?? new Date().toISOString(),
            latest_release,
            has_new_release: false,
            archived: data.archived ?? false,
            is_favorite: false,
            is_disabled: data.disabled ?? false,
            is_locked: ('locked' in data ? Boolean((data as { locked?: boolean }).locked) : false),
            is_private: data.private ?? false,
            is_empty: data.size === 0,
            status: (data.archived) ? 'archived' as const : 'active' as const,
            default_branch: data.default_branch,
            tags: [],
            added_at: Date.now(),
            last_synced_at: Date.now(),
            type: 'repository' as const,
            is_fork: data.fork ?? false,
            is_mirror: !!data.mirror_url,
            flags: 0,
        }
        res.flags = computeRepoFlags(res)
        return res
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('401') || msg.includes('Bad credentials')) {
            throw new Error('GitHub API Token expired or invalid')
        }
        throw err
    }
}

export async function syncRepository(
    existing: Repository,
    token?: string,
    signal?: AbortSignal
): Promise<Repository> {
    const octokit = new Octokit({ auth: token })
    const parts = existing.id.split('/')
    const owner = parts[0]
    const repo = parts[1]

    try {
        if (!repo && existing.type === 'profile') {
            const { data } = await octokit.rest.users.getByUsername({ username: owner, request: { signal } })
            const res = {
                ...existing,
                id: data.login,
                node_id: data.node_id ?? existing.node_id,
                url: data.html_url,
                name: data.name || data.login,
                owner: data.login,
                description: data.bio || data.company || '',
                stars: data.followers,
                prev_stars: existing.stars,
                updated_at: data.updated_at ?? existing.updated_at,
                last_synced_at: Date.now(),
                status: 'active' as const,
                is_fork: false,
                is_mirror: false,
                flags: 0,
            }
            res.flags = computeRepoFlags(res)
            return res
        }

        const { data } = await octokit.rest.repos.get({ owner, repo, request: { signal } })

        let latest_release = existing.latest_release
        try {
            const { data: release } = await octokit.rest.repos.getLatestRelease({ owner, repo, request: { signal } })
            latest_release = release.tag_name
        } catch {
            // No releases
        }

        let languages = existing.languages
        try {
            const { data: langs } = await octokit.rest.repos.listLanguages({ owner, repo, request: { signal } })
            if (Object.keys(langs).length > 0) languages = langs
        } catch {
            // Not critical
        }

        const newId = data.full_name
        const status = calculateRepoStatus(
            existing.id,
            newId,
            data.archived ?? false,
            data.pushed_at,
            existing.last_push_at
        )

        const has_new_release = latest_release !== existing.latest_release && !!latest_release

        const res = {
            ...existing,
            id: newId,
            node_id: data.node_id ?? existing.node_id,
            url: data.html_url,
            name: data.name,
            owner: data.owner.login,
            description: data.description ?? '',
            stars: data.stargazers_count,
            prev_stars: existing.stars,
            language: data.language ?? null,
            languages,
            topics: data.topics || [],
            updated_at: data.updated_at ?? existing.updated_at,
            last_push_at: data.pushed_at ?? existing.last_push_at,
            last_synced_at: Date.now(),
            latest_release,
            has_new_release,
            archived: data.archived ?? false,
            is_disabled: data.disabled ?? false,
            is_locked: ('locked' in data ? Boolean((data as { locked?: boolean }).locked) : false),
            is_private: data.private ?? false,
            is_empty: data.size === 0,
            status: status,
            is_favorite: existing.is_favorite,
            is_fork: data.fork ?? existing.is_fork,
            is_mirror: !!data.mirror_url,
            flags: 0,
        }
        res.flags = computeRepoFlags(res)
        return res
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.includes('401') || msg.includes('Bad credentials')) {
            throw new Error('GitHub API Token expired or invalid')
        }

        const isNotFound = msg.includes('404') || msg.includes('Not Found')
        if (isNotFound) {
            const res = { ...existing, status: 'not_found' as const }
            res.flags = computeRepoFlags(res)
            return res
        }
        throw err
    }
}
