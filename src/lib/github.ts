import { Octokit } from 'octokit'
import type { Repository } from '@/types'

// Valid GitHub pages that are NOT repositories
const NON_REPO_PAGES = new Set([
    'topics', 'explore', 'settings', 'marketplace', 'sponsors', 'orgs',
    'search', 'notifications', 'login', 'signup', 'about', 'pricing',
    'features', 'enterprise', 'team', 'customer-stories', 'security',
    'contact', 'mobile', 'solutions', 'resources', 'open-source'
])

export function parseGitHubUrl(raw: string): string | null {
    let trimmed = raw.trim()

    // Remove trailing slash
    if (trimmed.endsWith('/')) {
        trimmed = trimmed.slice(0, -1)
    }

    // Remove .git suffix
    if (trimmed.endsWith('.git')) {
        trimmed = trimmed.slice(0, -4)
    }

    let candidate = ''

    try {
        // Try parsing as a URL first
        const url = new URL(trimmed)
        if (url.hostname.includes('github.com')) {
            const parts = url.pathname.split('/').filter(Boolean)
            if (parts.length >= 2) {
                candidate = `${parts[0]}/${parts[1]}`
            } else if (parts.length === 1) {
                candidate = parts[0]
            }
        }
    } catch {
        // Ignore
    }

    if (!candidate) {
        // Handle raw "github.com/..."
        const githubMatch = trimmed.match(/github\.com\/([^/]+(?:\/[^/]+)?)/) // Matches user or user/repo
        if (githubMatch) {
            candidate = githubMatch[1]
        }
    }

    if (!candidate) {
        // Handle direct "owner/repo" or "owner"
        const parts = trimmed.split('/')
        if ((parts.length === 1 || parts.length === 2) && !trimmed.includes('.') && !trimmed.includes(':') && !trimmed.includes(' ')) {
            candidate = trimmed
        }
    }

    if (!candidate) return null

    // Validate against non-repo pages
    const [owner] = candidate.split('/')
    if (NON_REPO_PAGES.has(owner.toLowerCase())) {
        return null
    }

    return candidate
}

export async function fetchRepository(repoPath: string, token?: string, opts?: { skipRelease?: boolean; skipLanguages?: boolean }, signal?: AbortSignal): Promise<Repository> {
    const octokit = new Octokit({ auth: token })
    const parsed = parseGitHubUrl(repoPath) || repoPath // Fallback if already owner/repo but logic missed it (unlikely) or strict check failed
    const parts = parsed.split('/')
    const owner = parts[0]
    const repo = parts[1] // might be undefined

    if (!owner) {
        throw new Error('Invalid format. Use "owner/repo" or a GitHub URL.')
    }

    try {
        if (!repo) {
            // It's a profile
            const { data } = await octokit.rest.users.getByUsername({ username: owner, request: { signal } })
            return {
                id: data.login,
                node_id: data.node_id,
                url: data.html_url,
                name: data.name || data.login,
                owner: data.login,
                description: data.bio || data.company || null,
                stars: data.followers,
                prev_stars: undefined,
                language: null,
                languages: undefined,
                topics: [],
                updated_at: data.updated_at ?? new Date().toISOString(),
                last_push_at: new Date().toISOString(), // Profiles don't have this
                latest_release: null,
                has_new_release: false,
                archived: false,
                is_disabled: false,
                is_locked: false,
                is_private: false,
                is_empty: false,
                status: 'active',
                default_branch: 'master',
                tags: [],
                added_at: Date.now(),
                last_synced_at: Date.now(),
                type: 'profile'
            }
        }

        const { data } = await octokit.rest.repos.get({ owner, repo, request: { signal } })

        // Fetch latest release (non-blocking — may not exist)
        let latest_release: string | null = null
        if (!opts?.skipRelease) {
            try {
                const { data: release } = await octokit.rest.repos.getLatestRelease({ owner, repo, request: { signal } })
                latest_release = release.tag_name
            } catch {
                // No releases — that's fine
            }
        }

        // Fetch language breakdown
        let languages: Record<string, number> | undefined = undefined
        if (!opts?.skipLanguages) {
            try {
                const { data: langs } = await octokit.rest.repos.listLanguages({ owner, repo, request: { signal } })
                if (Object.keys(langs).length > 0) languages = langs
            } catch {
                // Not critical
            }
        }

        return {
            id: data.full_name,
            node_id: data.node_id,
            url: data.html_url,
            name: data.name,
            owner: data.owner.login,
            description: data.description,
            stars: data.stargazers_count,
            prev_stars: undefined, // New repo has no previous stars
            language: data.language ?? null,
            languages,
            topics: data.topics || [], // Fetch topics
            updated_at: data.updated_at ?? new Date().toISOString(),
            last_push_at: data.pushed_at ?? new Date().toISOString(),
            latest_release,
            has_new_release: false, // Initial fetch
            archived: data.archived ?? false,
            is_disabled: data.disabled ?? false,
            is_locked: (data as any).locked ?? false,
            is_private: data.private ?? false,
            is_empty: data.size === 0,
            status: (data.archived) ? 'archived' : 'active', // Basic initial status
            default_branch: data.default_branch,
            tags: [],
            added_at: Date.now(),
            last_synced_at: Date.now(),
            type: 'repository'
        }
    } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err)
        if (err.status === 401 || msg.includes('401') || msg.includes('Bad credentials')) {
            throw new Error('GitHub API Token expired or invalid')
        }
        throw err
    }
}

