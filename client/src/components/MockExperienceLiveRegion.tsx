import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from 'react-redux'
import { extractCustomerIdFromPayload } from '../lib/customerIdFromPayload'
import { fetchPersonalizationSnapshot } from '../lib/personalizationClient'
import { buildDefaultPayload } from '../lib/schemaDefaults'
import {
  resolveLiveExperience,
  type LiveExperienceView,
} from '../lib/experienceResolve'
import type { DynamicContentState } from '../store/eventDynamicRulesSlice'
import type { SchemaNode } from '../types/schema'
import type { RootState } from '../store'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { clearExperienceAwaitingRefresh } from '../store/experienceRefreshSlice'
import { setSimulatedPersonalizationResponse } from '../store/simulatorSlice'

type DisplaySource = 'default' | 'refreshed'

type Props = {
  eventId: string
  /** Same schema as the mock event card — used to read customer_id from the shared payload store. */
  eventSchema: SchemaNode[]
  rules: DynamicContentState
}

function LiveRender({ view }: { view: LiveExperienceView }) {
  if (view.kind === 'static_text') {
    return (
      <div className="mock-experience-live-body">
        <p className="muted small mock-experience-live-meta">
          Showing {view.source === 'matched' ? 'matching rule' : 'default'} content
        </p>
        <div className="preview-text-box mock-experience-live-text">{view.text}</div>
      </div>
    )
  }
  if (view.kind === 'static_image') {
    return (
      <div className="mock-experience-live-body">
        <p className="muted small mock-experience-live-meta">
          Showing {view.source === 'matched' ? 'matching rule' : 'default'} content
        </p>
        <img
          src={view.url}
          alt=""
          className="preview-image mock-experience-live-image"
        />
      </div>
    )
  }
  if (view.kind === 'dynamic_image') {
    return (
      <div className="mock-experience-live-body">
        <p className="muted small mock-experience-live-meta">
          Showing {view.source === 'matched' ? 'matching rule' : 'default'} image
        </p>
        <img
          src={view.url}
          alt=""
          className="preview-image mock-experience-live-image"
        />
      </div>
    )
  }
  return (
    <div className="mock-experience-live-body">
      <p className="muted small">{view.message}</p>
    </div>
  )
}

export function MockExperienceLiveRegion({ eventId, eventSchema, rules }: Props) {
  const dispatch = useAppDispatch()
  const store = useStore()
  const awaitingRefresh = useAppSelector(
    (s) => s.experienceRefresh.awaitingRefreshByEventId[eventId],
  )

  const [personalizationData, setPersonalizationData] = useState<unknown>(undefined)
  const [displaySource, setDisplaySource] = useState<DisplaySource>('default')
  const [loading, setLoading] = useState(false)
  const [hasEverRefreshed, setHasEverRefreshed] = useState(false)

  useEffect(() => {
    setPersonalizationData(undefined)
    setDisplaySource('default')
    setHasEverRefreshed(false)
    setLoading(false)
  }, [eventId])

  const liveView = useMemo((): LiveExperienceView => {
    if (displaySource === 'default') {
      return resolveLiveExperience(rules, personalizationData, { forceDefault: true })
    }
    return resolveLiveExperience(rules, personalizationData)
  }, [rules, displaySource, personalizationData])

  const showRefresh = Boolean(awaitingRefresh) || loading || hasEverRefreshed

  const runRefresh = useCallback(async () => {
    setLoading(true)

    const state = store.getState() as RootState
    const payload =
      state.eventPayloads.byEventId[eventId] ?? buildDefaultPayload(eventSchema)
    const cid = extractCustomerIdFromPayload(eventSchema, payload)

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
  }, [dispatch, eventId, eventSchema, store])

  const resetToDefaultExperience = useCallback(() => {
    if (!hasEverRefreshed) return
    setDisplaySource('default')
  }, [hasEverRefreshed])

  return (
    <div className="mock-experience-live-region">
      <h3 className="dynamic-rules-subheading mock-experience-live-heading">Live experience</h3>
      <p className="muted small mock-experience-live-lede">
        Saved <strong>default</strong> content shows here immediately. After you trigger,{' '}
        <strong>Refresh Experience</strong> loads the Personalization API (via{' '}
        <strong>customer_id</strong> from this event&apos;s payload) and resolves{' '}
        <code>{rules.fieldPath || '…'}</code>
        — if the result differs from default, that outcome is shown.{' '}
        <strong>Reset to Default Experience</strong> returns to the saved default using the same last
        API response (no new request).
      </p>

      {awaitingRefresh && !loading && !hasEverRefreshed && (
        <p className="muted small mock-experience-live-placeholder">
          Publish succeeded — use <strong>Refresh Experience</strong> when you want to fetch
          personalization for this card.
        </p>
      )}

      {loading && (
        <div className="mock-experience-live-loading" aria-busy="true">
          <div className="mock-experience-live-skeleton" />
          <span className="muted small">Loading personalization…</span>
        </div>
      )}

      {!loading && <LiveRender view={liveView} />}

      {showRefresh && (
        <div className="mock-experience-refresh-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => void runRefresh()}
          >
            Refresh Experience
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={!hasEverRefreshed || loading}
            onClick={resetToDefaultExperience}
            title="Show saved default content using the same personalization response (no new API call)"
          >
            Reset to Default Experience
          </button>
          {awaitingRefresh && !loading && (
            <span className="muted small mock-experience-refresh-hint">
              Recommended after your latest trigger.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
