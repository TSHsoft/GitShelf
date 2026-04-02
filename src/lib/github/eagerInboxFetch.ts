/**
 * Eager Inbox Fetch
 *
 * Fires a lightweight request for gitshelf_pending.json BEFORE React mounts.
 *
 * Key optimization: Uses the Gist raw URL to fetch ONLY the pending file,
 * instead of gists.get() which downloads the entire Gist (including the
 * potentially large GitShelf_database.json).
 *
 * Raw URL pattern (no SHA = latest version):
 *   https://gist.githubusercontent.com/{login}/{gist_id}/raw/gitshelf_pending.json
 */

import { decryptTokenAsync } from '@/lib/crypto'

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
    const profileStr = localStorage.getItem('_gs_up_v1')

    // Need all three: token, gistId, and login
    if (!encToken || !gistId || !profileStr) return

    let login: string
    try {
        login = JSON.parse(profileStr).login
        if (!login) return
    } catch {
        return
    }

    _eagerPromise = (async (): Promise<string[] | null> => {
        try {
            const storedId = localStorage.getItem('_gs_pk_id') ?? undefined
            const token = await decryptTokenAsync(encToken, storedId)
            if (!token) return null

            // Fetch ONLY the pending file via raw URL — no full Gist download
            const rawUrl = `https://gist.githubusercontent.com/${login}/${gistId}/raw/gitshelf_pending.json`
            const res = await fetch(rawUrl, {
                headers: { Authorization: `token ${token}` },
                cache: 'no-store',
            })
            if (!res.ok) return null

            const text = await res.text()
            if (!text) return null

            const parsed = JSON.parse(text)
            return Array.isArray(parsed) ? parsed : null
        } catch {
            return null
        }
    })()
}
