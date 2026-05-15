import { useCallback, useEffect, useState } from 'react'
import { useStore } from 'react-redux'
import { backendStorageEnabled } from '../config/storageMode'
import { getEventThemeStyle } from '../lib/eventTheme'
import { useMockEventPublish } from '../hooks/useMockEventPublish'
import { extractCustomerIdFromPayload } from '../lib/customerIdFromPayload'
import { fetchPersonalizationSnapshot } from '../lib/personalizationClient'
import { withEventTypeFirst } from '../lib/eventTypePayload'
import { alignPayloadToMockSchema } from '../lib/payloadAlign'
import { buildDefaultPayload } from '../lib/schemaDefaults'
import type { RootState } from '../store'
import type { V2DynamicConfig } from '../store/eventDynamicTargetsSlice'
import { clearExperienceAwaitingRefresh } from '../store/experienceRefreshSlice'
import { setExperienceV2CardExpanded } from '../store/experienceV2CardExpandSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import type { PageStructureRow } from '../store/pageStructureSlice'
import { setSimulatedPersonalizationResponse } from '../store/simulatorSlice'
import type { StaticContent } from '../store/staticContentSlice'
import type { SchemaNode } from '../types/schema'
import { MockExperienceV2LiveRegion } from './MockExperienceV2LiveRegion'

type DisplaySource = 'default' | 'refreshed'

type Props = {
  eventId: string
  eventName: string
  eventSchema: SchemaNode[]
  rows: PageStructureRow[]
  staticContent: StaticContent | undefined
  dynamicConfig: V2DynamicConfig | undefined
}

export function MockExperienceV2Card({
  eventId,
  eventName,
  eventSchema,
  rows,
  staticContent,
  dynamicConfig,
}: Props) {
  const dispatch = useAppDispatch()
  const store = useStore()
  const backend = backendStorageEnabled()
  const payload = useAppSelector(
    (s) => s.eventPayloads.byEventId[eventId],
  )
  const awaitingRefresh = useAppSelector(
    (s) => s.experienceRefresh.awaitingRefreshByEventId[eventId],
  )
  const cardExpanded = useAppSelector(
    (s) => s.experienceV2CardExpand.expandedByEventId[eventId] === true,
  )
  const { triggerPublish, publishStatus, publishPending } = useMockEventPublish()

  const [personalizationData, setPersonalizationData] =
    useState<unknown>(undefined)
  const [displaySource, setDisplaySource] = useState<DisplaySource>('default')
  const [loading, setLoading] = useState(false)
  const [hasEverRefreshed, setHasEverRefreshed] = useState(false)

  useEffect(() => {
    setPersonalizationData(undefined)
    setDisplaySource('default')
    setHasEverRefreshed(false)
    setLoading(false)
  }, [eventId])

  const showRefresh = Boolean(awaitingRefresh) || loading || hasEverRefreshed

  const runRefresh = useCallback(async () => {
    setLoading(true)
    const state = store.getState() as RootState
    const pay =
      state.eventPayloads.byEventId[eventId] ??
      buildDefaultPayload(eventSchema, eventName)
    const cid = extractCustomerIdFromPayload(eventSchema, pay)

    try {
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
      setPersonalizationData(snap.data)
      setDisplaySource('refreshed')
      setHasEverRefreshed(true)
    } finally {
      setLoading(false)
    }
  }, [dispatch, eventId, eventName, eventSchema, store])

  const resetToDefaultExperience = useCallback(() => {
    if (!hasEverRefreshed) return
    setDisplaySource('default')
  }, [hasEverRefreshed])

  const handleTrigger = () => {
    const raw = payload ?? buildDefaultPayload(eventSchema, eventName)
    const aligned = withEventTypeFirst(
      eventName,
      alignPayloadToMockSchema(eventSchema, raw),
    )
    triggerPublish(eventId, aligned, eventName)
  }

  const handleSummaryTrigger = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault()
    e.stopPropagation()
    handleTrigger()
  }

  const stopSummaryToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const forceDefault = displaySource === 'default'

  return (
    <details
      className="card mock-experience-card mock-experience-v2-card"
      style={getEventThemeStyle(eventId)}
      open={cardExpanded}
      onToggle={(e) => {
        if (e.target !== e.currentTarget) return
        e.preventDefault()
        dispatch(
          setExperienceV2CardExpanded({
            eventId,
            expanded: !cardExpanded,
          }),
        )
      }}
    >
      <summary className="mock-experience-v2-summary">
        <div className="mock-experience-v2-summary-inner">
          <span className="mock-experience-v2-disclosure" aria-hidden="true" />
          <div className="mock-experience-v2-summary-titles">
            <h2 className="mock-experience-card-event-name">
              Event Name: {eventName}
            </h2>
          </div>
          <button
            type="button"
            className="btn btn-primary mock-experience-v2-summary-trigger mock-event-trigger-btn"
            disabled={backend && publishPending}
            onClick={handleSummaryTrigger}
          >
            Trigger {eventName} Event
          </button>
        </div>

        {showRefresh && (
          <div
            className="mock-experience-v2-summary-actions"
            onClick={stopSummaryToggle}
          >
            {awaitingRefresh && !loading && !hasEverRefreshed && (
              <p className="muted small mock-experience-live-placeholder">
                Publish succeeded — use <strong>Refresh Experience</strong> when
                you want to fetch personalization for this card.
              </p>
            )}
            <div className="mock-experience-refresh-row mock-experience-v2-summary-refresh-row">
              <button
                type="button"
                className="btn btn-primary mock-event-trigger-btn"
                disabled={loading}
                onClick={(e) => {
                  e.stopPropagation()
                  void runRefresh()
                }}
              >
                Refresh Experience
              </button>
              <button
                type="button"
                className="btn btn-primary mock-event-trigger-btn"
                disabled={!hasEverRefreshed || loading}
                onClick={(e) => {
                  e.stopPropagation()
                  resetToDefaultExperience()
                }}
                title="Show saved Static Content for every cell using the same personalization response (no new API call)"
              >
                Reset to Default Experience
              </button>
              {awaitingRefresh && !loading && (
                <span className="muted small mock-experience-refresh-hint">
                  Recommended after your latest trigger.
                </span>
              )}
            </div>
          </div>
        )}
      </summary>

      <div className="mock-experience-v2-body">
        <MockExperienceV2LiveRegion
          rows={rows}
          staticContent={staticContent}
          dynamicConfig={dynamicConfig}
          personalizationData={personalizationData}
          loading={loading}
          forceDefault={forceDefault}
        />

        {publishStatus[eventId] && (
          <details className="mock-event-collapsible">
            <summary className="mock-event-collapsible-summary">
              Trigger result <span className="muted">(JSON)</span>
            </summary>
            <pre className="result-block mock-event-collapsible-pre">
              {publishStatus[eventId]}
            </pre>
          </details>
        )}
      </div>
    </details>
  )
}
