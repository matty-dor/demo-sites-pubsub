import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from 'react-redux'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/http'
import { backendStorageEnabled } from '../config/storageMode'
import { useMockEventPublish } from '../hooks/useMockEventPublish'
import { fetchPersonalizationSnapshot } from '../lib/personalizationClient'
import type { RootState } from '../store'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { clearExperienceAwaitingRefresh } from '../store/experienceRefreshSlice'
import { setSimulatedPersonalizationResponse } from '../store/simulatorSlice'
import { DynamicContentRulesSection } from '../components/DynamicContentRulesSection'
import { removeRulesForEvent } from '../store/eventDynamicRulesSlice'
import { removeMockEvent } from '../store/mockEventsSlice'
import type { SchemaNode } from '../types/schema'
import { alignPayloadToMockSchema } from '../lib/payloadAlign'
import { buildDefaultPayload } from '../lib/schemaDefaults'
import { PayloadEditor } from '../components/PayloadEditor'
import { GrowthLoopSchemaPanel } from '../components/GrowthLoopSchemaPanel'

type ApiMockEventRow = {
  id: string
  name: string
  schema: SchemaNode[]
  created_at: string
}

export function HomePage() {
  const backend = backendStorageEnabled()
  const dispatch = useAppDispatch()
  const store = useStore()
  const reduxEvents = useAppSelector((s) => s.mockEvents.events)
  const awaitingByEvent = useAppSelector((s) => s.experienceRefresh.awaitingRefreshByEventId)

  const { data, isLoading, error } = useQuery({
    queryKey: ['mock-events'],
    queryFn: () => api<{ events: ApiMockEventRow[] }>('/api/mock-events'),
    enabled: backend,
  })

  const events = useMemo(() => {
    if (backend) {
      return (data?.events ?? []).map((ev) => ({
        id: ev.id,
        name: ev.name,
        schema: ev.schema ?? [],
      }))
    }
    return reduxEvents.map((ev) => ({
      id: ev.id,
      name: ev.name,
      schema: ev.schema ?? [],
    }))
  }, [backend, data?.events, reduxEvents])

  const [payloads, setPayloads] = useState<Record<string, Record<string, unknown>>>({})
  const { triggerPublish, publishStatus, publishPending } = useMockEventPublish()

  const refreshPersonalization = useCallback(
    async (eventId: string) => {
      const snap = await fetchPersonalizationSnapshot({
        backend,
        getState: () => store.getState() as RootState,
      })
      dispatch(
        setSimulatedPersonalizationResponse({
          ok: snap.ok,
          status: snap.status ?? 200,
          data: snap.data,
          error: snap.error,
        }),
      )
      dispatch(clearExperienceAwaitingRefresh(eventId))
    },
    [backend, dispatch, store],
  )

  useEffect(() => {
    setPayloads((prev) => {
      const next = { ...prev }
      for (const ev of events) {
        if (!next[ev.id]) {
          next[ev.id] = buildDefaultPayload(ev.schema ?? [])
        }
      }
      return next
    })
  }, [events])

  const emptyHint = useMemo(
    () =>
      (!backend || !isLoading) && events.length === 0 ? (
        <p className="muted">
          No mock events yet. Use <strong>Create New Mock Event</strong> above to define a schema and
          trigger publishes from here.
        </p>
      ) : null,
    [backend, isLoading, events.length],
  )

  if (backend && error) {
    return (
      <div className="page">
        <div className="page-title-row">
          <h1>Mock Events</h1>
          <Link to="/mock-events/new" className="btn btn-primary page-title-action">
            Create New Mock Event
          </Link>
        </div>
        <div className="banner banner-error">
          Could not load mock events. Is the API running and configured? {(error as Error).message}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-title-row">
        <h1>Mock Events</h1>
        <Link to="/mock-events/new" className="btn btn-primary page-title-action">
          Create New Mock Event
        </Link>
      </div>
      <p className="lede">
        Each card is a saved event schema. Fill mock payload values, then trigger a publish. With{' '}
        <strong>local storage</strong>, nothing leaves your browser until you switch to the API.
      </p>
      {emptyHint}
      {backend && isLoading && <p className="muted">Loading…</p>}
      <div className="event-grid">
        {events.map((ev) => {
          const schema = ev.schema ?? []
          const payload = payloads[ev.id] ?? buildDefaultPayload(schema)
          return (
            <article key={ev.id} className="card">
              <div className="card-head">
                <h2>{ev.name}</h2>
                {!backend && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => {
                      dispatch(removeMockEvent(ev.id))
                      dispatch(removeRulesForEvent(ev.id))
                    }}
                  >
                    Delete
                  </button>
                )}
              </div>
              <GrowthLoopSchemaPanel eventName={ev.name} rootFields={schema} />
              <details className="mock-event-collapsible">
                <summary className="mock-event-collapsible-summary">
                  Mock event data <span className="muted">(payload)</span>
                </summary>
                <div className="mock-event-collapsible-inner">
                  <PayloadEditor
                    schema={schema}
                    value={payload}
                    onChange={(next) => setPayloads((p) => ({ ...p, [ev.id]: next }))}
                  />
                </div>
              </details>
              <DynamicContentRulesSection eventId={ev.id} eventName={ev.name} />
              <div className="mock-event-trigger mock-event-trigger-row">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={backend && publishPending}
                  onClick={() => {
                    const aligned = alignPayloadToMockSchema(schema, payload)
                    triggerPublish(ev.id, aligned, ev.name)
                  }}
                >
                  Trigger {ev.name} Event
                </button>
                {awaitingByEvent[ev.id] && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void refreshPersonalization(ev.id)}
                  >
                    Refresh Experience
                  </button>
                )}
              </div>
              {publishStatus[ev.id] && (
                <details className="mock-event-collapsible">
                  <summary className="mock-event-collapsible-summary">
                    Trigger result <span className="muted">(JSON)</span>
                  </summary>
                  <pre className="result-block mock-event-collapsible-pre">
                    {publishStatus[ev.id]}
                  </pre>
                </details>
              )}
            </article>
          )
        })}
      </div>
    </div>
  )
}