// Utility function to calculate repo status
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
    const lastPush = new Date(pushedAt ?? existingLastPushAt ?? Date.now()) // Prefer API data
    return lastPush < sixMonthsAgo ? 'stale' : 'active'
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
            // Re-sync profile
            const { data } = await octokit.rest.users.getByUsername({ username: owner, request: { signal } })
            return {
                ...existing,
                id: data.login,
                node_id: data.node_id ?? existing.node_id,
                url: data.html_url,
                name: data.name || data.login,
                owner: data.login,
                description: data.bio || data.company || null,
                stars: data.followers,
                prev_stars: existing.stars,
                updated_at: data.updated_at ?? existing.updated_at,
                last_synced_at: Date.now(),
                status: 'active' as any,
            }
        }

        const { data } = await octokit.rest.repos.get({ owner, repo, request: { signal } })

        let latest_release = existing.latest_release
        try {
            const { data: release } = await octokit.rest.repos.getLatestRelease({ owner, repo, request: { signal } })
            latest_release = release.tag_name
        } catch {
            // No releases
        }

        // Fetch language breakdown
        let languages = existing.languages
        try {
            const { data: langs } = await octokit.rest.repos.listLanguages({ owner, repo, request: { signal } })
            if (Object.keys(langs).length > 0) languages = langs
        } catch {
            // Not critical
        }

        const newId = data.full_name

        // --- Status Logic ---
        const status = calculateRepoStatus(
            existing.id,
            newId,
            data.archived ?? false,
            data.pushed_at,
            existing.last_push_at
        )

        // --- Release Logic ---
        const has_new_release = latest_release !== existing.latest_release && !!latest_release

        return {
            ...existing,
            id: newId,
            node_id: data.node_id ?? existing.node_id,
            url: data.html_url,
            name: data.name,
            owner: data.owner.login,
            description: data.description,
            stars: data.stargazers_count,
            prev_stars: existing.stars, // Store previous stars
            language: data.language ?? null,
            languages,
            topics: data.topics || [], // Update topics
            updated_at: data.updated_at ?? existing.updated_at,
            last_push_at: data.pushed_at ?? existing.last_push_at,
            last_synced_at: Date.now(),
            latest_release,
            has_new_release,
            archived: data.archived ?? false,
            is_disabled: data.disabled ?? false,
            is_locked: (data as any).locked ?? false,
            is_private: data.private ?? false,
            is_empty: data.size === 0,
            status: status as any, // Cast to match schema
        }
    } catch (err: any) {
        const msg = err instanceof Error ? err.message : String(err)
        if (err.status === 401 || msg.includes('401') || msg.includes('Bad credentials')) {
            throw new Error('GitHub API Token expired or invalid')
        }

        const isNotFound = err.status === 404 || msg.includes('404') || msg.includes('Not Found')
        if (isNotFound) {
            return { ...existing, status: 'not_found' as any }
        }
        throw err
    }
}

