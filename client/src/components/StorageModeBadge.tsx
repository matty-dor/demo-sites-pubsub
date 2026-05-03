import { backendStorageEnabled } from '../config/storageMode'

export function StorageModeBadge() {
  const api = backendStorageEnabled()
  return (
    <span className="storage-badge" title="Toggle with VITE_USE_BACKEND in .env">
      {api ? 'Storage: API' : 'Storage: local (Redux)'}
    </span>
  )
}
