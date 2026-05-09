import { createContext, useContext, type ReactNode } from 'react'

export type ScopeId = 'v1' | 'v2'

export type ScopePaths = {
  /** Identifier for the current scope; lets components branch on v2-only behavior. */
  scopeId: ScopeId
  /** Events listing / "home" page for this scope. */
  events: string
  /** Create-event form. */
  eventsCreate: string
  /** Edit-event form template; receives an event id. */
  eventsEdit: (id: string) => string
  /** Experiences listing for this scope. */
  experiences: string
}

export const V1_SCOPE_PATHS: ScopePaths = {
  scopeId: 'v1',
  events: '/',
  eventsCreate: '/mock-events/new',
  eventsEdit: (id) => `/mock-events/${id}/edit`,
  experiences: '/mock-content',
}

export const V2_SCOPE_PATHS: ScopePaths = {
  scopeId: 'v2',
  events: '/v2',
  eventsCreate: '/v2/events/new',
  eventsEdit: (id) => `/v2/events/${id}/edit`,
  experiences: '/v2/content',
}

const ScopeContext = createContext<ScopePaths>(V1_SCOPE_PATHS)

export function ScopePathsProvider({
  value,
  children,
}: {
  value: ScopePaths
  children: ReactNode
}) {
  return <ScopeContext.Provider value={value}>{children}</ScopeContext.Provider>
}

export function useScopePaths(): ScopePaths {
  return useContext(ScopeContext)
}
