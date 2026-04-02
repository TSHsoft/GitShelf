import { Octokit } from 'octokit'

export async function getGistBackup(token: string, gistId?: string | null): Promise<{ id: string, content: string, updated_at?: string } | null> {
    const octokit = new Octokit({ auth: token })
    try {
        let targetId = gistId

        if (!targetId) {
            const { data } = await octokit.rest.gists.list()
            const backupGist = data.find(gist =>
                gist.files && Object.keys(gist.files).some(filename =>
                    filename.toLowerCase() === 'gitshelf_database.json' || filename.toLowerCase() === 'gitshelf.json'
                )
            )
            targetId = backupGist?.id
        }

        if (targetId) {
            const { data: fullGist } = await octokit.rest.gists.get({ gist_id: targetId })
            if (fullGist.files) {
                const targetKey = Object.keys(fullGist.files).find(filename =>
                    filename.toLowerCase() === 'gitshelf_database.json' || filename.toLowerCase() === 'gitshelf.json'
                )

                if (targetKey) {
                    const file = fullGist.files[targetKey]
                    if (file && file.content) {
                        return { id: targetId, content: file.content, updated_at: fullGist.updated_at }
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
        let filename = 'GitShelf_database.json'

        if (existingGistId) {
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
                files: files as Record<string, { content: string }>,
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

export async function getGistFile(token: string, filename: string, gistId?: string | null): Promise<{ id: string, content: string } | null> {
    const octokit = new Octokit({ auth: token })
    try {
        let targetId = gistId
        
        if (!targetId) {
            const { data } = await octokit.rest.gists.list()
            const backupGist = data.find(gist =>
                gist.files && Object.keys(gist.files).some(name =>
                    name.toLowerCase() === 'gitshelf_database.json' || name.toLowerCase() === 'gitshelf.json'
                )
            )
            targetId = backupGist?.id
        }

        if (targetId) {
            const { data: fullGist } = await octokit.rest.gists.get({ gist_id: targetId })
            if (fullGist.files) {
                // Find file case-insensitively
                const actualName = Object.keys(fullGist.files).find(n => n.toLowerCase() === filename.toLowerCase())
                if (actualName && fullGist.files[actualName]?.content) {
                    return { id: targetId, content: fullGist.files[actualName].content! }
                }
            }
        }
        return null
    } catch (e) {
        console.error(`Failed to get Gist file ${filename}:`, e)
        return null
    }
}

export async function updateGistFile(token: string, filename: string, content: string, gistId?: string | null): Promise<void> {
    const octokit = new Octokit({ auth: token })
    try {
        let targetId = gistId

        if (!targetId) {
            const { data } = await octokit.rest.gists.list()
            const backupGist = data.find(gist =>
                gist.files && Object.keys(gist.files).some(name =>
                    name.toLowerCase() === 'gitshelf_database.json' || name.toLowerCase() === 'gitshelf.json'
                )
            )
            targetId = backupGist?.id
        }

        if (targetId) {
            await octokit.rest.gists.update({
                gist_id: targetId,
                files: {
                    [filename]: { content }
                }
            })
        }
    } catch (e) {
        console.error(`Failed to update Gist file ${filename}:`, e)
    }
}

/**
 * Lightweight fetch for the pending inbox file only.
 * Uses the Gist raw URL to avoid downloading the entire Gist
 * (which includes the potentially large database file).
 */
export async function fetchPendingInboxRaw(token: string, login: string, gistId: string): Promise<string[] | null> {
    try {
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
    } catch (e) {
        console.error('Failed to fetch pending inbox via raw URL:', e)
        return null
    }
}
