import { Octokit } from 'octokit'

export async function fetchReadme(owner: string, repo: string, token?: string): Promise<string> {
    const octokit = new Octokit({ auth: token })
    try {
        const response = await octokit.rest.repos.getReadme({
            owner,
            repo,
            mediaType: {
                format: 'raw',
            },
        }) as unknown as { data: string }
        return response.data
    } catch {
        return ''
    }
}
