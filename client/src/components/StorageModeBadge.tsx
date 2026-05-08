import { backendStorageEnabled } from '../config/storageMode'

export function StorageModeBadge() {
  const api = backendStorageEnabled()
  return (
    <span
      className="storage-badge"
      title="Events: VITE_USE_BACKEND. Personalization HTTP: VITE_USE_BACKEND or VITE_USE_VERCEL_API."
    >
      {api ? 'Storage: API' : 'Storage: local (Redux)'}
    </span>
  )
}
