import { useMemo, useState } from 'react';
import { useStore } from '@/store/useStore';
import { RepoCard } from '../RepoCard';
import { Book, Search, Inbox } from 'lucide-react';
import { useShallow } from 'zustand/react/shallow';

export function MobileReadonlyViewer() {
    const { repositories, userProfile, pendingRepos } = useStore(useShallow(state => ({
        repositories: state.data.repositories,
        userProfile: state.userProfile,
        pendingRepos: state.data.pending_repos || []
    })));
    
    const [search, setSearch] = useState('');

    const repos = useMemo(() => {
        let list = Object.values(repositories);
        if (search.trim()) {
            const q = search.trim().toLowerCase();
            list = list.filter(r => r.name.toLowerCase().includes(q) || r.owner.toLowerCase().includes(q));
        }
        return list.sort((a, b) => b.added_at - a.added_at); // Newest first
    }, [repositories, search]);

    return (
        <div className="flex flex-col min-h-screen bg-[var(--color-bg)] w-full overflow-hidden safe-area-pt">
            <header className="flex-none px-4 pb-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]/95 backdrop-blur-md sticky top-0 z-10 pt-4 shadow-sm">
                <div className="flex items-center justify-between mb-4 mt-2">
                    <div className="flex items-center gap-2">
                        <div className="bg-blue-500/10 p-1.5 rounded-lg border border-blue-500/20">
                            <Book className="w-5 h-5 text-blue-500" />
                        </div>
                        <h1 className="text-xl font-bold text-[var(--color-text)] tracking-tight">GitShelf</h1>
                    </div>
                    {userProfile && (
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--color-border)] flex items-center justify-center bg-[var(--color-surface-2)]">
                            <img src={userProfile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                    )}
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Search className="h-4 w-4 text-[var(--color-text-muted)]" />
                    </div>
                    <input 
                        type="text" 
                        value={search}
                        placeholder="Search your shelf..."
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full h-[42px] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full pl-10 pr-4 text-[15px] text-[var(--color-text)] outline-none focus:border-blue-500 transition-colors placeholder:text-[var(--color-text-muted)]"
                    />
                </div>
            </header>
            
            <main className="flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 space-y-3 safe-area-pb">
                {pendingRepos.length > 0 && (
                    <div className="flex items-center gap-3 p-3.5 mb-1 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 shadow-sm animate-in slide-in-from-top-2 fade-in duration-300">
                        <Inbox className="w-5 h-5 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <p className="text-[13px] font-semibold truncate leading-tight">
                                {pendingRepos.length} item{pendingRepos.length > 1 ? 's' : ''} waiting in Inbox
                            </p>
                            <p className="text-[11px] opacity-80 leading-tight mt-0.5 max-w-full truncate">
                                Open GitShelf on PC to save {pendingRepos.length > 1 ? 'them' : 'it'}
                            </p>
                        </div>
                    </div>
                )}
                {repos.length > 0 ? (
                    repos.map(repo => (
                        <RepoCard 
                            key={repo.id} 
                            repo={repo} 
                            isActive={false} 
                            onClick={() => window.open(repo.url, '_blank')}
                            readonly={true}
                        />
                    ))
                ) : (
                    <div className="flex flex-col items-center justify-center py-24 text-center px-4 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-16 h-16 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border)] flex items-center justify-center mb-4 shadow-sm">
                            <Book className="w-8 h-8 text-[var(--color-text-muted)]" />
                        </div>
                        <h3 className="text-lg text-[var(--color-text)] font-semibold mb-2 tracking-tight">No repositories found</h3>
                        <p className="text-sm text-[var(--color-text-muted)] max-w-[240px] leading-relaxed">
                            {search ? 'Try a different search term.' : 'You have not added any repositories yet.'}
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
}
