import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Inbox, X, ArrowRight, Loader2, AlertCircle, ChevronDown, ChevronRight, ExternalLink } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

const EMPTY_REPOS: string[] = [];

/** Extract owner/repo path from a GitHub URL for lookup */
function extractRepoPath(url: string): string {
    const clean = url.split(/[?#]/)[0];
    const match = clean.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+\/[^/\s]+)/i);
    return match ? match[1].toLowerCase() : clean.replace(/^https?:\/\/github\.com\//i, '').toLowerCase();
}

export function PendingInbox() {
    const pendingRepos = useStore(state => state.data.pending_repos ?? EMPTY_REPOS);
    const repositories = useStore(state => state.data.repositories);
    const removePendingRepo = useStore(state => state.removePendingRepo);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [isDiscarding, setIsDiscarding] = useState(false);
    const [showDetails, setShowDetails] = useState(false);

    if (pendingRepos.length === 0) return null;

    /** Determine if a pending URL already exists in the local repo database */
    const getItemStatus = (url: string): 'exists' | 'new' => {
        const path = extractRepoPath(url);
        const canonicalUrl = url.toLowerCase().split(/[?#]/)[0];
        const existsByPath = !!repositories[path];
        const existsByUrl = Object.values(repositories).some(r =>
            r.url.toLowerCase().split(/[?#]/)[0] === canonicalUrl
        );
        return (existsByPath || existsByUrl) ? 'exists' : 'new';
    };

    const handleProcessAll = async () => {
        setIsProcessing(true);
        setErrorMsg('');
        let processedCount = 0;
        try {
            const { fetchRepositoryGraphQL } = await import('@/lib/github');
            const token = await useStore.getState().getDecryptedToken();
            const addRepository = useStore.getState().addRepository;

            for (const url of pendingRepos) {
                try {
                    const cleanUrl = url.split(/[?#]/)[0];
                    const match = cleanUrl.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+\/[^/\s]+)/i);
                    const path = match ? match[1] : cleanUrl.replace('https://github.com/', '');

                    const repo = await fetchRepositoryGraphQL(path, token);
                    addRepository(repo);
                    processedCount++;
                } catch (err) {
                    console.error(`Failed to process pending repo ${url}:`, err);
                }
            }
        } catch (error) {
            console.error(error);
            setErrorMsg('Authentication or Network error while fetching Inbox.');
        } finally {
            setIsProcessing(false);
            if (processedCount < pendingRepos.length && !errorMsg) {
                setErrorMsg(`Only ${processedCount} of ${pendingRepos.length} items could be processed.`);
            }

            try {
                const token = await useStore.getState().getDecryptedToken();
                if (token) {
                    const { updateGistFile } = await import('@/lib/github/gists');
                    const remainingRepos = useStore.getState().data.pending_repos || [];
                    await updateGistFile(token, 'gitshelf_pending.json', JSON.stringify(remainingRepos));
                }
            } catch (err) {
                console.error('Failed to sync cleared status to remote wrapper', err);
            }
        }
    };

    const handleDiscardAll = async () => {
        setIsDiscarding(true);
        try {
            const token = await useStore.getState().getDecryptedToken();
            if (token) {
                const { updateGistFile } = await import('@/lib/github/gists');
                await updateGistFile(token, 'gitshelf_pending.json', '[]');
            }
            pendingRepos.forEach(url => removePendingRepo(url));
            setShowDiscardConfirm(false);
        } catch (err) {
            console.error('Failed to discard remote inbox', err);
            setErrorMsg('Failed to clear remote inbox.');
        } finally {
            setIsDiscarding(false);
        }
    };

    return (
        <div className="mx-4 mt-4 mb-2 overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/5 shadow-sm text-[var(--color-text)]">
            {/* Header row */}
            <div className="flex items-center gap-3 px-4 py-3 pl-4">
                <div className="rounded-full bg-blue-500/10 p-2 shrink-0">
                    <Inbox className="h-4 w-4 text-blue-500" />
                </div>

                <div className="flex-1 min-w-0">
                    {/* Clickable title */}
                    <button
                        onClick={() => setShowDetails(v => !v)}
                        className="flex items-center gap-1.5 group text-left"
                    >
                        {showDetails
                            ? <ChevronDown className="h-3.5 w-3.5 text-blue-400 shrink-0 transition-transform" />
                            : <ChevronRight className="h-3.5 w-3.5 text-blue-400 shrink-0 transition-transform" />
                        }
                        <h3 className="font-semibold text-sm group-hover:text-blue-400 transition-colors cursor-pointer">
                            Mobile Inbox: {pendingRepos.length} item(s) pending
                        </h3>
                    </button>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        You shared links to GitShelf from your mobile device. Would you like to fetch and save them now?
                    </p>
                    {errorMsg && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {errorMsg}
                        </p>
                    )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={handleProcessAll}
                        disabled={isProcessing}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                        {isProcessing ? (
                            <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                        ) : (
                            <>Process All <ArrowRight className="w-4 h-4" /></>
                        )}
                    </button>
                    {!isProcessing && (
                        <button
                            onClick={() => setShowDiscardConfirm(true)}
                            className="p-1.5 text-[var(--color-text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-md transition-colors"
                            title="Dismiss Inbox"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Collapsible detail panel */}
            {showDetails && (
                <div className="border-t border-blue-500/20 bg-[var(--color-surface)] mx-0">
                    <div className="px-4 py-2">
                        <div className="grid grid-cols-[1fr_auto] gap-x-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)] pb-1 border-b border-[var(--color-border)]">
                            <span>URL</span>
                            <span>Status</span>
                        </div>
                        <div className="divide-y divide-[var(--color-border)] max-h-52 overflow-y-auto">
                            {pendingRepos.map(url => {
                                const status = getItemStatus(url);
                                return (
                                    <div key={url} className="grid grid-cols-[1fr_auto] gap-x-3 items-center py-1.5">
                                        <a
                                            href={url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-[var(--color-text-muted)] hover:text-blue-400 transition-colors truncate min-w-0"
                                            title={url}
                                        >
                                            <ExternalLink className="h-3 w-3 shrink-0 opacity-60" />
                                            <span className="truncate">{url}</span>
                                        </a>
                                        <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                                            status === 'exists'
                                                ? 'bg-green-500/15 text-green-500'
                                                : 'bg-blue-500/15 text-blue-400'
                                        }`}>
                                            {status}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            <ConfirmDialog
                isOpen={showDiscardConfirm}
                onClose={() => setShowDiscardConfirm(false)}
                title="Discard Pending Items"
                description="Are you sure you want to discard all pending links from your mobile inbox? This cannot be undone."
                variant="danger"
                confirmLabel={isDiscarding ? "Discarding..." : "Discard All"}
                onConfirm={handleDiscardAll}
            />
        </div>
    );
}
