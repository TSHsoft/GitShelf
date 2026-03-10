// Type definitions for raw GitHub API responses.
// We only define the fields we actually consume to keep it maintainable.

export interface GitHubRepoResponse {
    id: number
    node_id: string
    name: string
    full_name: string
    html_url: string
    description: string | null
    stargazers_count: number
    language: string | null
    updated_at: string
    pushed_at: string | null
    default_branch: string
    archived: boolean
    disabled: boolean
    has_pages?: boolean
    fork: boolean
    private: boolean
    size: number
    owner: {
        login: string
        avatar_url: string
        html_url: string
        type: string
    }
}

export interface GitHubSearchRepoResponse {
    total_count: number
    incomplete_results: boolean
    items: GitHubRepoResponse[]
}

export interface GitHubProfileResponse {
    login: string
    id: number
    avatar_url: string
    html_url: string
    name: string | null
    company: string | null
    blog: string | null
    location: string | null
    bio: string | null
    public_repos: number
    public_gists: number
    followers: number
    following: number
    created_at: string
    updated_at: string
    type: string
}

export interface GitHubReleaseResponse {
    id: number
    tag_name: string
    name: string | null
    published_at: string | null
    html_url: string
}

export interface GitHubGistFile {
    filename: string
    type: string
    language: string | null
    raw_url: string
    size: number
    truncated?: boolean
    content?: string
}

export interface GitHubGistResponse {
    url: string
    id: string
    html_url: string
    files: Record<string, GitHubGistFile>
    created_at: string
    updated_at: string
    description: string | null
}
