import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '../api/http'
import { personalizationHttpEnabled } from '../config/storageMode'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  setLastPersonalizationCustomerId,
  setLastPersonalizationFetchedAt,
  setSimulatedPersonalizationResponse,
} from '../store/simulatorSlice'

type ProxyResponse = {
  ok?: boolean
  status?: number
  data?: unknown
  error?: string
}

function localStubResponse(customerId: string): ProxyResponse {
  return {
    ok: true,
    status: 200,
    data: {
      customer_id: customerId,
      _localDemo:
        'Stub only — no HTTP proxy. Set VITE_USE_BACKEND=true (Fastify) or VITE_USE_VERCEL_API=true (same-origin api/personalization.js), with PERSONALIZATION_* env on the server/Vercel.',
    },
  }
}

function formatFetchedAt(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.valueOf())) return iso
  return d.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export function PersonalizationPage() {
  const useHttpProxy = personalizationHttpEnabled()
  const dispatch = useAppDispatch()
  const storedResponse = useAppSelector((s) => s.simulator.personalizationResponse)
  const fetchedAt = useAppSelector((s) => s.simulator.lastPersonalizationFetchedAt)
  const [customerId, setCustomerId] = useState('')

  const mutation = useMutation({
    mutationFn: async (): Promise<ProxyResponse> => {
      const id = customerId.trim()
      if (!id) {
        throw new Error('Enter a customer_id.')
      }

      if (useHttpProxy) {
        const res = await api<ProxyResponse>('/api/personalization', {
          method: 'POST',
          body: JSON.stringify({ customerId: id }),
        })
        return res
      }

      await new Promise<void>((r) => {
        requestAnimationFrame(() => requestAnimationFrame(() => r()))
      })
      return localStubResponse(id)
    },
    onSuccess: (res) => {
      dispatch(setSimulatedPersonalizationResponse(res))
      dispatch(setLastPersonalizationCustomerId(customerId.trim()))
      dispatch(setLastPersonalizationFetchedAt(new Date().toISOString()))
    },
  })

  const err = mutation.error
  const showResponse = Boolean(fetchedAt && storedResponse)

  return (
    <div className="page">
      <h1>Personalization API</h1>
      <p className="lede">
        Use the <strong>customer_id</strong> field below to fetch the corresponding data that has
        been written to the GrowthLoop Personalization API.
      </p>

      {!useHttpProxy && (
        <div className="banner banner-success">
          Local mode: the button applies a small stub JSON to the store (for Dynamic Content Rules /
          Refresh Experience). Enable the backend for real API calls.
        </div>
      )}

      <div className="form-grid personalization-customer-form">
        <label className="stack-label">
          <span>customer_id</span>
          <input
            className="input"
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            placeholder="e.g. cust_01HXYZ…"
            autoComplete="off"
          />
        </label>
      </div>

      <div className="actions-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          Call the Personalization API
        </button>
      </div>

      {err && (
        <div className="banner banner-error">
          {(err as Error).message}
          {err instanceof ApiError && (
            <pre className="result-block">{JSON.stringify(err.body, null, 2)}</pre>
          )}
        </div>
      )}

      {showResponse && (
        <section className="personalization-response-section">
          <div className="personalization-response-head">
            <h2 className="personalization-response-heading">Response</h2>
            {fetchedAt && (
              <span className="personalization-fetched-at muted small">
                last fetched at {formatFetchedAt(fetchedAt)}
              </span>
            )}
          </div>
          <pre className="result-block">{JSON.stringify(storedResponse, null, 2)}</pre>
        </section>
      )}
    </div>
  )
}