export interface SyncResult {
    updated: number
    deleted: number
    renamed: number
    rateLimitRemaining: number | null
}


function buildSyncGraphQLQuery(repos: Repository[]): string {
    const queryBody = repos.map((repo, index) => {
        if (repo.type === 'profile') {
            const fields = `
                login
                url
                name
                bio
                followers { totalCount }
                updatedAt
                id
            `
            if (repo.node_id) {
                return `
                repo${index}: node(id: "${repo.node_id}") {
                    ... on User {
                        ${fields}
                    }
                    ... on Organization {
                        login
                        url
                        name
                        description
                        updatedAt
                        id
                    }
                }
                `
            }
            return `
            repo${index}: user(login: "${repo.owner}") {
                ${fields}
            }
            `
        }

        const fields = `
            nameWithOwner
            url
            name
            owner { login }
            description
            stargazerCount
            pushedAt
            updatedAt
            isArchived
            isDisabled
            isLocked
            isPrivate
            isEmpty
            id
            primaryLanguage { name }
            languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
                edges { size node { name } }
            }
            latestRelease { tagName }
            repositoryTopics(first: 10) { nodes { topic { name } } }
            defaultBranchRef { name }
        `
        if (repo.node_id) {
            return `
            repo${index}: node(id: "${repo.node_id}") {
                ... on Repository {
                    ${fields}
                }
            }
            `
        }
        return `
            repo${index}: repository(owner: "${repo.owner}", name: "${repo.name}") {
                ${fields}
            }
            `
    }).join('\n')
    return `query { ${queryBody} }`
}


function parseGraphQLSyncResponse(
    response: any,
    repos: Repository[],
    updated: Record<string, Repository>,
    result: SyncResult
): Repository[] {
    const unresolvedRepos: Repository[] = []

    repos.forEach((existing, index) => {
        const data = response[`repo${index}`]
        if (!data) {
            // Cannot resolve by owner/name (possibly renamed or actually deleted).
            // Return to caller for REST verification.
            unresolvedRepos.push(existing)
            return
        }

        if (existing.type === 'profile') {
            const isOrg = data.__typename === 'Organization'
            const bio = isOrg ? data.description : data.bio
            const followers = isOrg ? 0 : (data.followers?.totalCount || 0)

            const newRepoData: Repository = {
                ...existing,
                id: data.login,
                node_id: data.id,
                url: data.url,
                name: data.name || data.login,
                owner: data.login,
                description: bio || null,
                stars: followers,
                prev_stars: existing.stars,
                updated_at: data.updatedAt || new Date().toISOString(),
                last_synced_at: Date.now(),
                status: 'active' as any,
            }

            result.updated++
            updated[existing.id] = newRepoData
            return
        }


        const languages: Record<string, number> = {}
        data.languages?.edges?.forEach((edge: any) => {
            languages[edge.node.name] = edge.size
        })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const topics = data.repositoryTopics?.nodes?.map((t: any) => t.topic.name).sort() || []

        const status = calculateRepoStatus(
            existing.id,
            data.nameWithOwner,
            data.isArchived,
            data.pushedAt,
            existing.last_push_at
        )

        const latest_release = data.latestRelease?.tagName || null
        const has_new_release = latest_release !== existing.latest_release && !!latest_release

        const newRepoData: Repository = {
            ...existing,
            id: data.nameWithOwner,
            node_id: data.id,
            url: data.url,
            name: data.name,
            owner: data.owner.login,
            description: data.description,
            stars: data.stargazerCount,
            prev_stars: existing.stars,
            language: data.primaryLanguage?.name ?? null,
            languages,
            topics,
            updated_at: data.updatedAt,
            last_push_at: data.pushedAt,
            latest_release,
            has_new_release,
            archived: data.isArchived,
            is_disabled: data.isDisabled,
            is_locked: data.isLocked,
            is_private: data.isPrivate,
            is_empty: data.isEmpty,
            default_branch: data.defaultBranchRef?.name ?? existing.default_branch,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            status: status as any,
            last_synced_at: Date.now(),
        }

        if (status === 'renamed') {
            result.renamed++
        } else {
            result.updated++
        }
        updated[existing.id] = newRepoData
    })

    return unresolvedRepos
}

