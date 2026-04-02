import { useEffect } from 'react'
import { useStore } from '@/store/useStore'
import { Octokit } from 'octokit'

export function useGithubRateLimit() {
    const token = useStore(state => state.githubToken)
    const setRateLimitRemaining = useStore(state => state.setRateLimitRemaining)
    const patStatus = useStore(state => state.patStatus)

    useEffect(() => {
        // Only fetch if a valid token is present 
        if (!token || patStatus === 'invalid') {
            setRateLimitRemaining(null)
            return
        }

        const fetchRateLimit = async () => {
            try {
                const decryptedToken = await useStore.getState().getDecryptedToken()
                const octokit = new Octokit({ auth: decryptedToken })
                const { data } = await octokit.rest.rateLimit.get()
                setRateLimitRemaining(data.rate.remaining)
            } catch (error) {
                console.error('Failed to fetch rate limit:', error)
            }
        }

        // Prefetch Gist ID in parallel so Inbox sync can skip the slow gists.list() call
        const prefetchGistId = async () => {
            const { gistId } = useStore.getState()
            if (gistId) return // already cached
            try {
                const decryptedToken = await useStore.getState().getDecryptedToken()
                if (!decryptedToken) return
                const { getGistBackup } = await import('@/lib/github/gists')
                const backup = await getGistBackup(decryptedToken)
                if (backup?.id) useStore.getState().setGistId(backup.id)
            } catch (e) {
                console.error('Failed to prefetch Gist ID:', e)
            }
        }

        // Run both in parallel — no extra wait time added
        fetchRateLimit()
        prefetchGistId()

        const intervalId = setInterval(fetchRateLimit, 5 * 60 * 1000) // Every 5 minutes

        return () => clearInterval(intervalId)

    }, [token, patStatus, setRateLimitRemaining])

    const rateLimitRemaining = useStore(state => state.rateLimitRemaining)

    // Safety buffer of 5
    const isRateLimited = rateLimitRemaining !== null && rateLimitRemaining <= 5

    return { rateLimitRemaining, isRateLimited }
}
