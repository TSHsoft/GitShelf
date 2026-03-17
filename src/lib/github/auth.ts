import { Octokit } from 'octokit'
import type { TokenValidationResult } from './types'

export async function validateToken(token: string): Promise<'valid' | 'invalid' | 'limited'> {
    if (!token) return 'invalid'
    const octokit = new Octokit({ auth: token })
    try {
        const { data } = await octokit.rest.rateLimit.get()
        if (data.rate.remaining === 0) {
            return 'limited'
        }
        await octokit.rest.users.getAuthenticated()
        return 'valid'
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('rate limit')) return 'limited'
        return 'invalid'
    }
}

export async function validateTokenAndGetExpiry(token: string): Promise<TokenValidationResult> {
    if (!token) return { status: 'invalid', expiry: null }
    const octokit = new Octokit({ auth: token })
    try {
        const { data, headers } = await octokit.rest.rateLimit.get()
        const exp = headers['github-authentication-token-expiration']
        const expiry = exp ? String(exp) : null

        if (data.rate.remaining === 0) {
            return { status: 'limited', expiry }
        }
        await octokit.rest.users.getAuthenticated()
        return { status: 'valid', expiry }
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        if (msg.toLowerCase().includes('rate limit')) return { status: 'limited', expiry: null }
        return { status: 'invalid', expiry: null }
    }
}

export async function fetchAuthenticatedUserProfile(token: string): Promise<{ avatarUrl: string; name: string | null; login: string, id: number } | null> {
    if (!token) return null
    const octokit = new Octokit({ auth: token })
    try {
        const { data } = await octokit.rest.users.getAuthenticated()
        return {
            avatarUrl: data.avatar_url,
            name: data.name ?? null,
            login: data.login,
            id: data.id,
        }
    } catch (e) {
        console.error('Failed to fetch authenticated user profile:', e)
        return null
    }
}
