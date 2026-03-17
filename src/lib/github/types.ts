export interface GraphQLRepoData {
    __typename?: string;
    login?: string;
    id: string;
    url: string;
    name: string;
    bio?: string;
    description?: string;
    followers?: { totalCount: number };
    updatedAt: string;
    nameWithOwner: string;
    owner: { login: string };
    stargazerCount: number;
    primaryLanguage?: { name: string };
    repositoryTopics?: { nodes: { topic: { name: string } }[] };
    pushedAt: string;
    latestRelease?: { tagName: string };
    isArchived: boolean;
    isDisabled: boolean;
    isLocked: boolean;
    isPrivate: boolean;
    isEmpty: boolean;
    isFork: boolean;
    isMirror: boolean;
    defaultBranchRef?: { name: string };
    languages?: {
        edges: {
            size: number;
            node: { name: string };
        }[];
    };
}

export interface ProfileRepo {
    id: string;
    name: string;
    owner: string;
    description: string | null;
    stars: number;
    forks: number;
    language: string | null;
    languageColor: string | null;
    url: string;
    isArchived: boolean;
    isFork: boolean;
    isMirror: boolean;
}

export interface SocialAccount {
    provider: string;
    url: string;
}

export interface ProfileDetails {
    avatarUrl: string;
    name: string | null;
    login: string;
    bio: string | null;
    company: string | null;
    location: string | null;
    email: string | null;
    websiteUrl: string | null;
    twitterUsername: string | null;
    pronouns: string | null;
    status: { emojiHTML: string | null, message: string | null } | null;
    socialAccounts: SocialAccount[];
    followersCount: number;
    followingCount: number;
    createdAt: string;
    repositoriesCount: number;
    pinnedRepos: ProfileRepo[];
    popularRepos: ProfileRepo[];
    type: 'User' | 'Organization';
}

export interface SyncResult {
    updated: number
    deleted: number
    renamed: number
    rateLimitRemaining: number | null
}

export interface TokenValidationResult {
    status: 'valid' | 'invalid' | 'limited';
    expiry: string | null;
}
