import { Octokit } from 'octokit'

export async function getGistBackup(token: string): Promise<{ id: string, content: string } | null> {
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