/**
 * Batch sync a list of repositories using GraphQL.
 * Does NOT filter by staleness - assumes caller has filtered.
 */
export async function syncBatch(
    repos: Repository[],
    token?: string,
    signal?: AbortSignal
): Promise<{ repos: Record<string, Repository>; result: SyncResult }> {
    const octokit = new Octokit({ auth: token })
    const result: SyncResult = { updated: 0, deleted: 0, renamed: 0, rateLimitRemaining: null }
    const updated: Record<string, Repository> = {}

    if (repos.length === 0) return { repos: {}, result }

    const query = buildSyncGraphQLQuery(repos)

    let fallbackRepos: Repository[] = []

    try {
        if (!token) throw new Error('No token provided, skipping GraphQL')
        if (signal?.aborted) return { repos: updated, result }
        let response: any;
        try {
            response = await octokit.graphql(query, { request: { signal } })
        } catch (err: any) {
            if (err.data) {
                response = err.data;
            } else {
                throw err;
            }
        }
        fallbackRepos = parseGraphQLSyncResponse(response, repos, updated, result)

    } catch (error: any) {
        console.warn('Batch sync (GraphQL) failed entirely, falling back to REST:', error)

        if (error.status === 401 || (error.message && (error.message.includes('401') || error.message.includes('Bad credentials')))) {
            throw new Error('GitHub API Token expired or invalid')
        }

        // Entire batch failed, fallback for all
        fallbackRepos = repos
    }

    // Fallback: Sync unresolved or failed repos one by one using REST
    // REST can accurately resolve renamed repositories via 301 redirects, unlike GraphQL `owner/name` queries.
    for (const repo of fallbackRepos) {
        if (signal?.aborted) break
        try {
            const synced = await syncRepository(repo, token, signal)

            if (synced.status === 'deleted' || (synced.status as any) === 'not_found') {
                result.deleted++
            } else if (synced.status === 'renamed') {
                result.renamed++
            } else {
                result.updated++
            }
            updated[repo.id] = synced

            // Short delay to avoid secondary rate limits on burst REST calls
            await new Promise(resolve => setTimeout(resolve, 80))
        } catch (err) {
            console.error(`REST sync failed for ${repo.id}:`, err)
            // If REST also fails (e.g. true 404), mark as not_found safely
            if ((err as any)?.status === 404) {
                result.deleted++
                updated[repo.id] = { ...repo, status: 'not_found' as any }
            }
        }
    }

    return { repos: updated, result }
}

