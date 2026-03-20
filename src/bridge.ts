// src/bridge.ts
/**
 * GitShelf Bridge - Vite Entry Point
 * This script runs in the ext-bridge.html iframe.
 * It shares the EXACT same fetch and mapping logic as the main App.
 */
import { fetchRepositoryGraphQL } from '@/lib/github/graphql';
import { saveLocalData, loadLocalData } from '@/lib/db';
import { decryptTokenAsync } from '@/lib/crypto';
import type { Repository } from '@/types';

const ALLOWED_EXTENSION_IDS = [
    import.meta.env.VITE_EXTENSION_ID,
    'mboiaodpnlbejmefakbfpmnioifgeifp', // Chrome Dev
    'khmloiclkglabmjpjofpckpkhclpkaea'  // Edge Dev
];

console.log('[Bridge] Bridge initialized from Vite source');

window.addEventListener('message', async (event) => {
    const origin = event.origin;
    const isChromeExt = origin.startsWith('chrome-extension://');
    const isEdgeExt = origin.startsWith('extension://');
    
    // Security: Origin and Extension ID Check
    const isAuthorized = ALLOWED_EXTENSION_IDS.some(id => 
        !id || id === '%VITE_EXTENSION_ID%' || 
        origin === `chrome-extension://${id}` || 
        origin === `extension://${id}`
    ) || (isChromeExt || isEdgeExt);
    
    if (!isAuthorized && origin !== window.location.origin) {
        console.warn('[Bridge] Unauthorized message rejected from origin:', origin);
        return;
    }

    const { type, payload } = event.data;

    try {
        if (type === 'EXT_SAVE_REPO') {
            await handleDirectSave(payload);
            window.parent.postMessage({ type: 'EXT_SAVE_SUCCESS' }, '*');
        } else if (type === 'EXT_SAVE_PATH') {
            await handlePathSave(payload.path);
            window.parent.postMessage({ type: 'EXT_SAVE_SUCCESS' }, '*');
        } else if (type === 'EXT_GET_IDS') {
            const ids = await getSavedRepoIds();
            window.parent.postMessage({ type: 'EXT_IDS_RESULT', ids }, '*');
        } else if (type === 'EXT_CHECK_REPO') {
            const exists = await checkRepoExists(payload);
            window.parent.postMessage({ type: 'EXT_CHECK_RESULT', exists }, '*');
        } else if (type === 'EXT_GET_AUTH') {
            const auth = getAppAuth();
            window.parent.postMessage({ type: 'EXT_AUTH_RESULT', auth }, '*');
        }
    } catch (err: unknown) {
        console.error(`[Bridge] Error for action ${type}:`, err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        window.parent.postMessage({ type: 'EXT_SAVE_FAILURE', error: errorMessage }, '*');
    }
});

async function handleDirectSave(repo: Repository) {
    const data = await loadLocalData();
    if (!data) throw new Error('Local data not found. Please open App.');
    
    data.repositories[repo.id] = repo;
    data.last_modified = Date.now();
    
    await saveLocalData(data);
    notifyApp();
}

async function handlePathSave(path: string) {
    // 1. Get encrypted token from App's localStorage (on the same origin)
    const auth = getAppAuth();
    if (!auth || !auth.githubToken) throw new Error('Not logged in (App)');
    
    // 2. Decrypt on the fly using profileId as salt (V3)
    const idSalt = auth.profileId?.toString();
    const decryptedToken = await decryptTokenAsync(auth.githubToken, idSalt);
    
    if (!decryptedToken) {
        throw new Error('Failed to decrypt GitHub token. Please re-login in App.');
    }
    
    // 3. Fetch using SHARED logic (complete data)
    console.log('[Bridge] Fetching repo with decrypted token...');
    const repo = await fetchRepositoryGraphQL(path, decryptedToken);
    
    // 4. Save using SHARED logic (Safe Put)
    const data = await loadLocalData();
    if (!data) throw new Error('Local data not found. Please open App.');
    
    data.repositories[repo.id] = repo;
    data.last_modified = Date.now();
    
    await saveLocalData(data);
    notifyApp();
}

async function getSavedRepoIds(): Promise<string[]> {
    const data = await loadLocalData();
    if (!data || !data.repositories) return [];
    return Object.keys(data.repositories);
}

async function checkRepoExists(id: string): Promise<boolean> {
    const data = await loadLocalData();
    if (!data || !data.repositories) return false;
    // Composite ID check or Node ID check
    return !!data.repositories[id] || Object.values(data.repositories).some(r => r.id === id || r.node_id === id);
}

function notifyApp() {
    const bc = new BroadcastChannel('gitshelf-sync');
    bc.postMessage({ type: 'DATA_UPDATED' });
    bc.close();
}

/**
 * Checks the App's localStorage for the current authentication state.
 * Returns null if the user is logged out in the App.
 */
function getAppAuth() {
    const token = localStorage.getItem('_gs_pk_v1');
    const id = localStorage.getItem('_gs_pk_id');
    const profileJson = localStorage.getItem('_gs_up_v1');
    
    if (!token) return null;

    let userProfile = null;
    try {
        userProfile = profileJson ? JSON.parse(profileJson) : null;
    } catch (_e) {
        console.warn('[Bridge] Failed to parse cached profile');
    }
    
    return {
        githubToken: token,
        profileId: id ? parseInt(id, 10) : null,
        userProfile
    };
}

// --- Handshake ---
window.parent.postMessage({ type: 'BRIDGE_READY' }, '*');
console.log('[Bridge] Handshake sent: BRIDGE_READY');
