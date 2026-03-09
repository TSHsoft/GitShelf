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
    await db.put(DATA_STORE, data, DATA_KEY)
}

export async function loadLocalData(): Promise<GitShelfData | undefined> {
    const db = await getDB()
    return db.get(DATA_STORE, DATA_KEY)
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