export async function syncAll(
    repositories: Record<string, Repository>,
    token?: string,
    onProgress?: (done: number, total: number) => void,
    signal?: AbortSignal
): Promise<{ repos: Record<string, Repository>; result: SyncResult; migrations: Record<string, string> }> {
    const ids = Object.keys(repositories)
    const result: SyncResult = { updated: 0, deleted: 0, renamed: 0, rateLimitRemaining: null }
    const updated: Record<string, Repository> = { ...repositories }
    const migrations: Record<string, string> = {}

    // Constants
    const BATCH_SIZE = 50

    // Group 1: Valid repos with node_id (Optimized GraphQL, ignores not_found status)
    const group1NodeId = ids.filter(id => {
        const r = repositories[id]
        return r && r.node_id && r.status !== 'deleted'
    })

    // Group 3: Valid repos without node_id (Legacy GraphQL - resolves path to node_id)
    const group3NoNodeId = ids.filter(id => {
        const r = repositories[id]
        return r && !r.node_id && r.status !== 'deleted' && (r.status as string) !== 'not_found'
    })

    // Group 2: not_found repos (REST fallback, redirect resolution)
    // Only applies to repos WITHOUT a node_id that are not_found
    const group2NotFound = ids.filter(id => {
        const r = repositories[id]
        return r && !r.node_id && (r.status as string) === 'not_found'
    })

    const totalToSync = group1NodeId.length + group3NoNodeId.length + group2NotFound.length
    let totalDone = ids.length - totalToSync
    onProgress?.(totalDone, ids.length)

    // If nothing to sync, return early (but simulate progress 100%)
    if (totalToSync === 0) {
        onProgress?.(ids.length, ids.length)
        return { repos: updated, result, migrations }
    }

    // Phase 1 + 2: Process valid repos in bulk using GraphQL
    // We process Group 1 (Node IDs) first, then Group 3 (Legacy Paths)
    const graphqlGroups = [group1NodeId, group3NoNodeId]

    for (const graphqlGroup of graphqlGroups) {
        if (graphqlGroup.length === 0) continue;

        for (let i = 0; i < graphqlGroup.length; i += BATCH_SIZE) {
            if (signal?.aborted) break

            const batchIds = graphqlGroup.slice(i, i + BATCH_SIZE)
            const batchRepos = batchIds.map(id => repositories[id])

            try {
                const { repos: batchUpdatedRepos, result: batchResult } = await syncBatch(batchRepos, token, signal)

                result.updated += batchResult.updated
                result.deleted += batchResult.deleted
                result.renamed += batchResult.renamed

                // Merge batch results into the main 'updated' map
                batchIds.forEach(oldId => {
                    const newRepoData = batchUpdatedRepos[oldId]

                    if (newRepoData) {
                        if (newRepoData.status === 'deleted' || (newRepoData.status as any) === 'not_found') {
                            updated[oldId] = newRepoData
                        } else if (newRepoData.id !== oldId) {
                            // Key swap for renamed or case-changed repos
                            delete updated[oldId]
                            updated[newRepoData.id] = newRepoData
                            migrations[oldId] = newRepoData.id
                        } else {
                            updated[oldId] = newRepoData
                        }
                    }
                })

            } catch (error) {
                console.error('Batch sync failed:', error)
            }

            // Smoothly report progress for this batch
            const nextBatchTarget = totalDone + batchIds.length
            const steps = nextBatchTarget - totalDone

            if (steps > 0) {
                const msPerStep = Math.max(5, 150 / steps) // ~150ms animation per batch, fast but visible
                for (let s = 1; s <= steps; s++) {
                    if (signal?.aborted) break
                    totalDone++
                    onProgress?.(totalDone, ids.length)
                    if (s < steps) await new Promise(r => setTimeout(r, msPerStep))
                }
            }

            // Brief pause between GraphQL batches
            if (!signal?.aborted && i + BATCH_SIZE < graphqlGroup.length) {
                await new Promise(resolve => setTimeout(resolve, 300))
            }
        }

        if (signal?.aborted) break
    }

    // Phase 3: Process originally not_found repos using REST individually
    for (const id of group2NotFound) {
        if (signal?.aborted) break

        const repo = repositories[id]

        try {
            // REST can follow rename redirects properly
            const synced = await syncRepository(repo, token)

            if (synced.status === 'deleted' || (synced.status as any) === 'not_found') {
                result.deleted++
                updated[repo.id] = synced
            } else if (synced.id !== repo.id) {
                result.renamed++
                delete updated[repo.id]
                updated[synced.id] = synced
            } else {
                result.updated++
                updated[repo.id] = synced
            }
        } catch (err: any) {
            console.error(`REST sync failed for ${repo.id}:`, err)
            if (err?.status === 404) {
                result.deleted++
                updated[repo.id] = { ...repo, status: 'not_found' as any }
            }
        }

        totalDone++
        onProgress?.(totalDone, ids.length)
        if (!signal?.aborted) {
            await new Promise(resolve => setTimeout(resolve, 300)) // REST rate limit pause
        }
    }

    // Ensure onProgress finishes at 100%
    onProgress?.(ids.length, ids.length)

    return { repos: updated, result, migrations }
}

export async function fetchReadme(owner: string, repo: string, token?: string): Promise<string> {
    const octokit = new Octokit({ auth: token })
    try {

        const { data } = await octokit.rest.repos.getReadme({
            owner,
            repo,
            mediaType: {
                format: 'raw',
            },
        }) as any
        return String(data)
    } catch {
        return ''
    }
}

export interface ProfileRepo {
    id: string;
    name: string;
    description: string | null;
    stars: number;
    forks: number;
    language: { name: string; color: string } | null;
}

export interface SocialAccount {
    provider: string;
    url: string;
}

