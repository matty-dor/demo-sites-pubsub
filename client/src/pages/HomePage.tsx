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
import { extractCustomerIdFromPayload } from '../lib/customerIdFromPayload'
import {
  ensureDefaultPayloadForEvent,
  removePayloadForEvent,
  setPayloadForEvent,
} from '../store/eventPayloadsSlice'
import { removeMockEvent } from '../store/mockEventsSlice'
import type { SchemaNode } from '../types/schema'
import { withEventTypeFirst } from '../lib/eventTypePayload'
import { alignPayloadToMockSchema } from '../lib/payloadAlign'
import {
  isPayloadComplete,
  listIncompleteRootKeys,
} from '../lib/payloadCompleteness'
import { buildDefaultPayload } from '../lib/schemaDefaults'
import { PayloadEditor } from '../components/PayloadEditor'
import { GrowthLoopSchemaPanel } from '../components/GrowthLoopSchemaPanel'
import { getEventThemeStyle } from '../lib/eventTheme'
import { useScopePaths } from '../scope/ScopeContext'

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
  const scopePaths = useScopePaths()
  const reduxEvents = useAppSelector((s) => s.mockEvents.events)
  const awaitingByEvent = useAppSelector((s) => s.experienceRefresh.awaitingRefreshByEventId)
  const payloadsById = useAppSelector((s) => s.eventPayloads.byEventId)

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

  const { triggerPublish, publishStatus, publishPending } = useMockEventPublish()

  const [triggerAttemptedById, setTriggerAttemptedById] = useState<Record<string, boolean>>({})
  const [payloadOpenById, setPayloadOpenById] = useState<Record<string, boolean>>({})

  const refreshPersonalization = useCallback(
    async (eventId: string, schema: SchemaNode[], eventName: string) => {
      const state = store.getState() as RootState
      const payload =
        state.eventPayloads.byEventId[eventId] ?? buildDefaultPayload(schema, eventName)
      const cid = extractCustomerIdFromPayload(schema, payload)
      const snap = await fetchPersonalizationSnapshot({
        getState: () => store.getState() as RootState,
        customerIdFromMockEvent: cid ?? '',
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
    [dispatch, store],
  )

  useEffect(() => {
    for (const ev of events) {
      dispatch(
        ensureDefaultPayloadForEvent({
          eventId: ev.id,
          schema: ev.schema ?? [],
          eventName: ev.name,
        }),
      )
    }
  }, [dispatch, events])

  const emptyHint = useMemo(
    () =>
      (!backend || !isLoading) && events.length === 0 ? (
        <p className="muted">
          No events yet. Use <strong>Create New Event</strong> above to define a schema and
          trigger publishes from here.
        </p>
      ) : null,
    [backend, isLoading, events.length],
  )

  if (backend && error) {
    return (
      <div className="page">
        <div className="page-title-row">
          <h1>Events</h1>
          <Link to={scopePaths.eventsCreate} className="btn btn-primary page-title-action">
            Create New Event
          </Link>
        </div>
        <div className="banner banner-error">
          Could not load events. Is the API running and configured? {(error as Error).message}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-title-row">
        <h1>Events</h1>
        <Link to={scopePaths.eventsCreate} className="btn btn-primary page-title-action">
          Create New Event
        </Link>
      </div>
      <p className="lede">
        Each card is a saved event schema. Fill payload values, then trigger a publish. With{' '}
        <strong>local storage</strong>, nothing leaves your browser until you switch to the API.
      </p>
      {emptyHint}
      {backend && isLoading && <p className="muted">Loading…</p>}
      <div className="event-grid">
        {events.map((ev) => {
          const schema = ev.schema ?? []
          const payload = payloadsById[ev.id] ?? buildDefaultPayload(schema, ev.name)
          const payloadComplete = isPayloadComplete(schema, payload)
          const triggerAttempted = triggerAttemptedById[ev.id] === true
          const showIncompleteHint = triggerAttempted && !payloadComplete
          const incompleteKeys = showIncompleteHint
            ? listIncompleteRootKeys(schema, payload)
            : []
          const payloadOpen = payloadOpenById[ev.id] ?? false
          return (
            <article
              key={ev.id}
              className="card mock-event-card"
              style={getEventThemeStyle(ev.id)}
            >
              <div className="card-head">
                <h2>
                  Event Name: {ev.name}
                </h2>
                <div className="card-head-actions">
                  <Link
                    to={scopePaths.eventsEdit(ev.id)}
                    className="btn btn-ghost"
                  >
                    Edit
                  </Link>
                  {!backend && (
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => {
                        dispatch(removeMockEvent(ev.id))
                        dispatch(removeRulesForEvent(ev.id))
                        dispatch(removePayloadForEvent(ev.id))
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
              <GrowthLoopSchemaPanel eventName={ev.name} rootFields={schema} />
              <details
                className={`mock-event-collapsible${showIncompleteHint ? ' needs-attention' : ''}`}
                open={payloadOpen}
                onToggle={(e) => {
                  const node = e.currentTarget as HTMLDetailsElement | null
                  if (!node) return
                  const isOpen = node.open
                  setPayloadOpenById((prev) => ({ ...prev, [ev.id]: isOpen }))
                }}
              >
                <summary className="mock-event-collapsible-summary">
                  Event Payload
                  {!payloadComplete && (
                    <span className="payload-required-pill" aria-hidden>
                      Required fields incomplete
                    </span>
                  )}
                </summary>
                <div className="mock-event-collapsible-inner">
                  <PayloadEditor
                    schema={schema}
                    value={payload}
                    onChange={(next) =>
                      dispatch(setPayloadForEvent({ eventId: ev.id, payload: next }))
                    }
                  />
                </div>
              </details>
              <DynamicContentRulesSection eventId={ev.id} eventName={ev.name} />
              <div className="mock-event-trigger mock-event-trigger-row">
                <button
                  type="button"
                  className="btn btn-primary mock-event-trigger-btn"
                  disabled={backend && publishPending}
                  aria-disabled={!payloadComplete || (backend && publishPending)}
                  title={
                    payloadComplete
                      ? undefined
                      : 'Complete all Event Payload fields before triggering.'
                  }
                  onClick={() => {
                    if (!payloadComplete) {
                      setTriggerAttemptedById((prev) => ({ ...prev, [ev.id]: true }))
                      setPayloadOpenById((prev) => ({ ...prev, [ev.id]: true }))
                      return
                    }
                    setTriggerAttemptedById((prev) => ({ ...prev, [ev.id]: false }))
                    const aligned = withEventTypeFirst(
                      ev.name,
                      alignPayloadToMockSchema(schema, payload),
                    )
                    triggerPublish(ev.id, aligned, ev.name)
                  }}
                >
                  Trigger {ev.name} Event
                </button>
                {awaitingByEvent[ev.id] && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => void refreshPersonalization(ev.id, schema, ev.name)}
                  >
                    Refresh Experience
                  </button>
                )}
              </div>
              {showIncompleteHint && (
                <p className="payload-required-hint" role="alert">
                  Complete all Event Payload fields before triggering.
                  {incompleteKeys.length > 0 && (
                    <>
                      {' '}Still needed:{' '}
                      <code>{incompleteKeys.join(', ')}</code>.
                    </>
                  )}
                </p>
              )}
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
