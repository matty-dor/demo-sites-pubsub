import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/http'
import { backendStorageEnabled } from '../config/storageMode'
import { useAppSelector } from '../store/hooks'

type ApiMockEventRow = { id: string; name: string }

/** Set of taken event names (trimmed, case-insensitive), excluding the given id when editing. */
export function useExistingEventNames(excludeId?: string): Set<string> {
  const backend = backendStorageEnabled()
  const reduxEvents = useAppSelector((s) => s.mockEvents.events)
  const { data } = useQuery({
    queryKey: ['mock-events'],
    queryFn: () => api<{ events: ApiMockEventRow[] }>('/api/mock-events'),
    enabled: backend,
  })

  return useMemo(() => {
    const events = backend ? (data?.events ?? []) : reduxEvents
    const set = new Set<string>()
    for (const e of events) {
      if (excludeId && e.id === excludeId) continue
      const key = (e.name ?? '').trim().toLowerCase()
      if (key) set.add(key)
    }
    return set
  }, [backend, data?.events, reduxEvents, excludeId])
}

/** Returns true when `name` already belongs to another event. */
export function isDuplicateEventName(
  name: string,
  taken: Set<string>,
): boolean {
  const key = name.trim().toLowerCase()
  return key.length > 0 && taken.has(key)
}
