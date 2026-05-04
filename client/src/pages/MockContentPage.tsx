import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/http'
import { MockExperienceLiveRegion } from '../components/MockExperienceLiveRegion'
import { MockExperienceRulesDefault } from '../components/MockExperienceRulesDefault'
import { backendStorageEnabled } from '../config/storageMode'
import { useMockEventPublish } from '../hooks/useMockEventPublish'
import { alignPayloadToMockSchema } from '../lib/payloadAlign'
import { buildDefaultPayload } from '../lib/schemaDefaults'
import { ensureDefaultPayloadForEvent } from '../store/eventPayloadsSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { getEventThemeStyle } from '../lib/eventTheme'
import type { SchemaNode } from '../types/schema'

type ApiMockEventRow = {
  id: string
  name: string
  schema: SchemaNode[]
  created_at: string
}

export function MockContentPage() {
  const backend = backendStorageEnabled()
  const dispatch = useAppDispatch()
  const reduxEvents = useAppSelector((s) => s.mockEvents.events)
  const rulesByEventId = useAppSelector((s) => s.eventDynamicRules.byEventId)
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

  const experienceEvents = useMemo(
    () => events.filter((ev) => rulesByEventId[ev.id] != null),
    [events, rulesByEventId],
  )

  const { triggerPublish, publishStatus, publishPending } = useMockEventPublish()

  useEffect(() => {
    for (const ev of experienceEvents) {
      dispatch(
        ensureDefaultPayloadForEvent({
          eventId: ev.id,
          schema: ev.schema ?? [],
        }),
      )
    }
  }, [dispatch, experienceEvents])

  const emptyHint = useMemo(
    () =>
      (!backend || !isLoading) && experienceEvents.length === 0 ? (
        <p className="muted">
          No mock experiences yet. Open <Link to="/">Mock Events</Link>, add{' '}
          <strong>Dynamic Content Rules</strong> to an event, and click{' '}
          <strong>Save rules</strong>. Saved rules appear here with a trigger and default content.
        </p>
      ) : null,
    [backend, isLoading, experienceEvents.length],
  )

  if (backend && error) {
    return (
      <div className="page">
        <h1>Mock Experiences</h1>
        <div className="banner banner-error">
          Could not load mock events. Is the API running and configured? {(error as Error).message}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Mock Experiences</h1>
      <p className="lede">
        Each card mirrors a mock event that has saved Dynamic Content Rules. Trigger publish, then{' '}
        <strong>Refresh Experience</strong> to load the Personalization API and render content from
        your rules (matched row or default) without flashing placeholder content first.
      </p>
      {emptyHint}
      {backend && isLoading && <p className="muted">Loading…</p>}
      <div className="event-grid">
        {experienceEvents.map((ev) => {
          const schema = ev.schema ?? []
          const rules = rulesByEventId[ev.id]!
          return (
            <article
              key={ev.id}
              className="card mock-experience-card"
              style={getEventThemeStyle(ev.id)}
            >
              <div className="card-head">
                <h2>{rules.title}</h2>
              </div>
              <p className="muted small mock-experience-meta">
                Mock event: <strong>{ev.name}</strong>
              </p>
              <MockExperienceLiveRegion
                eventId={ev.id}
                eventSchema={schema}
                rules={rules}
              />
              <details className="mock-event-collapsible mock-experience-reference">
                <summary className="mock-event-collapsible-summary">
                  Saved default <span className="muted">(reference from rules)</span>
                </summary>
                <div className="mock-experience-default-shell mock-event-collapsible-inner">
                  <MockExperienceRulesDefault rules={rules} />
                </div>
              </details>
              <div className="mock-event-trigger">
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={backend && publishPending}
                  onClick={() => {
                    const raw =
                      payloadsById[ev.id] ?? buildDefaultPayload(schema)
                    const aligned = alignPayloadToMockSchema(schema, raw)
                    triggerPublish(ev.id, aligned, ev.name)
                  }}
                >
                  Trigger {ev.name} Event
                </button>
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
