import React, { useEffect, useState } from 'react'
import { X, ExternalLink, Calendar, Star, Tag as TagIcon, BookOpen, Globe, Sun, Moon, Heart, Clock, User, Building2, Book } from 'lucide-react'
import { fetchReadme, formatStars, fetchProfileDetails, type ProfileDetails } from '@/lib/github'
import { formatDate } from '@/lib/utils'
import { useStore } from '@/store/useStore'
import { useShallow } from 'zustand/react/shallow'
import { ReadmeViewer } from './repo-drawer/ReadmeViewer'
import { ProfileDashboard } from './repo-drawer/ProfileDashboard'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'

interface RepoDrawerProps {
    repoId: string
    onClose: () => void
}

export function RepoDrawer({ repoId, onClose }: RepoDrawerProps) {
    const repo = useStore(React.useCallback(state => state.data.repositories[repoId], [repoId]))
    const drawerTheme = useStore(state => state.drawerTheme)
    const toggleDrawerTheme = useStore(state => state.toggleDrawerTheme)
    const toggleFavorite = useStore(state => state.toggleFavorite)
    const github_token = useStore(state => state.githubToken)
    const markAsViewed = useStore(state => state.markAsViewed)

    // Use useShallow for array mapping to prevent re-renders when other tags change
    const tags = useStore(useShallow(state =>
        repo ? repo.tags.map((id) => state.data.tags[id]).filter(Boolean) : []
    ))
    const [readme, setReadme] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)
    const [profileDetails, setProfileDetails] = useState<ProfileDetails | null>(null)

    useLockBodyScroll()

    // 1. Fetch README & Profile
    useEffect(() => {
        if (!repo) return

        const loadReadme = async () => {
            setLoading(true)
            try {
                const token = await useStore.getState().getDecryptedToken()

                // GitHub profile readmes are stored in a repository named exactly after the user
                const targetRepoName = repo.type === 'profile' ? repo.owner : repo.name
                const content = await fetchReadme(repo.owner, targetRepoName, token)
                setReadme(content || 'No README found.')

                if (repo.type === 'profile') {
                    const profileData = await fetchProfileDetails(repo.owner, token)
                    setProfileDetails(profileData)
                }
            } catch (err) {
                console.error(err)
                setReadme('Failed to load README / Profile data.')
            } finally {
                setLoading(false)
            }
        }

        loadReadme()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [repo?.owner, repo?.name, repo?.type, github_token]) // Do NOT include onClose or full repo object here so it doesn't refetch on tag/favorite update

    // 2. Escape Key Listener
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }
        document.addEventListener('keydown', handleKeyDown)

        return () => {
            document.removeEventListener('keydown', handleKeyDown)
        }
    }, [onClose])

    const baseUrls = React.useMemo(() => {
        if (!repo) return null
        const branch = repo.default_branch || 'main'
        const targetRepoName = repo.type === 'profile' ? repo.owner : repo.name
        return {
            rawBase: `https://raw.githubusercontent.com/${repo.owner}/${targetRepoName}/${branch}/`,
            blobBase: `https://github.com/${repo.owner}/${targetRepoName}/blob/${branch}/`
        }
    }, [repo])

    if (!repo) return null

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 transition-opacity"
                onClick={onClose}
            />

            {/* Drawer */}
            <div 
                data-theme={drawerTheme} 
                className="relative mt-14 rounded-tl-2xl w-full max-w-[calc(100vw-1.5rem)] md:max-w-[calc(100vw-18rem)] lg:max-w-[1200px] h-[calc(100%-3.5rem)] bg-[var(--color-surface)] text-[var(--color-text)] shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.3)] flex flex-col animate-in slide-in-from-right duration-300 border-l border-t border-[var(--color-border)] @container"
            >
                {/* Header */}
                <div className="flex items-center justify-between py-3 px-6 border-b border-[var(--color-border)] bg-[var(--color-surface-2)] rounded-tl-2xl">
                    <div className="flex items-center gap-3 min-w-0">
                        {repo.type === 'profile' ? (
                            repo.profile_type === 'org'
                                ? <Building2 className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
                                : <User className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
                        ) : (
                            <Book className="h-5 w-5 shrink-0 text-[var(--color-text-muted)]" />
                        )}
                        <h2 className="flex items-baseline gap-1.5 font-bold truncate">
                            <span className="text-sm font-medium text-[var(--color-text-muted)]">{repo.owner}</span>
                            <span className="text-sm font-medium text-[var(--color-text-muted)]">/</span>
                            <span className="text-xl text-[var(--color-text)]">{repo.name}</span>
                        </h2>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => toggleFavorite(repo.id)}
                            title={repo.is_favorite ? "Remove from Favorites" : "Add to Favorites"}
                            className={`p-2 rounded-lg hover:bg-[var(--color-surface)] transition-colors ${repo.is_favorite ? 'text-rose-500' : 'text-[var(--color-text-muted)] hover:text-rose-500'
                                }`}
                        >
                            <Heart className={`h-5 w-5 ${repo.is_favorite ? 'fill-current' : ''}`} />
                        </button>
                        <a
                            href={repo.type === 'profile' ? repo.url : `${repo.url}#readme`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => markAsViewed(repo.id)}
                            title="Open on GitHub"
                            className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        >
                            <ExternalLink className="h-5 w-5" />
                        </a>
                        <button
                            onClick={toggleDrawerTheme}
                            title={drawerTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                            className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        >
                            {drawerTheme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-lg hover:bg-[var(--color-surface)] text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8" style={{ willChange: 'transform' }}>
                    {/* Profile Dashboard (if type === 'profile') */}
                    {repo.type === 'profile' ? (
                        loading && !profileDetails ? (
                            <ProfileSkeleton drawerTheme={drawerTheme} />
                        ) : profileDetails ? (
                            <ErrorBoundary isFullPage={false}>
                                <ProfileDashboard
                                    repo={repo}
                                    profileDetails={profileDetails}
                                    loading={loading}
                                    readme={readme}
                                    baseUrls={baseUrls}
                                    drawerTheme={drawerTheme}
                                />
                            </ErrorBoundary>
                        ) : null
                    ) : (
                        // Normal Repo Layout
                        <>
                            {/* Stats & Topics (For normal repos) */}
                            <div className="space-y-6 mb-8">
                                {/* Topics */}
                                {(repo.topics.length > 0 || tags.length > 0) && (
                                    <div className="flex flex-wrap gap-2">
                                        {repo.topics.map(topic => (
                                            <span key={topic} className="px-2.5 py-1 rounded-full bg-[var(--color-accent)]/10 text-[var(--color-accent)] text-xs font-medium border border-[var(--color-accent)]/20">
                                                #{topic}
                                            </span>
                                        ))}
                                        {tags.map(tag => (
                                            <span key={tag.id} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border" style={{
                                                backgroundColor: `${tag.color}10`,
                                                color: tag.color,
                                                borderColor: `${tag.color}30`
                                            }}>
                                                <TagIcon className="h-3 w-3" />
                                                {tag.name}
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {/* Description */}
                                {repo.description && (
                                    <p className="text-[var(--color-text-subtle)] leading-relaxed">
                                        {repo.description}
                                    </p>
                                )}

                                {/* Meta Grid */}
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 p-4 rounded-xl bg-[var(--color-surface-2)] border border-[var(--color-border)] shadow-sm">
                                    <div className="space-y-1">
                                        <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                            <Star className="h-3 w-3" /> Stars
                                        </div>
                                        <div className="font-mono font-medium text-[var(--color-text)]">{formatStars(repo.stars)}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                            <Globe className="h-3 w-3" /> Language
                                        </div>
                                        <div className="font-medium" style={{ color: repo.language ? 'var(--color-text)' : 'inherit' }}>
                                            {repo.language || 'Unknown'}
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                            <Calendar className="h-3 w-3" /> Updated
                                        </div>
                                        <div className="text-sm font-medium text-[var(--color-text)]">{formatDate(repo.updated_at)}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-xs text-[var(--color-text-muted)] flex items-center gap-1">
                                            <Clock className="h-3 w-3" /> Push
                                        </div>
                                        <div className="text-sm font-medium text-[var(--color-text)]">{repo.last_push_at ? formatDate(repo.last_push_at) : '—'}</div>
                                    </div>
                                </div>
                            </div>

                            {/* README */}
                            <ErrorBoundary isFullPage={false}>
                                <ReadmeViewer
                                    loading={loading}
                                    readme={readme}
                                    baseUrls={baseUrls}
                                    drawerTheme={drawerTheme}
                                    repoUrl={repo.url}
                                    title={
                                        <>
                                            <BookOpen className="h-4 w-4" />
                                            README.md
                                        </>
                                    }
                                />
                            </ErrorBoundary>
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}

import { Skeleton } from './ui/Skeleton'

function ProfileSkeleton({ drawerTheme }: { drawerTheme: string }) {
    return (
        <div className={`flex flex-col lg:flex-row gap-8 lg:gap-10 ${drawerTheme === 'dark' ? 'animate-pulse-slow' : ''}`}>
            {/* Left Column Skeleton */}
            <div className="w-full lg:w-[296px] shrink-0 flex flex-col gap-6">
                <div className="relative w-full max-w-[296px] mx-auto lg:mx-0 pr-[40px] pb-[20px]">
                    <Skeleton className="w-[256px] h-[256px] rounded-full mx-auto lg:mx-0 border border-[var(--color-border)] shadow-sm" />
                </div>
                
                <div className="space-y-3 px-4 lg:px-0">
                    <Skeleton className="h-8 w-3/4 mx-auto lg:mx-0" />
                    <Skeleton className="h-6 w-1/2 mx-auto lg:mx-0 opacity-60" />
                </div>

                <Skeleton className="h-10 w-full rounded-lg" />
                
                <div className="space-y-4 px-4 lg:px-0 mt-2">
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-2 justify-center lg:justify-start">
                        <Skeleton className="h-4 w-20" />
                        <Skeleton className="h-4 w-20" />
                    </div>
                </div>

                <div className="space-y-3 px-4 lg:px-0 mt-4 border-t border-[var(--color-border)] pt-6">
                    <div className="flex gap-3 items-center">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-32" />
                    </div>
                    <div className="flex gap-3 items-center">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-40" />
                    </div>
                    <div className="flex gap-3 items-center">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                </div>
            </div>

            {/* Right Column Skeleton */}
            <div className="flex-1 min-w-0 flex flex-col gap-8">
                <div className="space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-[var(--color-border)]">
                        <Skeleton className="h-4 w-4" />
                        <Skeleton className="h-4 w-48" />
                    </div>
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-[95%]" />
                        <Skeleton className="h-4 w-[90%]" />
                    </div>
                    <Skeleton className="h-[200px] w-full rounded-xl" />
                </div>

                <div className="space-y-4 mt-4">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-3 w-24" />
                    </div>
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                        <Skeleton className="h-32 rounded-xl border border-[var(--color-border)]" />
                        <Skeleton className="h-32 rounded-xl border border-[var(--color-border)]" />
                    </div>
                </div>
            </div>
        </div>
    )
}
