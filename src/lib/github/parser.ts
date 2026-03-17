// Valid GitHub pages that are NOT repositories
export const NON_REPO_PAGES = new Set([
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