export interface ProfileDetails {
    avatarUrl: string;
    name: string | null;
    login: string;
    bio: string | null;
    company: string | null;
    location: string | null;
    email: string | null;
    websiteUrl: string | null;
    twitterUsername: string | null;
    pronouns: string | null;
    status: { emojiHTML: string | null, message: string | null } | null;
    socialAccounts: SocialAccount[];
    followersCount: number;
    followingCount: number;
    createdAt: string;
    repositoriesCount: number;
    pinnedRepos: ProfileRepo[];
    popularRepos: ProfileRepo[];
}

export async function fetchProfileDetails(username: string, token?: string): Promise<ProfileDetails | null> {
    if (!token) return null;
    const octokit = new Octokit({ auth: token })
    const query = `
query($username: String!) {
  repositoryOwner(login: $username) {
    ... on User {
      __typename
      avatarUrl
      name
      login
      bio
      company
      location
      email
      websiteUrl
      twitterUsername
      pronouns
      status {
        emojiHTML
        message
      }
      socialAccounts(first: 5) {
        nodes {
          provider
          url
        }
      }
      createdAt
      followers { totalCount }
      following { totalCount }
      repositories(first: 6, ownerAffiliations: OWNER, isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          id
          name
          description
          stargazerCount
          forkCount
          primaryLanguage { name color }
        }
      }
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            id
            name
            description
            stargazerCount
            forkCount
            primaryLanguage { name color }
          }
        }
      }
    }
    ... on Organization {
      __typename
      avatarUrl
      name
      login
      description
      location
      email
      websiteUrl
      twitterUsername
      createdAt
      repositories(first: 6, isFork: false, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          id
          name
          description
          stargazerCount
          forkCount
          primaryLanguage { name color }
        }
      }
      pinnedItems(first: 6, types: REPOSITORY) {
        nodes {
          ... on Repository {
            id
            name
            description
            stargazerCount
            forkCount
            primaryLanguage { name color }
          }
        }
      }
    }
  }
}
`
    try {

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response: any = await octokit.graphql(query, { username })
        const owner = response.repositoryOwner
        if (!owner) return null

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapRepo = (r: any): ProfileRepo => ({
            id: r.id,
            name: r.name,
            description: r.description,
            stars: r.stargazerCount,
            forks: r.forkCount,
            language: r.primaryLanguage ? { name: r.primaryLanguage.name, color: r.primaryLanguage.color } : null
        })

        const isOrg = owner.__typename === 'Organization'

        return {
            avatarUrl: owner.avatarUrl,
            name: owner.name,
            login: owner.login,
            bio: isOrg ? owner.description : owner.bio,
            company: isOrg ? null : owner.company,
            location: owner.location,
            email: owner.email || null,
            websiteUrl: owner.websiteUrl,
            twitterUsername: owner.twitterUsername,
            pronouns: isOrg ? null : owner.pronouns,
            status: isOrg || (!owner.status?.emojiHTML && !owner.status?.message) ? null : {
                emojiHTML: owner.status.emojiHTML,
                message: owner.status.message
            },
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            socialAccounts: isOrg ? [] : (owner.socialAccounts?.nodes || []).map((s: any) => ({ provider: s.provider, url: s.url })),
            followersCount: owner.followers?.totalCount || 0,
            followingCount: owner.following?.totalCount || 0,
            createdAt: owner.createdAt,
            repositoriesCount: owner.repositories?.totalCount || 0,
            pinnedRepos: (owner.pinnedItems?.nodes || []).map(mapRepo),
            popularRepos: (owner.repositories?.nodes || []).map(mapRepo)
        }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error("Failed to fetch profile details", msg);
        return null;
    }
}

export async function validateToken(token: string): Promise<'valid' | 'invalid' | 'limited'> {
    if (!token) return 'invalid'
    const octokit = new Octokit({ auth: token })
    try {
        const { data } = await octokit.rest.rateLimit.get()
        if (data.rate.remaining === 0) {
            return 'limited'
        }
        await octokit.rest.users.getAuthenticated()
        return 'valid'
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('rate limit')) return 'limited'
        return 'invalid'
    }
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

