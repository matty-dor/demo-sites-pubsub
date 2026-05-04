import { useCallback, useEffect, useRef, useState } from 'react'
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

type Phase = 'unset' | 'loading' | 'ready'

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

  const [phase, setPhase] = useState<Phase>('unset')
  const [liveView, setLiveView] = useState<LiveExperienceView | null>(null)
  /** Last profile payload from Refresh — reused so Reset applies defaults without a new API call. */
  const lastPersonalizationDataRef = useRef<unknown>(undefined)
  const hasCompletedRefreshRef = useRef(false)

  useEffect(() => {
    lastPersonalizationDataRef.current = undefined
    hasCompletedRefreshRef.current = false
    setPhase('unset')
    setLiveView(null)
  }, [eventId])

  const showRefresh =
    Boolean(awaitingRefresh) || phase === 'ready' || phase === 'loading'

  const runRefresh = useCallback(async () => {
    setPhase('loading')
    setLiveView(null)

    const state = store.getState() as RootState
    const payload =
      state.eventPayloads.byEventId[eventId] ?? buildDefaultPayload(eventSchema)
    const cid = extractCustomerIdFromPayload(eventSchema, payload)

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

    lastPersonalizationDataRef.current = snap.data
    hasCompletedRefreshRef.current = true
    const view = resolveLiveExperience(rules, snap.data)
    setLiveView(view)
    setPhase('ready')
  }, [dispatch, eventId, eventSchema, rules, store])

  const resetToDefaultExperience = useCallback(() => {
    if (!hasCompletedRefreshRef.current) return
    setLiveView(
      resolveLiveExperience(rules, lastPersonalizationDataRef.current, {
        forceDefault: true,
      }),
    )
  }, [rules])

  return (
    <div className="mock-experience-live-region">
      <h3 className="dynamic-rules-subheading mock-experience-live-heading">Live experience</h3>
      <p className="muted small mock-experience-live-lede">
        After a successful trigger, refresh calls the Personalization API using{' '}
        <strong>customer_id</strong> from this event&apos;s payload (same values as on the Mock
        Events card), resolves <code>{rules.fieldPath || '…'}</code>, and renders one outcome — no
        default-then-swap flash.
      </p>

      {phase === 'unset' && !awaitingRefresh && (
        <p className="muted small mock-experience-live-placeholder">
          Trigger this event first. When publish succeeds, use <strong>Refresh Experience</strong>{' '}
          to load content from the Personalization API.
        </p>
      )}

      {phase === 'unset' && awaitingRefresh && (
        <p className="muted small mock-experience-live-placeholder">
          Publish succeeded — click <strong>Refresh Experience</strong> to fetch personalization and
          render this card.
        </p>
      )}

      {phase === 'loading' && (
        <div className="mock-experience-live-loading" aria-busy="true">
          <div className="mock-experience-live-skeleton" />
          <span className="muted small">Loading personalization…</span>
        </div>
      )}

      {phase === 'ready' && liveView && <LiveRender view={liveView} />}

      {showRefresh && (
        <div className="mock-experience-refresh-row">
          <button
            type="button"
            className="btn btn-secondary"
            disabled={phase === 'loading'}
            onClick={() => void runRefresh()}
          >
            Refresh Experience
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={phase !== 'ready'}
            onClick={resetToDefaultExperience}
            title="Show saved default content using the same personalization response (no new API call)"
          >
            Reset to Default Experience
          </button>
          {awaitingRefresh && phase !== 'loading' && (
            <span className="muted small mock-experience-refresh-hint">
              Recommended after your latest trigger.
            </span>
          )}
        </div>
      )}
    </div>
  )
}
