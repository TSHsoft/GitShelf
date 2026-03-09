import { create } from 'zustand'
import type { GitShelfStore } from './types'
import { createDataSlice } from './slices/createDataSlice'
import { createUISlice } from './slices/createUISlice'
import { createSyncSlice } from './slices/createSyncSlice'
import { createAuthSlice } from './slices/createAuthSlice'

export const useStore = create<GitShelfStore>((...a) => ({
    ...createDataSlice(...a),
    ...createUISlice(...a),
    ...createSyncSlice(...a),
    ...createAuthSlice(...a),
}))
