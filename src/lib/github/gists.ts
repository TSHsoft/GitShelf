import { Octokit } from 'octokit'

export async function getGistBackup(token: string): Promise<{ id: string, content: string, updated_at?: string } | null> {
    const octokit = new Octokit({ auth: token })
    try {
        const { data } = await octokit.rest.gists.list()
        const backupGist = data.find(gist =>
            gist.files && Object.keys(gist.files).some(filename =>
                filename.toLowerCase() === 'gitshelf_database.json' || filename.toLowerCase() === 'gitshelf.json'
            )
        )

        if (backupGist && backupGist.id) {
            const { data: fullGist } = await octokit.rest.gists.get({ gist_id: backupGist.id })

            if (fullGist.files) {
                const targetKey = Object.keys(fullGist.files).find(filename =>
                    filename.toLowerCase() === 'gitshelf_database.json' || filename.toLowerCase() === 'gitshelf.json'
                )

                if (targetKey) {
                    const file = fullGist.files[targetKey]
                    if (file && file.content) {
                        return { id: backupGist.id, content: file.content, updated_at: fullGist.updated_at }
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

export async function getGistFile(token: string, filename: string): Promise<string | null> {
    const octokit = new Octokit({ auth: token })
    try {
        const { data } = await octokit.rest.gists.list()
        const backupGist = data.find(gist =>
            gist.files && Object.keys(gist.files).some(name =>
                name.toLowerCase() === 'gitshelf_database.json' || name.toLowerCase() === 'gitshelf.json'
            )
        )
        if (backupGist && backupGist.id) {
            const { data: fullGist } = await octokit.rest.gists.get({ gist_id: backupGist.id })
            if (fullGist.files && fullGist.files[filename]) {
                return fullGist.files[filename].content || null
            }
        }
        return null
    } catch (e) {
        console.error(`Failed to get Gist file ${filename}:`, e)
        return null
    }
}

export async function updateGistFile(token: string, filename: string, content: string): Promise<void> {
    const octokit = new Octokit({ auth: token })
    try {
        const { data } = await octokit.rest.gists.list()
        const backupGist = data.find(gist =>
            gist.files && Object.keys(gist.files).some(name =>
                name.toLowerCase() === 'gitshelf_database.json' || name.toLowerCase() === 'gitshelf.json'
            )
        )
        if (backupGist && backupGist.id) {
            await octokit.rest.gists.update({
                gist_id: backupGist.id,
                files: {
                    [filename]: { content }
                }
            })
        }
    } catch (e) {
        console.error(`Failed to update Gist file ${filename}:`, e)
    }
}