export async function validateTokenAndGetExpiry(token: string): Promise<{ status: 'valid' | 'invalid' | 'limited', expiry: string | null }> {
    if (!token) return { status: 'invalid', expiry: null }
    const octokit = new Octokit({ auth: token })
    try {
        const { data, headers } = await octokit.rest.rateLimit.get()
        if (data.rate.remaining === 0) {
            const exp = headers['github-authentication-token-expiration']
            return { status: 'limited', expiry: exp ? String(exp) : null }
        }
        await octokit.rest.users.getAuthenticated()
        const exp = headers['github-authentication-token-expiration']
        return { status: 'valid', expiry: exp ? String(exp) : null }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('rate limit')) return { status: 'limited', expiry: null }
        return { status: 'invalid', expiry: null }
    }
}

export async function fetchAuthenticatedUserProfile(token: string): Promise<{ avatarUrl: string; name: string | null; login: string } | null> {
    if (!token) return null
    const octokit = new Octokit({ auth: token })
    try {
        const { data } = await octokit.rest.users.getAuthenticated()
        return {
            avatarUrl: data.avatar_url,
            name: data.name ?? null,
            login: data.login,
        }
    } catch (e) {
        console.error('Failed to fetch authenticated user profile:', e)
        return null
    }
}

export async function getGistBackup(token: string): Promise<{ id: string, content: string } | null> {
    const octokit = new Octokit({ auth: token })
    try {
        const { data } = await octokit.rest.gists.list()
        // Find a gist that contains any case variation of the database filename
        const backupGist = data.find(gist =>
            gist.files && Object.keys(gist.files).some(filename =>
                filename.toLowerCase() === 'gitshelf_database.json' || filename.toLowerCase() === 'gitshelf.json'
            )
        )

        if (backupGist && backupGist.id) {
            const { data: fullGist } = await octokit.rest.gists.get({ gist_id: backupGist.id })

            // Get the exact filename that matched
            if (fullGist.files) {
                const targetKey = Object.keys(fullGist.files).find(filename =>
                    filename.toLowerCase() === 'gitshelf_database.json' || filename.toLowerCase() === 'gitshelf.json'
                )

                if (targetKey) {
                    const file = fullGist.files[targetKey]
                    if (file && file.content) {
                        return { id: backupGist.id, content: file.content }
                    }
                }
            }
        }
        return null
    } catch (e) {
        console.error('Failed to get Gist backup:', e)
        throw e
    }
}

export async function upsertGistBackup(token: string, content: string, existingGistId?: string): Promise<string> {
    const octokit = new Octokit({ auth: token })
    try {
        let filename = 'GitShelf_database.json' // Default

        if (existingGistId) {
            // Fetch the existing gist to find the exact filename to update
            const { data: fullGist } = await octokit.rest.gists.get({ gist_id: existingGistId })
            if (fullGist.files) {
                const targetKey = Object.keys(fullGist.files).find(name =>
                    name.toLowerCase() === 'gitshelf_database.json' || name.toLowerCase() === 'gitshelf.json'
                )
                if (targetKey) {
                    filename = targetKey
                }
            }

            const files = {
                [filename]: { content }
            }

            const { data } = await octokit.rest.gists.update({
                gist_id: existingGistId,
                files: files as any,
                description: 'GitShelf Database Backup'
            })
            return data.id!
        } else {
            const files = {
                [filename]: { content }
            }

            const { data } = await octokit.rest.gists.create({
                files,
                description: 'GitShelf Database Backup',
                public: false
            })
            return data.id!
        }
    } catch (e) {
        console.error('Failed to upsert Gist backup:', e)
        throw e
    }
}
function buildFetchGraphQLQuery(repoPaths: string[]): string {
    const queryBody = repoPaths.map((path, index) => {
        const [owner, name] = path.split('/')

        // Handle profile URLs
        if (!owner || !name) {
            const profileFields = `
                login
                url
                name
                bio
                followers { totalCount }
                updatedAt
                id
            `
            return `
            repo${index}: user(login: "${path}") {
                ${profileFields}
            }
            `
        }

        const fields = `
            nameWithOwner
            url
            name
            owner { login }
            description
            stargazerCount
            pushedAt
            updatedAt
            isArchived
            isDisabled
            isLocked
            isPrivate
            isEmpty
            id
            primaryLanguage { name }
            defaultBranchRef { name }
            repositoryTopics(first: 10) {
                nodes {
                    topic {
                        name
                    }
                }
            }
            latestRelease {
                tagName
            }
        `
        return `
        repo${index}: repository(owner: "${owner}", name: "${name}") {
            ${fields}
        }
        `
    }).join('\n')
    return `query { ${queryBody} }`
}

