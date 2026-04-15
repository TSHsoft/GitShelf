import { openDB, type DBSchema } from 'idb'
import type { GitShelfData } from '@/types'

interface GitShelfDB extends DBSchema {
    data: {
        key: string
        value: GitShelfData
    }
    meta: {
        key: string
        value: string | number
    }
}

const DB_NAME = 'gitshelf-db'
const DB_VERSION = 2
const DATA_STORE = 'data'
const META_STORE = 'meta'
const DATA_KEY = 'main'
const TRASH_KEY = 'trash'

async function getDB() {
    return openDB<GitShelfDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(DATA_STORE)) {
                db.createObjectStore(DATA_STORE)
            }
            if (!db.objectStoreNames.contains(META_STORE)) {
                db.createObjectStore(META_STORE)
            }
        },
    })
}

export async function saveLocalData(data: GitShelfData) {
    const db = await getDB()
    
    // 1. Decouple trash for isolation and performance
    const { trash, ...mainData } = data
    
    // 2. Safety check: Protect main active database
    const existing = await db.get(DATA_STORE, DATA_KEY)
    if (existing && existing.last_modified > data.last_modified) {
        console.warn('[DB] Protection: Refusing to overwrite newer data in database')
        throw new Error('CONSISTENCY_ERROR: Database has newer data')
    }
    
    // 3. Save separately
    await Promise.all([
        db.put(DATA_STORE, mainData as GitShelfData, DATA_KEY),
        db.put(DATA_STORE, { trash } as unknown as GitShelfData, TRASH_KEY)
    ])
}

export async function loadLocalData(): Promise<GitShelfData | undefined> {
    const db = await getDB()
    const [main, trashWrapper] = await Promise.all([
        db.get(DATA_STORE, DATA_KEY),
        db.get(DATA_STORE, TRASH_KEY)
    ])
    
    if (!main) return undefined
    
    // Safety Force: Even if old data structure exists in 'main', we strip it
    const { trash: _oldTrash, ...cleanMain } = main as GitShelfData

    // Merge back for the App's memory state
    return {
        ...cleanMain,
        trash: (trashWrapper as Partial<GitShelfData>)?.trash || {}
    }
}

export async function clearLocalData() {
    const db = await getDB()
    await db.delete(DATA_STORE, DATA_KEY)
}

export async function saveMeta(key: string, value: string | number) {
    const db = await getDB()
    await db.put(META_STORE, value, key)
}

export async function loadMeta(key: string): Promise<string | number | undefined> {
    const db = await getDB()
    return db.get(META_STORE, key)
}
