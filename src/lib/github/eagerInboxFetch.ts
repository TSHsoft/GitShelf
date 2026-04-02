/**
 * Eager Inbox Fetch
 *
 * Fires the gitshelf_pending.json Gist request as early as possible —
 * before React mounts — so by the time the UI is ready, the data is
 * already in-flight or even resolved.
 *
 * Rules:
 * - Only runs if both encrypted token AND gistId are already in localStorage.
 * - Does NOT do gists.list() — it needs the cached gistId to be useful.
 * - Holds the result in a module-scoped promise so App.tsx can consume it.
 */

import { decryptTokenAsync } from '@/lib/crypto'

// The in-flight (or resolved) fetch result
let _eagerPromise: Promise<string[] | null> | null = null

export function getEagerInboxPromise(): Promise<string[] | null> | null {
    return _eagerPromise
}

export function clearEagerInboxPromise() {
    _eagerPromise = null
}

export function fireEagerInboxFetch() {
    const encToken = localStorage.getItem('_gs_pk_v1')
    const gistId = localStorage.getItem('_gs_gist_id')

    // Only fast-path if we already have both cached credentials
    if (!encToken || !gistId) return

    _eagerPromise = (async (): Promise<string[] | null> => {
        try {
            const storedId = localStorage.getItem('_gs_pk_id') ?? undefined
            const token = await decryptTokenAsync(encToken, storedId)
            if (!token) return null

            // Direct API call — no gists.list() needed, we have the ID
            const res = await fetch(`https://api.github.com/gists/${gistId}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            })
            if (!res.ok) return null

            const data = await res.json()
            // Case-insensitive file lookup
            const fileKey = Object.keys(data.files || {}).find(
                (k: string) => k.toLowerCase() === 'gitshelf_pending.json'
            )
            if (!fileKey) return null

            const content = data.files[fileKey]?.content
            if (!content) return null

            const parsed = JSON.parse(content)
            return Array.isArray(parsed) ? parsed : null
        } catch {
            return null
        }
    })()
}
