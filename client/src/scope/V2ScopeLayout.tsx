import { useState } from 'react'
import { Provider } from 'react-redux'
import { PersistGate } from 'redux-persist/integration/react'
import { Outlet } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { v2Store, v2Persistor } from '../store/v2Store'
import { ScopePathsProvider, V2_SCOPE_PATHS } from './ScopeContext'

/**
 * Wraps the `/v2/*` routes in their own Redux store, persistor, React Query client, and scope
 * paths so that interactions on Events v2 / Experiences v2 stay isolated from the original v1
 * pages.
 */
export function V2ScopeLayout() {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  )

  return (
    <Provider store={v2Store}>
      <PersistGate
        loading={<div className="persist-loading">Restoring v2 demo…</div>}
        persistor={v2Persistor}
      >
        <QueryClientProvider client={queryClient}>
          <ScopePathsProvider value={V2_SCOPE_PATHS}>
            <Outlet />
          </ScopePathsProvider>
        </QueryClientProvider>
      </PersistGate>
    </Provider>
  )
}
