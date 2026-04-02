import type { StateCreator } from 'zustand'
import type { GitShelfStore, AuthSlice } from '../types'
import { encryptTokenAsync, decryptTokenAsync, isAccountBound } from '@/lib/crypto'

const getInitialToken = () => localStorage.getItem('_gs_pk_v1')
const getInitialExpiry = () => localStorage.getItem('_gs_pk_exp')
const getInitialId = () => {
    const id = localStorage.getItem('_gs_pk_id')
    return id ? parseInt(id, 10) : null
}
const getInitialGistId = () => localStorage.getItem('_gs_gist_id')

const getInitialProfile = () => {
    const profile = localStorage.getItem('_gs_up_v1')
    try {
        return profile ? JSON.parse(profile) : null
    } catch {
        return null
    }
}

export const createAuthSlice: StateCreator<GitShelfStore, [], [], AuthSlice> = (set, get) => ({
    gistSyncStatus: 'idle',
    lastGistSyncTime: null,
    gistSyncError: null,
    githubToken: getInitialToken(),
    githubTokenExpiry: getInitialExpiry(),
    userProfile: getInitialProfile(), 
    gistId: getInitialGistId(),

    setGistSyncStatus: (status) => set({ gistSyncStatus: status }),
    setLastGistSyncTime: (time) => set({ lastGistSyncTime: time }),
    setGistSyncError: (error) => set({ gistSyncError: error }),
    setGithubToken: async (token) => {
        if (token) {
            try {
                // Use profile ID or stored ID as salt if available for V3 encryption
                const currentId = get().userProfile?.id || getInitialId()
                const idSalt = currentId?.toString()
                
                const encrypted = await encryptTokenAsync(token, idSalt)
                localStorage.setItem('_gs_pk_v1', encrypted)
                set({ githubToken: encrypted })
            } catch (err) {
                console.error('Failed to save encrypted token:', err)
            }
        } else {
            localStorage.removeItem('_gs_pk_v1')
            localStorage.removeItem('_gs_pk_id')
            set({ githubToken: null })
        }
    },
    setGithubTokenExpiry: (expiry) => {
        if (expiry) {
            localStorage.setItem('_gs_pk_exp', expiry)
            set({ githubTokenExpiry: expiry })
        } else {
            localStorage.removeItem('_gs_pk_exp')
            set({ githubTokenExpiry: null })
        }
    },
    setUserProfile: async (profile) => {
        set({ userProfile: profile })
        if (profile) {
            localStorage.setItem('_gs_up_v1', JSON.stringify(profile))
            if (profile.id) {
                localStorage.setItem('_gs_pk_id', profile.id.toString())
            }
        } else {
            localStorage.removeItem('_gs_up_v1')
            localStorage.removeItem('_gs_pk_id')
        }
        
        // Automatic Migration: If we have a token but it's not yet account-bound (V3),
        // and we now have a profile (ID), re-encrypt it to bind it to this account.
        const state = get()
        if (profile?.id && state.githubToken && !isAccountBound(state.githubToken)) {
            try {
                // For V2/V1, decryptTokenAsync doesn't need salt
                const decrypted = await decryptTokenAsync(state.githubToken)
                if (decrypted) {
                    await state.setGithubToken(decrypted)
                    console.log('Token successfully migrated to account-bound encryption (V3)')
                }
            } catch (err) {
                console.error('Failed to migrate token to V3:', err)
            }
        }
    },
    setGistId: (id) => {
        set({ gistId: id })
        if (id) {
            localStorage.setItem('_gs_gist_id', id)
        } else {
            localStorage.removeItem('_gs_gist_id')
        }
    },
    getDecryptedToken: async () => {
        const state = get()
        if (!state.githubToken) return ''
        const idSalt = state.userProfile?.id?.toString() || getInitialId()?.toString()
        return decryptTokenAsync(state.githubToken, idSalt)
    }
})
