import { Users, Building2, MapPin, Link as LinkIcon, Twitter, Globe, BookOpen, Star, GitFork, Book, Mail } from 'lucide-react'
import DOMPurify from 'dompurify'
import { formatStars, type ProfileDetails } from '@/lib/github'
import type { Repository } from '@/types'
import { ReadmeViewer } from './ReadmeViewer'

interface ProfileDashboardProps {
    repo: Repository
    profileDetails: ProfileDetails
    loading: boolean
    readme: string | null
    baseUrls: { rawBase: string, blobBase: string } | null
    drawerTheme: string
}

export function ProfileDashboard({
    repo,
    profileDetails,
    loading,
    readme,
    baseUrls,
    drawerTheme
}: ProfileDashboardProps) {
    return (
        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
            {/* Left Column - Personal Info */}
            <div className="w-full lg:w-[296px] shrink-0 flex flex-col gap-4 text-[var(--color-text)]">
                {/* Avatar */}
                <div className="relative w-full max-w-[296px] mx-auto lg:mx-0 pr-[40px] pb-[20px]">
                    <img src={profileDetails.avatarUrl} alt={profileDetails.name || profileDetails.login} className="w-full max-w-[256px] aspect-square rounded-full border border-[var(--color-border)] shadow-sm object-cover" />
                    {profileDetails.status && profileDetails.status.emojiHTML && DOMPurify.sanitize(profileDetails.status.emojiHTML) && (
                        <div className="absolute bottom-[28px] left-[180px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-full px-3 py-1.5 flex items-center text-sm shadow-sm hover:translate-x-1 transition-all duration-300 cursor-pointer group overflow-hidden w-fit max-w-[40px] hover:max-w-[200px] z-10">
                            <span dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(profileDetails.status.emojiHTML, { ALLOWED_TAGS: ['g-emoji', 'img', 'span'], ALLOWED_ATTR: ['class', 'src', 'alt', 'fallback-src', 'alias'] }) }} className="shrink-0" />
                            {profileDetails.status.message && (
                                <span className="truncate opacity-0 group-hover:opacity-100 group-hover:ml-2 transition-all duration-300 ease-in-out whitespace-nowrap">
                                    {profileDetails.status.message}
                                </span>
                            )}
                        </div>
                    )}
                </div>

                {/* Names */}
                <div className="mt-2 text-center lg:text-left">
                    <h1 className="text-2xl font-bold leading-tight">{profileDetails.name || profileDetails.login}</h1>
                    <span className="text-xl font-light text-[var(--color-text-muted)]">
                        {profileDetails.login}
                        {profileDetails.pronouns && <span className="mx-1">·</span>}
                        {profileDetails.pronouns}
                    </span>
                </div>

                {/* Follow Button */}
                <a href={`https://github.com/${profileDetails.login}`} target="_blank" rel="noopener noreferrer" className="w-full py-1.5 px-3 bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-md font-semibold text-sm text-center hover:bg-[var(--color-surface)] transition-colors mt-1 block">
                    Follow
                </a>

                {/* Bio */}
                {profileDetails.bio && (
                    <p className="mt-1 text-[15px] text-[var(--color-text)] leading-snug text-center lg:text-left">{profileDetails.bio}</p>
                )}

                {/* Followers */}
                <div className="flex items-center gap-1 mt-1 text-sm text-[var(--color-text-muted)] flex-wrap justify-center lg:justify-start">
                    <a href={`https://github.com/${profileDetails.login}?tab=followers`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors">
                        <Users className="h-4 w-4 shrink-0" />
                        <span className="font-semibold text-[var(--color-text)]">{profileDetails.followersCount}</span> followers
                    </a>
                    <span className="mx-0.5">·</span>
                    <a href={`https://github.com/${profileDetails.login}?tab=following`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-[var(--color-accent)] transition-colors">
                        <span className="font-semibold text-[var(--color-text)]">{profileDetails.followingCount}</span> following
                    </a>
                </div>

                {/* Details List */}
                <ul className="flex flex-col gap-1.5 mt-2 text-sm text-[var(--color-text)] items-center lg:items-start text-center lg:text-left">
                    {profileDetails.company && (
                        <li className="flex items-center gap-2 max-w-full">
                            <Building2 className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" /> <span className="truncate">{profileDetails.company}</span>
                        </li>
                    )}
                    {profileDetails.location && (
                        <li className="flex items-center gap-2 max-w-full">
                            <MapPin className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" /> <span className="truncate">{profileDetails.location}</span>
                        </li>
                    )}
                    {profileDetails.email && (
                        <li className="flex items-center gap-2 max-w-full">
                            <Mail className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                            <a href={`mailto:${profileDetails.email}`} className="truncate hover:text-[var(--color-accent)] transition-colors">{profileDetails.email}</a>
                        </li>
                    )}
                    {profileDetails.websiteUrl && (
                        <li className="flex items-center gap-2 max-w-full">
                            <LinkIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                            <a href={profileDetails.websiteUrl.startsWith('http') ? profileDetails.websiteUrl : `https://${profileDetails.websiteUrl}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-[var(--color-accent)] transition-colors">{profileDetails.websiteUrl.replace(/^https?:\/\//, '')}</a>
                        </li>
                    )}
                    {profileDetails.socialAccounts?.map((soc) => (
                        <li key={soc.url} className="flex items-center gap-2 max-w-full">
                            {soc.provider === 'TWITTER' ? <Twitter className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" /> :
                                soc.provider === 'LINKEDIN' ? <Globe className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" /> :
                                    <LinkIcon className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />}
                            <a href={soc.url} target="_blank" rel="noopener noreferrer" className="truncate hover:text-[var(--color-accent)] transition-colors">{soc.url.replace(/^https?:\/\//, '')}</a>
                        </li>
                    ))}
                    {profileDetails.twitterUsername && !profileDetails.socialAccounts?.some(s => s.provider === 'TWITTER' || s.url.includes('twitter.com')) && (
                        <li className="flex items-center gap-2 max-w-full">
                            <Twitter className="h-4 w-4 shrink-0 text-[var(--color-text-muted)]" />
                            <a href={`https://twitter.com/${profileDetails.twitterUsername}`} target="_blank" rel="noopener noreferrer" className="truncate hover:text-[#1DA1F2] transition-colors">@{profileDetails.twitterUsername}</a>
                        </li>
                    )}
                </ul>
            </div>

            {/* Right Column - Readme & Repos */}
            <div className="flex-1 min-w-0 flex flex-col gap-8">
                {/* Profile README */}
                <ReadmeViewer
                    loading={loading}
                    readme={readme}
                    baseUrls={baseUrls}
                    drawerTheme={drawerTheme}
                    repoUrl={repo.url}
                    title={
                        <>
                            <BookOpen className="h-4 w-4" />
                            {repo.owner} / README.md
                        </>
                    }
                />

                {/* Pinned/Popular Repositories Overview */}
                {(profileDetails.pinnedRepos.length > 0 || profileDetails.popularRepos.length > 0) && (() => {
                    const isPinned = profileDetails.pinnedRepos.length > 0;
                    const displayRepos = isPinned ? profileDetails.pinnedRepos : profileDetails.popularRepos;

                    return (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
                                <h3 className="text-sm font-semibold text-[var(--color-text)] flex items-center gap-2 m-0">
                                    {isPinned ? 'Pinned' : 'Popular repositories'}
                                </h3>
                                <div className="text-xs text-[var(--color-text-subtle)] flex items-center gap-1">
                                    <Book className="h-3 w-3" />
                                    {profileDetails.repositoriesCount} public repos
                                </div>
                            </div>

                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                                {displayRepos.map(pr => (
                                    <a key={pr.id} href={`https://github.com/${profileDetails.login}/${pr.name}`} target="_blank" rel="noreferrer" className="flex flex-col gap-2 p-4 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] transition-colors group shadow-sm">
                                        <div className="flex items-center justify-between">
                                            <span className="font-semibold text-[var(--color-text)] group-hover:text-[var(--color-accent)] flex items-center gap-2 truncate transition-colors text-base">
                                                <BookOpen className="h-4 w-4 text-[var(--color-text-muted)] shrink-0" />
                                                <span className="truncate">{pr.name}</span>
                                            </span>
                                            <span className="text-xs text-[var(--color-text-muted)] px-2 py-0.5 rounded-full border border-[var(--color-border)] font-medium">Public</span>
                                        </div>
                                        {pr.description && <p className="text-xs text-[var(--color-text-subtle)] line-clamp-2 mt-1 mb-2 leading-relaxed">{pr.description}</p>}
                                        <div className="flex items-center gap-4 text-xs text-[var(--color-text-muted)] mt-auto pt-2">
                                            {pr.language && (
                                                <span className="flex items-center gap-1.5 shrink-0">
                                                    <span className="w-3 h-3 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]" style={{ backgroundColor: pr.language.color }} />
                                                    {pr.language.name}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1 hover:text-[var(--color-accent)] shrink-0 transition-colors" title="Stars"><Star className="h-3.5 w-3.5" />{formatStars(pr.stars)}</span>
                                            <span className="flex items-center gap-1 hover:text-[var(--color-accent)] shrink-0 transition-colors" title="Forks"><GitFork className="h-3.5 w-3.5" />{formatStars(pr.forks)}</span>
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )
                })()}

                {/* Top Languages */}
                {profileDetails.popularRepos && profileDetails.popularRepos.filter(r => r.language).length > 0 && (
                    <div className="space-y-3 pt-4 border-t border-[var(--color-border)]">
                        <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider m-0">Top languages</h3>
                        <div className="flex items-center gap-4 flex-wrap">
                            {Array.from(new Map(profileDetails.popularRepos.filter(r => r.language).map(r => [r.language!.name, r.language!])).values()).slice(0, 5).map(lang => (
                                <span key={lang.name} className="flex items-center gap-1.5 text-sm text-[var(--color-text)]">
                                    <span className="w-3 h-3 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]" style={{ backgroundColor: lang.color }} />
                                    {lang.name}
                                </span>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
