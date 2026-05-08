export interface Cache {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
}

interface IndexedDBCacheEntry<T> {
  value: T
  expiresAt: number
}

export class IndexedDBCache implements Cache {
  private db: IDBDatabase | null = null

  constructor(
    private readonly dbName: string,
    private readonly ttlMs: number
  ) {}

  private openDB(): Promise<IDBDatabase> {
    if (this.db) return Promise.resolve(this.db)
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, 1)
      req.onupgradeneeded = () => req.result.createObjectStore("cache")
      req.onsuccess = () => {
        this.db = req.result
        resolve(this.db)
      }
      req.onerror = () => reject(req.error)
    })
  }

  async get<T>(key: string): Promise<T | undefined> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const req = db.transaction("cache", "readonly").objectStore("cache").get(key)
      req.onsuccess = () => {
        const entry = req.result as IndexedDBCacheEntry<T> | undefined
        if (!entry || Date.now() > entry.expiresAt) {
          resolve(undefined)
        } else {
          resolve(entry.value)
        }
      }
      req.onerror = () => reject(req.error)
    })
  }

  async set<T>(key: string, value: T): Promise<void> {
    const db = await this.openDB()
    return new Promise((resolve, reject) => {
      const entry: IndexedDBCacheEntry<T> = { value, expiresAt: Date.now() + this.ttlMs }
      const req = db.transaction("cache", "readwrite").objectStore("cache").put(entry, key)
      req.onsuccess = () => resolve()
      req.onerror = () => reject(req.error)
    })
  }
}

export const indexedDBCache = new IndexedDBCache("cache", 24 * 60 * 60 * 1000) // 24 hours

export const sessionStorageCache: Cache = {
  async get<T>(key: string): Promise<T | undefined> {
    const item = sessionStorage.getItem(key)
    return item ? JSON.parse(item) : undefined
  },
  async set<T>(key: string, value: T) {
    try {
      sessionStorage.setItem(key, JSON.stringify(value))
    } catch (e: any) {
      if (e.name === "QuotaExceededError") {
        console.warn("Session storage quota exceeded, clearing cache")
        sessionStorage.clear()
      } else {
        throw e
      }
    }
  },
}
