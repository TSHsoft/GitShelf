import { Octokit } from 'octokit'
import type { Repository } from '@/types'
import { calculateRepoStatus, computeRepoFlags } from './status'
import { syncRepository } from './rest'
import type { GraphQLRepoData, ProfileDetails, ProfileRepo, SyncResult } from './types'

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
                __typename
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
                        __typename
                    }
                }
                `
            }
            return `
            repo${index}: repositoryOwner(login: "${repo.owner}") {
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
                    __typename
                }
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
            isFork
            isMirror
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
    response: Record<string, unknown>,
    repos: Repository[],
    updated: Record<string, Repository>,
    result: SyncResult
): Repository[] {
    const unresolvedRepos: Repository[] = []

    repos.forEach((existing, index) => {
        const data = response[`repo${index}`] as GraphQLRepoData | undefined
        if (!data) {
            unresolvedRepos.push(existing)
            return
        }

        if (existing.type === 'profile') {
            const isOrg = data.__typename === 'Organization'
            const bio = isOrg ? data.description : data.bio
            const followers = data.followers?.totalCount || 0

            const profileLogin = data.login ?? existing.id
            const newRepoData: Repository = {
                ...existing,
                id: profileLogin,
                node_id: data.id,
                url: data.url,
                name: data.name ?? profileLogin,
                owner: profileLogin,
                description: bio || '',
                stars: isOrg ? existing.stars : followers,
                prev_stars: isOrg ? existing.prev_stars : existing.stars,
                updated_at: data.updatedAt || new Date().toISOString(),
                last_synced_at: Date.now(),
                status: 'active',
                is_favorite: existing.is_favorite,
                profile_type: (isOrg ? 'org' : 'user') as 'org' | 'user',
                is_fork: false,
                is_mirror: false,
                flags: 0,
            }
            newRepoData.flags = computeRepoFlags(newRepoData)

            result.updated++
            updated[existing.id] = newRepoData
            return
        }

        const languages: Record<string, number> = {}
        data.languages?.edges?.forEach((edge: { size: number; node: { name: string } }) => {
            languages[edge.node.name] = edge.size
        })

        const topics = data.repositoryTopics?.nodes?.map((t: { topic: { name: string } }) => t.topic.name).sort() || []

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
            description: data.description ?? '',
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
            status: status,
            is_favorite: existing.is_favorite,
            last_synced_at: Date.now(),
            is_fork: data.isFork,
            is_mirror: data.isMirror,
            flags: 0,
        }
        newRepoData.flags = computeRepoFlags(newRepoData)

        if (status === 'renamed') {
            result.renamed++
        } else {
            result.updated++
        }
        updated[existing.id] = newRepoData
    })

    return unresolvedRepos
}

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
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let response: any;
        try {
            response = await octokit.graphql(query, { request: { signal } })
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const error = err as any
            if (error.data) {
                response = error.data
            } else {
                throw err;
            }
        }
        if (response) {
            fallbackRepos = parseGraphQLSyncResponse(response, repos, updated, result)
        }

    } catch (err: unknown) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const error = err as any
        console.warn('Batch sync (GraphQL) failed entirely, falling back to REST:', error)

        const msg = error.message || String(err)
        if (error.status === 401 || msg.includes('401') || msg.includes('Bad credentials')) {
            throw new Error('GitHub API Token expired or invalid')
        }

        fallbackRepos = repos
    }

    for (const repo of fallbackRepos) {
        if (signal?.aborted) break
        try {
            const synced = await syncRepository(repo, token, signal)

            if (synced.status === 'deleted' || synced.status === 'not_found') {
                result.deleted++
            } else if (synced.status === 'renamed') {
                result.renamed++
            } else {
                result.updated++
            }
            updated[repo.id] = synced

            await new Promise(resolve => setTimeout(resolve, 80))
        } catch (err) {
            console.error(`REST sync failed for ${repo.id}:`, err)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const error = err as any
            if (error.status === 404) {
                result.deleted++
                updated[repo.id] = { ...repo, status: 'not_found' }
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

    const BATCH_SIZE = 50

    const group1NodeId = ids.filter(id => {
        const r = repositories[id]
        return r && r.node_id && r.status !== 'deleted'
    })

    const group3NoNodeId = ids.filter(id => {
        const r = repositories[id]
        return r && !r.node_id && r.status !== 'deleted' && (r.status as string) !== 'not_found'
    })

    const group2NotFound = ids.filter(id => {
        const r = repositories[id]
        return r && !r.node_id && (r.status as string) === 'not_found'
    })

    const totalToSync = group1NodeId.length + group3NoNodeId.length + group2NotFound.length
    let totalDone = ids.length - totalToSync
    onProgress?.(totalDone, ids.length)

    if (totalToSync === 0) {
        onProgress?.(ids.length, ids.length)
        return { repos: updated, result, migrations }
    }

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

                batchIds.forEach(oldId => {
                    const newRepoData = batchUpdatedRepos[oldId]

                    if (newRepoData) {
                        if (newRepoData.status === 'deleted' || newRepoData.status === 'not_found') {
                            updated[oldId] = newRepoData
                        } else if (newRepoData.id !== oldId) {
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

            const nextBatchTarget = totalDone + batchIds.length
            const steps = nextBatchTarget - totalDone

            if (steps > 0) {
                const msPerStep = Math.max(5, 150 / steps)
                for (let s = 1; s <= steps; s++) {
                    if (signal?.aborted) break
                    totalDone++
                    onProgress?.(totalDone, ids.length)
                    if (s < steps) await new Promise(r => setTimeout(r, msPerStep))
                }
            }

            if (!signal?.aborted && i + BATCH_SIZE < graphqlGroup.length) {
                await new Promise(resolve => setTimeout(resolve, 300))
            }
        }

        if (signal?.aborted) break
    }

    for (const id of group2NotFound) {
        if (signal?.aborted) break

        const repo = repositories[id]

        try {
            const synced = await syncRepository(repo, token)

            if (synced.status === 'deleted' || synced.status === 'not_found') {
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
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const error = err as any
            console.error(`REST sync failed for ${repo.id}:`, err)
            if (error.status === 404) {
                result.deleted++
                updated[repo.id] = { ...repo, status: 'not_found' }
            }
        }

        totalDone++
        onProgress?.(totalDone, ids.length)
        if (!signal?.aborted) {
            await new Promise(resolve => setTimeout(resolve, 300))
        }
    }

    onProgress?.(ids.length, ids.length)
    return { repos: updated, result, migrations }
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
      repositories(first: 10, ownerAffiliations: OWNER, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          id
          name
          owner { login }
          description
          stargazerCount
          forkCount
          primaryLanguage { name color }
          isMirror
          isArchived
          url
        }
      }
      pinnedItems(first: 10, types: REPOSITORY) {
        nodes {
          ... on Repository {
            id
            name
            owner { login }
            description
            stargazerCount
            forkCount
            primaryLanguage { name color }
            isMirror
            isArchived
            url
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
      repositories(first: 10, orderBy: {field: STARGAZERS, direction: DESC}) {
        totalCount
        nodes {
          id
          name
          owner { login }
          description
          stargazerCount
          forkCount
          primaryLanguage { name color }
          isMirror
          isArchived
          url
        }
      }
    }
  }
}
`
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response: any = await octokit.graphql(query, { username });
        const owner = response.repositoryOwner;
        if (!owner) return null;

        const isOrg = owner.__typename === 'Organization';
        
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mapRepo = (r: any): ProfileRepo => ({
            id: r.id,
            name: r.name,
            owner: r.owner.login,
            description: r.description,
            stars: r.stargazerCount,
            forks: r.forkCount,
            language: r.primaryLanguage?.name || null,
            languageColor: r.primaryLanguage?.color || null,
            url: r.url,
            isArchived: r.isArchived,
            isFork: r.isFork || false,
            isMirror: r.isMirror,
        });

        return {
            avatarUrl: owner.avatarUrl,
            name: owner.name,
            login: owner.login,
            bio: isOrg ? owner.description : owner.bio,
            company: owner.company || null,
            location: owner.location,
            email: owner.email,
            websiteUrl: owner.websiteUrl,
            twitterUsername: owner.twitterUsername,
            pronouns: !isOrg ? owner.pronouns : null,
            status: !isOrg ? owner.status : null,
            socialAccounts: !isOrg ? (owner.socialAccounts?.nodes || []) : [],
            followersCount: !isOrg ? (owner.followers?.totalCount || 0) : 0,
            followingCount: !isOrg ? (owner.following?.totalCount || 0) : 0,
            createdAt: owner.createdAt,
            repositoriesCount: owner.repositories?.totalCount || 0,
            pinnedRepos: !isOrg ? (owner.pinnedItems?.nodes || []).map(mapRepo) : [],
            popularRepos: (owner.repositories?.nodes || []).map(mapRepo),
            type: isOrg ? 'Organization' : 'User',
        };
    } catch (err) {
        console.error('Failed to fetch profile details:', err);
        return null;
    }
}

function buildFetchGraphQLQuery(repoPaths: string[]): string {
    const queryBody = repoPaths.map((path, index) => {
        const [owner, name] = path.split('/')

        if (!owner || !name) {
            const profileFields = `
                ... on User {
                    login
                    url
                    name
                    bio
                    followers { totalCount }
                    following { totalCount }
                    updatedAt
                    id
                }
                ... on Organization {
                    login
                    url
                    name
                    description
                    updatedAt
                    id
                }
            `
            return `
            repo${index}: repositoryOwner(login: "${path}") {
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
            isFork
            isMirror
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

export async function fetchRepositoriesBatchGraphQL(
    repoPaths: string[],
    token: string,
    signal?: AbortSignal
): Promise<Record<string, Repository>> {
    const octokit = new Octokit({ auth: token })
    const query = buildFetchGraphQLQuery(repoPaths)

    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let response: any;
        try {
            response = await octokit.graphql(query, { request: { signal } });
        } catch (err: unknown) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const graphqlErr = err as any;
            if (graphqlErr.data) {
                response = graphqlErr.data;
            } else {
                throw err;
            }
        }

        const results: Record<string, Repository> = {}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const typedResponse = response as Record<string, any> | null;

        repoPaths.forEach((path, index) => {
            const data = typedResponse?.[`repo${index}`] as GraphQLRepoData | undefined;
            if (!data) {
                const [owner, name] = path.split('/')
                results[path] = {
                    id: path,
                    url: `https://github.com/${path}`,
                    name: name || path,
                    owner: owner || 'unknown',
                    description: '',
                    stars: 0,
                    language: null,
                    topics: [],
                    updated_at: new Date().toISOString(),
                    last_push_at: new Date().toISOString(),
                    latest_release: null,
                    has_new_release: false,
                    archived: false,
                    is_favorite: false,
                    is_disabled: false,
                    is_locked: false,
                    is_private: false,
                    is_empty: true,
                    status: 'not_found',
                    default_branch: 'master',
                    tags: [],
                    added_at: Date.now(),
                    last_synced_at: Date.now(),
                    type: name ? 'repository' as const : 'profile' as const,
                    is_fork: false,
                    is_mirror: false,
                    flags: 0,
                }
                results[path].flags = computeRepoFlags(results[path])
                return
            }

            if (data.__typename === 'User' || data.__typename === 'Organization' || data.login) {
                const profileLogin = data.login ?? path
                results[path] = {
                    id: profileLogin,
                    node_id: data.id,
                    url: data.url,
                    name: data.name ?? profileLogin,
                    owner: profileLogin,
                    description: data.bio ?? data.description ?? '',
                    stars: data.followers?.totalCount || 0,
                    prev_stars: undefined,
                    language: null,
                    languages: undefined,
                    topics: [],
                    updated_at: data.updatedAt ?? new Date().toISOString(),
                    last_push_at: new Date().toISOString(),
                    latest_release: null,
                    has_new_release: false,
                    archived: false,
                    is_favorite: false,
                    is_disabled: false,
                    is_locked: false,
                    is_private: false,
                    is_empty: false,
                    status: 'active',
                    default_branch: 'master',
                    tags: [],
                    added_at: Date.now(),
                    last_synced_at: Date.now(),
                    type: 'profile' as const,
                    is_fork: false,
                    is_mirror: false,
                    flags: 0,
                }
                results[path].flags = computeRepoFlags(results[path])
                return
            }

            results[path] = {
                id: data.nameWithOwner,
                node_id: data.id,
                url: data.url,
                name: data.name,
                owner: data.owner.login,
                description: data.description ?? '',
                stars: data.stargazerCount,
                prev_stars: undefined,
                language: data.primaryLanguage?.name ?? null,
                languages: undefined,
                topics: data.repositoryTopics?.nodes?.map((n: { topic: { name: string } }) => n.topic.name).sort() || [],
                updated_at: data.updatedAt,
                last_push_at: data.pushedAt,
                latest_release: data.latestRelease?.tagName ?? null,
                has_new_release: false,
                archived: data.isArchived,
                is_favorite: false,
                is_disabled: data.isDisabled,
                is_locked: data.isLocked,
                is_private: data.isPrivate,
                is_empty: data.isEmpty,
                status: data.isArchived ? 'archived' : 'active',
                default_branch: data.defaultBranchRef?.name ?? 'master',
                tags: [],
                added_at: Date.now(),
                last_synced_at: Date.now(),
                type: 'repository' as const,
                is_fork: data.isFork,
                is_mirror: data.isMirror,
                flags: 0,
            }
            results[path].flags = computeRepoFlags(results[path])
        })

        return results
    } catch (err) {
        console.error('GraphQL batch fetch failed:', err)
        throw err
    }
}
