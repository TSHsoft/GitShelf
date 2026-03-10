/**
 * Parse browser bookmark HTML files (Netscape Bookmark format)
 * Used by Chrome, Edge, Firefox, Opera, Brave — all export in this format.
 *
 * Extracts GitHub repository URLs and returns owner/repo paths.
 */

import { parseGitHubUrl } from './github'
import type { Repository } from '@/types'

/**
 * Extract GitHub repo paths from a Netscape Bookmark HTML string.
 * Deduplicates and strips trailing `.git`, query strings, and fragment hashes.
 */
export interface BookmarkRepo {
    id: string
    title?: string
    added_at?: number
}

/**
 * Extract GitHub repo paths from a Netscape Bookmark HTML string.
 * Deduplicates and strips trailing `.git`, query strings, and fragment hashes.
 */
export function parseBookmarkHtml(html: string): BookmarkRepo[] {
    const seen = new Set<string>()
    const results: BookmarkRepo[] = []

    // Match <A ... HREF="..." ...>Text</A>
    // We capture the tag and the inner text content
    const aTagRe = /<A\s+[^>]+>([\s\S]*?)<\/A>/gi
    let m: RegExpExecArray | null

    while ((m = aTagRe.exec(html)) !== null) {
        const fullTag = m[0]
        const innerText = m[1].trim()

        const hrefMatch = /HREF="([^"]+)"/i.exec(fullTag)
        if (!hrefMatch) continue

        const url = hrefMatch[1]
        // Only process URLs that look like github.com
        if (!url.includes('github.com')) continue

        const path = parseGitHubUrl(url)
        if (!path) continue

        const key = path.toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)

        // Extract ADD_DATE if present
        let added_at: number | undefined
        const dateMatch = /ADD_DATE="(\d+)"/i.exec(fullTag)
        if (dateMatch) {
            // Netscape bookmarks use seconds, JS uses ms
            added_at = parseInt(dateMatch[1], 10) * 1000
        }

        results.push({ id: path, title: innerText, added_at })
    }

    return results
}

/**
 * Batch-fetch repos with rate limit awareness.
 * Fetches one repo at a time with a delay between calls to avoid hitting the GitHub API rate limit.
 *
 * @param items - Array of {id, added_at} objects
 * @param token - Optional GitHub personal access token
 * @param onProgress - Progress callback
 * @param delayMs - Delay between API calls (default: 1200ms for unauthenticated, 300ms for authenticated)
 */
export async function batchFetchRepos(
    items: BookmarkRepo[],
    token: string | undefined,
    onProgress: (done: number, total: number, current: string, status: 'ok' | 'skip' | 'error' | 'ratelimit') => void,
    signal?: AbortSignal,
): Promise<{ imported: number; skipped: number; notFound: number; errors: number; rateLimited: boolean; cancelled: boolean; pendingRest: BookmarkRepo[] }> {
    const { useStore } = await import('@/store/useStore')

    // Clear logs at start
    const CHUNK_SIZE = token ? 50 : 1 // GraphQL only if token is present
    const total = items.length
    let imported = 0
    let skipped = 0
    let notFound = 0
    let errors = 0
    const rateLimited = false
    let cancelled = false
    let doneCount = 0
    const pendingRest: BookmarkRepo[] = []

    // Import functions directly to avoid circular dependency issues at top level
    const { fetchRepositoriesBatchGraphQL } = await import('@/lib/github')

    // Helper to process a single repo result (shared by GraphQL and REST paths)
    const processRepoResult = (repo: Repository, bookmarkItem: BookmarkRepo) => {
        const store = useStore.getState()
        if (bookmarkItem.added_at) {
            repo.added_at = bookmarkItem.added_at
        }
        store.addRepository(repo)
        if (repo.status === 'not_found') {
            notFound++
        } else {
            imported++
        }
        doneCount++
        onProgress(doneCount, total, repo.id, 'ok')
    }

    // Process in chunks
    for (let i = 0; i < items.length; i += CHUNK_SIZE) {
        if (signal?.aborted || rateLimited) break

        const chunk = items.slice(i, i + CHUNK_SIZE)
        // Update "current" text immediately to first path in chunk
        onProgress(doneCount, total, chunk[0].id, 'ok')
        const store = useStore.getState()

        // Filter out already existing repos in this chunk
        const neededInChunk = chunk.filter(item => !store.data.repositories[item.id])
        const alreadyInChunk = chunk.filter(item => store.data.repositories[item.id])

        // Mark skipped
        if (alreadyInChunk.length > 0) {
            alreadyInChunk.forEach(item => {
                skipped++
                doneCount++
                onProgress(doneCount, total, item.id, 'skip')
            })
            // Yield to main thread to prevent React UI (spinner) freezing
            await new Promise(r => setTimeout(r, 0))
        }

        if (neededInChunk.length === 0) continue

        const neededPaths = neededInChunk.map(item => item.id)

        try {
            // Attempt 1: GraphQL Batch (Only if we have a token and more than 1 item)
            if (token && neededPaths.length > 0) {
                try {
                    const batchResults = await fetchRepositoriesBatchGraphQL(neededPaths, token, signal)
                    neededInChunk.forEach(item => {
                        const repo = batchResults[item.id]
                        if (repo && repo.status !== 'not_found') {
                            processRepoResult(repo, item)
                        } else {
                            // Repo not found in GraphQL, queue for deep scan
                            pendingRest.push(item)
                            doneCount++
                            onProgress(doneCount, total, item.id, 'skip')
                        }
                    })
                    // Success! Move to next chunk
                    continue
                } catch (gqlErr: unknown) {
                    const error = gqlErr as Error & { name?: string }
                    if (signal?.aborted || error.name === 'AbortError') {
                        cancelled = true
                        break
                    }
                    console.warn(`GraphQL batch failed for chunk starting at ${i}, queueing for REST:`, error)
                    // If network fails entirely, queue the whole chunk
                    neededInChunk.forEach(item => {
                        pendingRest.push(item)
                        doneCount++
                        onProgress(doneCount, total, item.id, 'skip')
                    })
                    continue
                }
            } else {
                // If no token, queue everything for REST naturally
                neededInChunk.forEach(item => {
                    pendingRest.push(item)
                    doneCount++
                    onProgress(doneCount, total, item.id, 'skip')
                })
            }
        } catch (err) {
            console.error('Unexpected chunk error:', err)
        }

        // Small Delay between chunks to respect network
        if (token && i + CHUNK_SIZE < items.length) {
            await new Promise(r => setTimeout(r, 200))
        }
    }

    if (rateLimited || cancelled) {
        errors += items.length - doneCount
    }

    return { imported, skipped, notFound, errors, rateLimited, cancelled, pendingRest }
}

