import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../api/http'
import { backendStorageEnabled } from '../config/storageMode'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setSimulatedPersonalizationResponse } from '../store/simulatorSlice'

type ProxyResponse = {
  ok?: boolean
  status?: number
  data?: unknown
  error?: string
}

export function PersonalizationPage() {
  const backend = backendStorageEnabled()
  const dispatch = useAppDispatch()
  const simulatedFromStore = useAppSelector((s) => s.simulator.personalizationResponse)

  const [path, setPath] = useState('/')
  const [method, setMethod] = useState<'GET' | 'POST' | 'PUT' | 'PATCH'>('GET')
  const [bodyText, setBodyText] = useState('{}')
  const [poll, setPoll] = useState(false)

  const [simDraft, setSimDraft] = useState('')

  useEffect(() => {
    if (backend) return
    setSimDraft(
      JSON.stringify(
        simulatedFromStore ?? { ok: true, status: 200, data: {} },
        null,
        2,
      ),
    )
  }, [backend, simulatedFromStore])

  const parsedBody = useMemo(() => {
    try {
      return JSON.parse(bodyText || '{}') as unknown
    } catch {
      return null
    }
  }, [bodyText])

  const mutation = useMutation({
    mutationFn: () =>
      api<ProxyResponse>('/api/personalization', {
        method: 'POST',
        body: JSON.stringify({
          path,
          method,
          body: method === 'GET' ? undefined : parsedBody ?? {},
        }),
      }),
  })

  const polled = useQuery({
    queryKey: ['personalization', path, method, bodyText],
    queryFn: () =>
      api<ProxyResponse>('/api/personalization', {
        method: 'POST',
        body: JSON.stringify({
          path,
          method,
          body: method === 'GET' ? undefined : parsedBody ?? {},
        }),
      }),
    enabled:
      backend &&
      poll &&
      Boolean(path) &&
      (method === 'GET' || parsedBody !== null),
    refetchInterval: poll ? 1500 : false,
  })

  const displayBackend = poll ? polled.data : mutation.data
  const displayErrorBackend = poll ? polled.error : mutation.error
  const isFetchingBackend = poll ? polled.isFetching : mutation.isPending

  function applySimulated() {
    try {
      const parsed = JSON.parse(simDraft || '{}') as ProxyResponse
      dispatch(setSimulatedPersonalizationResponse(parsed))
    } catch {
      dispatch(
        setSimulatedPersonalizationResponse({
          ok: false,
          status: 400,
          error: 'Invalid JSON — fix the textarea and try again.',
        }),
      )
    }
  }

  return (
    <div className="page">
      <h1>Personalization API</h1>
      <p className="lede">
        {backend
          ? 'Calls go through the demo backend proxy so keys stay server-side.'
          : 'Simulated mode: edit JSON below and apply. Dynamic Content Rules on each mock event card read this response.'}
      </p>

      {backend && (
        <>
          <div className="form-grid">
            <label className="stack-label">
              <span>Path (appended to configured base URL)</span>
              <input className="input" value={path} onChange={(e) => setPath(e.target.value)} />
            </label>
            <label className="stack-label">
              <span>Method</span>
              <select
                className="input"
                value={method}
                onChange={(e) => setMethod(e.target.value as typeof method)}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="PATCH">PATCH</option>
              </select>
            </label>
          </div>

          {method !== 'GET' && (
            <label className="stack-label">
              <span>JSON body</span>
              <textarea
                className="input textarea"
                rows={10}
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
              />
            </label>
          )}

          {parsedBody === null && method !== 'GET' && (
            <div className="banner banner-error">Body must be valid JSON.</div>
          )}

          <div className="actions-row">
            <button
              type="button"
              className="btn btn-primary"
              disabled={isFetchingBackend || (method !== 'GET' && parsedBody === null)}
              onClick={() => mutation.mutate()}
            >
              Send request
            </button>
            <label className="checkbox-label inline">
              <input type="checkbox" checked={poll} onChange={(e) => setPoll(e.target.checked)} />
              Poll every 1.5s (latency demo)
            </label>
          </div>

          {displayErrorBackend && (
            <div className="banner banner-error">
              {(displayErrorBackend as Error).message}
              {displayErrorBackend instanceof ApiError && (
                <pre className="result-block">{JSON.stringify(displayErrorBackend.body, null, 2)}</pre>
              )}
            </div>
          )}

          {displayBackend && (
            <pre className="result-block">{JSON.stringify(displayBackend, null, 2)}</pre>
          )}
        </>
      )}

      {!backend && (
        <>
          <div className="banner banner-success">
            Local-only: this JSON is persisted in your browser (Redux + localStorage) and powers
            image previews under Dynamic Content Rules on each mock event card.
          </div>
          <label className="stack-label">
            <span>Simulated proxy response (JSON)</span>
            <textarea
              className="input textarea"
              rows={14}
              value={simDraft}
              onChange={(e) => setSimDraft(e.target.value)}
            />
          </label>
          <div className="actions-row">
            <button type="button" className="btn btn-primary" onClick={applySimulated}>
              Apply to store
            </button>
          </div>
          {simulatedFromStore && (
            <pre className="result-block">{JSON.stringify(simulatedFromStore, null, 2)}</pre>
          )}
        </>
      )}
    </div>
  )
}
