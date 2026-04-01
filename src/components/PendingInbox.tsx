import { useState } from 'react';
import { useStore } from '@/store/useStore';
import { Inbox, X, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { ConfirmDialog } from './ConfirmDialog';

const EMPTY_REPOS: string[] = [];

export function PendingInbox() {
    const pendingRepos = useStore(state => state.data.pending_repos ?? EMPTY_REPOS);
    const removePendingRepo = useStore(state => state.removePendingRepo);
    const [isProcessing, setIsProcessing] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
    const [isDiscarding, setIsDiscarding] = useState(false);
    
    if (pendingRepos.length === 0) return null;

    const handleProcessAll = async () => {
        setIsProcessing(true);
        setErrorMsg('');
        let processedCount = 0;
        try {
            // Import dynamically to avoid top-level bundle weight if not used
            const { fetchRepositoryGraphQL } = await import('@/lib/github');
            const token = await useStore.getState().getDecryptedToken();
            const addRepository = useStore.getState().addRepository;

            for (const url of pendingRepos) {
                try {
                    // Extract github path (e.g., owner/repo)
                    const match = url.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+\/[^/\s]+)/i);
                    const path = match ? match[1] : url.replace('https://github.com/', '');
                    
                    const repo = await fetchRepositoryGraphQL(path, token);
                    addRepository(repo); // This also auto-removes it from pending_repos
                    processedCount++;
                } catch (err) {
                    console.error(`Failed to process pending repo ${url}:`, err);
                    // Leave it in pending if it totally fails
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
            
            // Sync the remaining items (if any) back to the remote queue
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
            // First clear remote
            const token = await useStore.getState().getDecryptedToken();
            if (token) {
                const { updateGistFile } = await import('@/lib/github/gists');
                await updateGistFile(token, 'gitshelf_pending.json', '[]');
            }
            // Then clear local
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
        <div className="mx-4 mt-4 mb-2 overflow-hidden rounded-xl border border-blue-500/30 bg-blue-500/5 shadow-sm text-[var(--color-text)] relative p-4 pl-20">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-blue-500/10 p-2">
                <Inbox className="h-5 w-5 text-blue-500" />
            </div>
            
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h3 className="font-semibold text-sm">Mobile Inbox: {pendingRepos.length} item(s) pending</h3>
                    <p className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        You shared links to GitShelf from your mobile device. Would you like to fetch and save them now?
                    </p>
                    {errorMsg && (
                        <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" /> {errorMsg}
                        </p>
                    )}
                </div>
                
                <div className="flex items-center gap-2">
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
