import type { StateCreator } from 'zustand'
import type { GitShelfStore, AuthSlice } from '../types'
import { encryptTokenAsync } from '@/lib/crypto'

const getInitialToken = () => localStorage.getItem('_gs_pk_v1')
const getInitialExpiry = () => localStorage.getItem('_gs_pk_exp')

export const createAuthSlice: StateCreator<GitShelfStore, [], [], AuthSlice> = (set) => ({
    gistSyncStatus: 'idle',
    lastGistSyncTime: null,
    gistSyncError: null,
    githubToken: getInitialToken(),
    githubTokenExpiry: getInitialExpiry(),
    userProfile: null,

    setGistSyncStatus: (status) => set({ gistSyncStatus: status }),
    setLastGistSyncTime: (time) => set({ lastGistSyncTime: time }),
    setGistSyncError: (error) => set({ gistSyncError: error }),
    setGithubToken: async (token) => {
        if (token) {
            try {
                const encrypted = await encryptTokenAsync(token)
                localStorage.setItem('_gs_pk_v1', encrypted)
                set({ githubToken: encrypted })
            } catch (err) {
                console.error('Failed to save encrypted token:', err)
            }
        } else {
            localStorage.removeItem('_gs_pk_v1')
            set({ githubToken: null })
        }
    },
    setGithubTokenExpiry: (expiry) => {
        if (expiry) {
            localStorage.setItem('_gs_pk_exp', expiry)
            set({ githubTokenExpiry: expiry })
        } else {
            localStorage.removeItem('_gs_pk_exp')
            localStorage.removeItem('_gs_pk_exp')
            set({ githubTokenExpiry: null })
        }
    },
    setUserProfile: (profile) => set({ userProfile: profile })
})
