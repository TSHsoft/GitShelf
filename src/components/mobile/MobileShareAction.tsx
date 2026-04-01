import { useEffect, useState } from 'react';
import { useStore } from '@/store/useStore';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export function MobileShareAction() {
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'offline'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const addPendingRepo = useStore(state => state.addPendingRepo);

  useEffect(() => {
    const processShare = async () => {
      // 1. Check offline
      if (!navigator.onLine) {
         setStatus('offline');
         setErrorMsg('You are offline. GitShelf PWA requires network access to sync to your Inbox.');
         return;
      }

      // 2. Extract URL
      const params = new URLSearchParams(window.location.search);
      const sharedUrl = params.get('url') || params.get('text') || '';

      // Extract github url if it was embedded in text
      const ghMatch = sharedUrl.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)(?:\/([^/\s]+))?/i);
      
      if (!ghMatch) {
         setStatus('error');
         setErrorMsg('Sorry, only GitHub Repositories or Profiles can be saved.');
         return;
      }

      const cleanUrl = `https://github.com/${ghMatch[1]}${ghMatch[2] ? `/${ghMatch[2]}` : ''}`;

      // 3. Save
      setTimeout(async () => {
          // Put in local queue for fallback / offline
          addPendingRepo(cleanUrl);
          
          // Push directly to Gist wrapper immediately to prevent race conditions 
          // with desktop syncing the main data JSON
          try {
             if (navigator.onLine) {
                 const token = await useStore.getState().getDecryptedToken();
                 if (token) {
                     const { getGistFile, updateGistFile } = await import('@/lib/github/gists');
                     const remoteStr = await getGistFile(token, 'gitshelf_pending.json');
                     const remoteRepos = remoteStr ? JSON.parse(remoteStr) : [];
                     if (!remoteRepos.includes(cleanUrl)) {
                         remoteRepos.push(cleanUrl);
                         await updateGistFile(token, 'gitshelf_pending.json', JSON.stringify(remoteRepos));
                     }
                 }
             }
          } catch (e) {
             console.error('Failed to quick-sync pending repo to wrapper', e);
          }
          
          setStatus('success');
      }, 500); // Artificial slight delay for UI feedback
    };

    processShare();
  }, [addPendingRepo]);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[var(--color-bg)] p-6 text-center">
        {status === 'loading' && (
            <div className="flex flex-col items-center gap-4 animate-in fade-in duration-300">
                <Loader2 className="w-12 h-12 text-blue-500 animate-spin" />
                <h2 className="text-xl font-semibold text-[var(--color-text)] tracking-tight">Saving to Inbox...</h2>
            </div>
        )}
        {status === 'success' && (
            <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-500" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--color-text)] tracking-tight">Saved to Inbox</h2>
                <p className="text-[var(--color-text-muted)] text-sm max-w-[250px] leading-relaxed">
                    This repository has been synced. You can now close this page and organize it later on your desktop.
                </p>
                <div className="flex gap-3 mt-4">
                    <button 
                        onClick={() => window.close()}
                        className="px-6 py-2.5 bg-[var(--color-surface-2)] hover:bg-[var(--color-surface-3)] text-[var(--color-text)] border border-[var(--color-border)] rounded-full text-sm font-medium transition-colors"
                    >
                        Close App
                    </button>
                    <button 
                        onClick={() => window.location.href = '/'}
                        className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-colors"
                    >
                        Go Home
                    </button>
                </div>
            </div>
        )}
        {(status === 'error' || status === 'offline') && (
            <div className="flex flex-col items-center gap-4 animate-in slide-in-from-bottom-4 fade-in duration-300">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-red-500" />
                </div>
                <h2 className="text-xl font-semibold text-[var(--color-text)] tracking-tight">
                    {status === 'offline' ? 'Offline Mode' : 'Invalid Link'}
                </h2>
                <p className="text-[var(--color-text-muted)] text-sm max-w-[250px] leading-relaxed">
                    {errorMsg}
                </p>
                <button 
                  onClick={() => window.location.href = '/'}
                  className="mt-4 px-8 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-full text-sm font-medium transition-colors shadow-sm"
                >
                    Dismiss
                </button>
            </div>
        )}
    </div>
  );
}
