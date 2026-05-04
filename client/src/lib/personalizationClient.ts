import { api, ApiError } from '../api/http'
import type { RootState } from '../store'

type ProxyResponse = {
  ok?: boolean
  status?: number
  data?: unknown
  error?: string
}

/**
 * Loads personalization payload: backend → proxy GET; local → current simulated store (after UI paint).
 */
export async function fetchPersonalizationSnapshot(params: {
  backend: boolean
  getState: () => RootState
  /** Appended to configured personalization base URL */
  path?: string
}): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> {
  if (params.backend) {
    try {
      const lastId = params.getState().simulator.lastPersonalizationCustomerId?.trim()
      const body =
        lastId ?
          JSON.stringify({ customerId: lastId })
        : JSON.stringify({
            path: params.path ?? '/',
            method: 'GET',
          })

      const res = await api<ProxyResponse>('/api/personalization', {
        method: 'POST',
        body,
      })
      return {
        ok: res.ok !== false,
        status: res.status,
        data: res.data,
        error: res.error,
      }
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : String(e)
      return { ok: false, status: undefined, data: undefined, error: msg }
    }
  }

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })

  const sim = params.getState().simulator.personalizationResponse
  return {
    ok: sim?.ok !== false,
    status: sim?.status ?? 200,
    data: sim?.data,
    error: sim?.error,
  }
}
