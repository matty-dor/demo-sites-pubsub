import { useCallback, useState } from 'react'
import { useStore } from 'react-redux'
import { backendStorageEnabled } from '../config/storageMode'
import { fetchPersonalizationSnapshot } from '../lib/personalizationClient'
import {
  resolveLiveExperience,
  type LiveExperienceView,
} from '../lib/experienceResolve'
import type { DynamicContentState } from '../store/eventDynamicRulesSlice'
import type { RootState } from '../store'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { clearExperienceAwaitingRefresh } from '../store/experienceRefreshSlice'
import { setSimulatedPersonalizationResponse } from '../store/simulatorSlice'

type Phase = 'unset' | 'loading' | 'ready'

type Props = {
  eventId: string
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

export function MockExperienceLiveRegion({ eventId, rules }: Props) {
  const backend = backendStorageEnabled()
  const dispatch = useAppDispatch()
  const store = useStore()
  const awaitingRefresh = useAppSelector(
    (s) => s.experienceRefresh.awaitingRefreshByEventId[eventId],
  )

  const [phase, setPhase] = useState<Phase>('unset')
  const [liveView, setLiveView] = useState<LiveExperienceView | null>(null)

  const showRefresh =
    Boolean(awaitingRefresh) || phase === 'ready' || phase === 'loading'

  const runRefresh = useCallback(async () => {
    setPhase('loading')
    setLiveView(null)

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

    const view = resolveLiveExperience(rules, snap.data)
    setLiveView(view)
    setPhase('ready')
  }, [backend, dispatch, eventId, rules, store])

  return (
    <div className="mock-experience-live-region">
      <h3 className="dynamic-rules-subheading mock-experience-live-heading">Live experience</h3>
      <p className="muted small mock-experience-live-lede">
        After a successful trigger, refresh loads the Personalization API (or simulated payload in
        local mode), resolves <code>{rules.fieldPath || '…'}</code>, and shows one outcome — no
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