/**
 * Batch-fetch repositories using GraphQL.
 * Returns a map of path -> Repository.
 */
export async function fetchRepositoriesBatchGraphQL(
    repoPaths: string[],
    token: string,
    signal?: AbortSignal
): Promise<Record<string, Repository>> {
    const octokit = new Octokit({ auth: token })
    const query = buildFetchGraphQLQuery(repoPaths)

    try {
        let response: any;
        try {
            response = await octokit.graphql(query, { request: { signal } });
        } catch (err: any) {
            if (err.data) {
                response = err.data;
            } else {
                throw err;
            }
        }

        const results: Record<string, Repository> = {}

        repoPaths.forEach((path, index) => {
            const data = response[`repo${index}`]
            if (!data) {
                // Return a NOT_FOUND placeholder — detect profile vs repo by path segment count
                const [owner, name] = path.split('/')
                results[path] = {
                    id: path,
                    url: `https://github.com/${path}`,
                    name: name || path,
                    owner: owner || 'unknown',
                    description: null,
                    stars: 0,
                    language: null,
                    topics: [],
                    updated_at: new Date().toISOString(),
                    last_push_at: new Date().toISOString(),
                    latest_release: null,
                    has_new_release: false,
                    archived: false,
                    is_disabled: false,
                    is_locked: false,
                    is_private: false,
                    is_empty: true,
                    status: 'not_found',
                    default_branch: 'master',
                    tags: [],
                    added_at: Date.now(),
                    last_synced_at: Date.now(),
                    type: name ? 'repository' : 'profile'
                }
                return
            }

            // Handle Profile response
            if (data.__typename === 'User' || data.__typename === 'Organization' || data.login) {
                results[path] = {
                    id: data.login,
                    node_id: data.id,
                    url: data.url,
                    name: data.name || data.login,
                    owner: data.login,
                    description: data.bio || data.description || null,
                    stars: data.followers?.totalCount || 0,
                    prev_stars: undefined,
                    language: null,
                    languages: undefined,
                    topics: [],
                    updated_at: data.updatedAt || new Date().toISOString(),
                    last_push_at: new Date().toISOString(),
                    latest_release: null,
                    has_new_release: false,
                    archived: false,
                    is_disabled: false,
                    is_locked: false,
                    is_private: false,
                    is_empty: false,
                    status: 'active',
                    default_branch: 'master',
                    tags: [],
                    added_at: Date.now(),
                    last_synced_at: Date.now(),
                    type: 'profile'
                }
                return
            }

            // Handle Repository response
            results[path] = {
                id: data.nameWithOwner,
                node_id: data.id,
                url: data.url,
                name: data.name,
                owner: data.owner.login,
                description: data.description,
                stars: data.stargazerCount,
                prev_stars: undefined,
                language: data.primaryLanguage?.name ?? null,
                languages: undefined,
                topics: data.repositoryTopics?.nodes?.map((n: any) => n.topic.name).sort() || [],
                updated_at: data.updatedAt,
                last_push_at: data.pushedAt,
                latest_release: data.latestRelease?.tagName ?? null,
                has_new_release: false,
                archived: data.isArchived,
                is_disabled: data.isDisabled,
                is_locked: data.isLocked,
                is_private: data.isPrivate,
                is_empty: data.isEmpty,
                status: data.isArchived ? 'archived' : 'active',
                default_branch: data.defaultBranchRef?.name ?? 'master',
                tags: [],
                added_at: Date.now(),
                last_synced_at: Date.now(),
                type: 'repository'
            }
        })

        return results
    } catch (err) {
        console.error('GraphQL batch fetch failed:', err)
        throw err // Let caller handle fallback
    }
}
