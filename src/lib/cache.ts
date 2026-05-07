export interface Cache {
  get<T>(key: string): Promise<T | undefined>
  set<T>(key: string, value: T): Promise<void>
}

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