/**
 * Secondary phase for repositories not found via GraphQL (Deep Scan).
 * Processes each item individually using REST API to follow redirects and handle true 404s.
 */
export async function processRestFallback(
    items: BookmarkRepo[],
    token: string | undefined,
    onProgress: (done: number, total: number, current: string, status: 'ok' | 'error' | 'ratelimit') => void,
    signal?: AbortSignal,
): Promise<{ imported: number; notFound: number; errors: number; rateLimited: boolean; cancelled: boolean }> {
    const { useStore } = await import('@/store/useStore')
    const { fetchRepository } = await import('@/lib/github')

    const total = items.length
    let imported = 0
    let notFound = 0
    let errors = 0
    let rateLimited = false
    let cancelled = false
    let doneCount = 0

    // Helper to process a single repo result
    const processRepoResult = (repo: Repository, bookmarkItem: BookmarkRepo) => {
        const store = useStore.getState()
        if (bookmarkItem.added_at) {
            repo.added_at = bookmarkItem.added_at
        }
        store.addRepository(repo)
        if (repo.status === 'not_found') {
            notFound++
        } else {
            imported++
        }
        doneCount++
        onProgress(doneCount, total, repo.id, 'ok')
    }

    for (const item of items) {
        if (signal?.aborted) {
            cancelled = true
            break
        }
        if (rateLimited) break

        let success = false
        let attempts = 0
        const maxAttempts = 3

        while (!success && attempts < maxAttempts && !signal?.aborted) {
            attempts++
            try {
                const repo = await fetchRepository(item.id, token, { skipRelease: true, skipLanguages: true }, signal)
                processRepoResult(repo, item)
                success = true
            } catch (err: unknown) {
                const error = err as Error & { status?: number }
                const msg = error.message || String(err)

                if (msg.includes('rate limit') || msg.includes('403')) {
                    rateLimited = true
                    onProgress(doneCount, total, item.id, 'ratelimit')
                    break
                }

                // Check if it's a 404 / Not Found
                if (error.status === 404 || msg.includes('404') || msg.toLowerCase().includes('not found')) {
                    const [owner, name] = item.id.split('/')
                    const fakeRepo: Repository = {
                        id: item.id,
                        url: `https://github.com/${item.id}`,
                        name: name || item.id,
                        owner: owner || 'unknown',
                        description: item.title || null,
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
                        added_at: item.added_at ?? Date.now(),
                        last_synced_at: Date.now(),
                        type: name ? 'repository' : 'profile'
                    }
                    processRepoResult(fakeRepo, item)
                    success = true
                    break
                }

                // If it's another network error, retry
                if (attempts < maxAttempts) {
                    await new Promise(r => setTimeout(r, 500))
                } else {
                    errors++
                    doneCount++
                    onProgress(doneCount, total, item.id, 'error')
                }
            }
        }

        // Small delay between REST calls to respect limits
        if (!rateLimited && !cancelled) {
            await new Promise(r => setTimeout(r, 300))
        }
    }

    if (rateLimited || cancelled) {
        errors += items.length - doneCount
    }

    return { imported, notFound, errors, rateLimited, cancelled }
}
