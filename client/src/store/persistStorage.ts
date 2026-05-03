/**
 * redux-persist's default `import storage from 'redux-persist/lib/storage'` often breaks under
 * Vite ESM (CJS default export → `storage.getItem` undefined). This wraps `localStorage` with
 * the async shape redux-persist expects.
 */
function noopStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  const memory = new Map<string, string>()
  return {
    getItem: (key: string): string | null =>
      memory.has(key) ? memory.get(key)! : null,
    setItem: (key: string, value: string) => {
      memory.set(key, value)
    },
    removeItem: (key: string) => {
      memory.delete(key)
    },
  }
}

export const persistStorage = {
  getItem(key: string): Promise<string | null> {
    const engine =
      typeof window !== 'undefined' ? window.localStorage : noopStorage()
    return Promise.resolve(engine.getItem(key))
  },
  setItem(key: string, value: string): Promise<void> {
    const engine =
      typeof window !== 'undefined' ? window.localStorage : noopStorage()
    engine.setItem(key, value)
    return Promise.resolve()
  },
  removeItem(key: string): Promise<void> {
    const engine =
      typeof window !== 'undefined' ? window.localStorage : noopStorage()
    engine.removeItem(key)
    return Promise.resolve()
  },
}
