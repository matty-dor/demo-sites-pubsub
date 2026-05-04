import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '../api/http'
import { backendStorageEnabled } from '../config/storageMode'
import { useAppDispatch } from '../store/hooks'
import {
  setLastPersonalizationCustomerId,
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
        'Stub only — no backend. Set VITE_USE_BACKEND=true and configure the server (PERSONALIZATION_API_BASE_URL, PERSONALIZATION_API_PATH_TEMPLATE with {{customerId}}, PERSONALIZATION_API_KEY) for live Personalization API calls.',
    },
  }
}

export function PersonalizationPage() {
  const backend = backendStorageEnabled()
  const dispatch = useAppDispatch()
  const [customerId, setCustomerId] = useState('')
  const [lastResponse, setLastResponse] = useState<ProxyResponse | null>(null)

  const mutation = useMutation({
    mutationFn: async (): Promise<ProxyResponse> => {
      const id = customerId.trim()
      if (!id) {
        throw new Error('Enter a customer_id.')
      }

      if (backend) {
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
      setLastResponse(res)
      dispatch(setSimulatedPersonalizationResponse(res))
      dispatch(setLastPersonalizationCustomerId(customerId.trim()))
    },
    onError: () => {
      setLastResponse(null)
    },
  })

  const err = mutation.error

  return (
    <div className="page">
      <h1>Personalization API</h1>
      <p className="lede">
        Enter a <strong>customer_id</strong> and fetch. The demo backend substitutes it into the path
        from <code>PERSONALIZATION_API_PATH_TEMPLATE</code> (must include{' '}
        <code>{'{{customerId}}'}</code>), calls your GrowthLoop Personalization API with{' '}
        <code>PERSONALIZATION_API_KEY</code> server-side, and shows the JSON below.
      </p>

      {!backend && (
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
          Fetch personalization
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

      {lastResponse && (
        <section className="personalization-response-section">
          <h2 className="personalization-response-heading">Response</h2>
          <pre className="result-block">{JSON.stringify(lastResponse, null, 2)}</pre>
        </section>
      )}
    </div>
  )
}
