import { api, ApiError } from '../api/http'
import {
  backendStorageEnabled,
  personalizationHttpEnabled,
} from '../config/storageMode'
import type { RootState } from '../store'

type ProxyResponse = {
  ok?: boolean
  status?: number
  data?: unknown
  error?: string
}

function readSimulated(getState: () => RootState) {
  const sim = getState().simulator.personalizationResponse
  return {
    ok: sim?.ok !== false,
    status: sim?.status ?? 200,
    data: sim?.data,
    error: sim?.error,
  }
}

/**
 * Loads personalization: HTTP proxy when enabled; otherwise current simulated store (after UI paint).
 *
 * When `customerIdFromMockEvent` is **provided** (Refresh Experience): only that id is sent — not the
 * value from the Personalization page. Empty string → error result (no HTTP).
 *
 * When omitted: legacy behavior — `lastPersonalizationCustomerId` (Personalization page) or Fastify generic GET.
 */
export async function fetchPersonalizationSnapshot(params: {
  getState: () => RootState
  /** Fastify generic proxy only — ignored on Vercel serverless */
  path?: string
  /** If defined, POST { customerId } using this value only (mock event payload path). */
  customerIdFromMockEvent?: string
}): Promise<{ ok: boolean; status?: number; data?: unknown; error?: string }> {
  if (personalizationHttpEnabled()) {
    try {
      let body: string | undefined

      if (params.customerIdFromMockEvent !== undefined) {
        const t = params.customerIdFromMockEvent.trim()
        if (!t) {
          return {
            ok: false,
            status: 400,
            data: undefined,
            error:
              'Missing customer_id in this mock event payload. Set customer_id on the card (required field on every mock event schema).',
          }
        }
        body = JSON.stringify({ customerId: t })
      } else {
        const lastId = params.getState().simulator.lastPersonalizationCustomerId?.trim()
        if (lastId) {
          body = JSON.stringify({ customerId: lastId })
        } else if (backendStorageEnabled()) {
          body = JSON.stringify({
            path: params.path ?? '/',
            method: 'GET',
          })
        }
      }

      if (!body) {
        await new Promise<void>((resolve) => {
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        })
        return readSimulated(params.getState)
      }

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

  return readSimulated(params.getState)
}
