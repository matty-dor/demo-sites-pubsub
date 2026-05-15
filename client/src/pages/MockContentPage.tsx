import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../api/http'
import { MockExperienceLiveRegion } from '../components/MockExperienceLiveRegion'
import { MockExperienceRulesDefault } from '../components/MockExperienceRulesDefault'
import { MockExperienceV2Card } from '../components/MockExperienceV2Card'
import { backendStorageEnabled } from '../config/storageMode'
import { useMockEventPublish } from '../hooks/useMockEventPublish'
import { withEventTypeFirst } from '../lib/eventTypePayload'
import { alignPayloadToMockSchema } from '../lib/payloadAlign'
import { buildDefaultPayload } from '../lib/schemaDefaults'
import { ensureDefaultPayloadForEvent } from '../store/eventPayloadsSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { getEventThemeStyle } from '../lib/eventTheme'
import { panelTitleSuffixFromSaved } from '../lib/panelTitle'
import { useScopePaths } from '../scope/ScopeContext'
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
  const scopePaths = useScopePaths()
  const isV2 = scopePaths.scopeId === 'v2'

  const reduxEvents = useAppSelector((s) => s.mockEvents.events)
  const rulesByEventId = useAppSelector((s) => s.eventDynamicRules.byEventId)
  const pageStructureByEventId = useAppSelector(
    (s) => s.pageStructure.byEventId,
  )
  const staticContentByEventId = useAppSelector(
    (s) => s.staticContent.byEventId,
  )
  const dynamicTargetsByEventId = useAppSelector(
    (s) => s.eventDynamicTargets.byEventId,
  )
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

  // v1 experiences appear when an event has saved Dynamic Content Rules.
  // v2 experiences appear as soon as the event has saved any of: Page Structure,
  // Static Content, or Dynamic Targets — the card just renders whatever pieces
  // are present (cells without structure/content fall back to placeholders).
  const experienceEvents = useMemo(() => {
    if (isV2) {
      return events.filter(
        (ev) =>
          pageStructureByEventId[ev.id] != null ||
          staticContentByEventId[ev.id] != null ||
          dynamicTargetsByEventId[ev.id] != null,
      )
    }
    return events.filter((ev) => rulesByEventId[ev.id] != null)
  }, [
    isV2,
    events,
    rulesByEventId,
    pageStructureByEventId,
    staticContentByEventId,
    dynamicTargetsByEventId,
  ])

  const { triggerPublish, publishStatus, publishPending } = useMockEventPublish()

  useEffect(() => {
    for (const ev of experienceEvents) {
      dispatch(
        ensureDefaultPayloadForEvent({
          eventId: ev.id,
          schema: ev.schema ?? [],
          eventName: ev.name,
        }),
      )
    }
  }, [dispatch, experienceEvents])

  const emptyHint = useMemo(() => {
    if (backend && isLoading) return null
    if (experienceEvents.length > 0) return null
    if (isV2) {
      return (
        <p className="muted">
          No experiences yet. Open <Link to={scopePaths.events}>Events</Link>{' '}
          and save a <strong>Page Structure</strong>,{' '}
          <strong>Static Content</strong>, or <strong>Dynamic Content</strong>{' '}
          on an event — the experience appears here as soon as any of those is
          saved.
        </p>
      )
    }
    return (
      <p className="muted">
        No experiences yet. Open <Link to={scopePaths.events}>Events</Link>, add{' '}
        <strong>Dynamic Content Rules</strong> to an event, and click{' '}
        <strong>Save rules</strong>. Saved rules appear here with a trigger and default content.
      </p>
    )
  }, [backend, isLoading, experienceEvents.length, isV2, scopePaths.events])

  if (backend && error) {
    return (
      <div className="page">
        <h1>Experiences</h1>
        <div className="banner banner-error">
          Could not load events. Is the API running and configured? {(error as Error).message}
        </div>
      </div>
    )
  }

  if (isV2) {
    return (
      <div className="page">
        <h1>Experiences</h1>
        <p className="lede">
          Each card mirrors an event that has a saved Page Structure with
          Static or Dynamic content. Trigger the event from the card, then{' '}
          <strong>Refresh Experience</strong> to load the Personalization API
          and resolve any dynamic targets per cell — defaulting back to your
          saved Static Content where no dynamic match applies.
        </p>
        {emptyHint}
        {backend && isLoading && <p className="muted">Loading…</p>}
        <div className="event-grid mock-experience-v2-grid">
          {experienceEvents.map((ev) => (
            <MockExperienceV2Card
              key={ev.id}
              eventId={ev.id}
              eventName={ev.name}
              eventSchema={ev.schema ?? []}
              rows={pageStructureByEventId[ev.id]?.rows ?? []}
              staticContent={staticContentByEventId[ev.id]}
              dynamicConfig={dynamicTargetsByEventId[ev.id]}
            />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Experiences</h1>
      <p className="lede">
        Each card mirrors an event that has saved Dynamic Content Rules. Trigger publish, then{' '}
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
              <div className="card-head mock-experience-card-head">
                <div className="mock-experience-card-titles">
                  <h2 className="mock-experience-card-event-name">Event Name: {ev.name}</h2>
                  <h2 className="mock-experience-card-rule-name">
                    Content Rule: {panelTitleSuffixFromSaved(rules.title, ev.name)}
                  </h2>
                </div>
              </div>
              <MockExperienceLiveRegion
                eventId={ev.id}
                eventName={ev.name}
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
                  className="btn btn-primary mock-event-trigger-btn"
                  disabled={backend && publishPending}
                  onClick={() => {
                    const raw =
                      payloadsById[ev.id] ?? buildDefaultPayload(schema, ev.name)
                    const aligned = withEventTypeFirst(
                      ev.name,
                      alignPayloadToMockSchema(schema, raw),
                    )
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
