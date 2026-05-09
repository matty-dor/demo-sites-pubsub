import { useCallback, useEffect, useMemo, useState } from 'react'
import { useStore } from 'react-redux'
import { extractCustomerIdFromPayload } from '../lib/customerIdFromPayload'
import { fetchPersonalizationSnapshot } from '../lib/personalizationClient'
import { getAtPath } from '../lib/path'
import {
  normalizeRulesFieldPath,
  wrapPersonalizationProfileRoot,
} from '../lib/personalizationFieldPath'
import { resolveV2Cell, staticBlockFor } from '../lib/experienceResolveV2'
import { buildDefaultPayload } from '../lib/schemaDefaults'
import type { RootState } from '../store'
import type {
  V2DynamicConfig,
  V2DynamicTargetSide,
} from '../store/eventDynamicTargetsSlice'
import { clearExperienceAwaitingRefresh } from '../store/experienceRefreshSlice'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import type {
  PageStructureRow,
} from '../store/pageStructureSlice'
import { setSimulatedPersonalizationResponse } from '../store/simulatorSlice'
import type { StaticContent } from '../store/staticContentSlice'
import type { SchemaNode } from '../types/schema'

type DisplaySource = 'default' | 'refreshed'

type Props = {
  eventId: string
  eventName: string
  eventSchema: SchemaNode[]
  rows: PageStructureRow[]
  staticContent: StaticContent | undefined
  dynamicConfig: V2DynamicConfig | undefined
}

export function MockExperienceV2LiveRegion({
  eventId,
  eventName,
  eventSchema,
  rows,
  staticContent,
  dynamicConfig,
}: Props) {
  const dispatch = useAppDispatch()
  const store = useStore()
  const awaitingRefresh = useAppSelector(
    (s) => s.experienceRefresh.awaitingRefreshByEventId[eventId],
  )

  const [personalizationData, setPersonalizationData] =
    useState<unknown>(undefined)
  const [displaySource, setDisplaySource] = useState<DisplaySource>('default')
  const [loading, setLoading] = useState(false)
  const [hasEverRefreshed, setHasEverRefreshed] = useState(false)

  // Reset to a clean default view whenever we switch events.
  useEffect(() => {
    setPersonalizationData(undefined)
    setDisplaySource('default')
    setHasEverRefreshed(false)
    setLoading(false)
  }, [eventId])

  const fullFieldPath =
    dynamicConfig ? normalizeRulesFieldPath(dynamicConfig.fieldPath) : ''
  const keyVal = useMemo(() => {
    if (!fullFieldPath) return undefined
    if (displaySource === 'default') return undefined
    return getAtPath(wrapPersonalizationProfileRoot(personalizationData), fullFieldPath)
  }, [fullFieldPath, personalizationData, displaySource])

  const showRefresh = Boolean(awaitingRefresh) || loading || hasEverRefreshed

  const runRefresh = useCallback(async () => {
    setLoading(true)
    const state = store.getState() as RootState
    const payload =
      state.eventPayloads.byEventId[eventId] ??
      buildDefaultPayload(eventSchema, eventName)
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
  }, [dispatch, eventId, eventName, eventSchema, store])

  const resetToDefaultExperience = useCallback(() => {
    if (!hasEverRefreshed) return
    setDisplaySource('default')
  }, [hasEverRefreshed])

  const forceDefault = displaySource === 'default'

  const cellLabel = (rowIdx: number, side: V2DynamicTargetSide) =>
    side === null
      ? `Row ${rowIdx + 1}`
      : `Row ${rowIdx + 1} · ${side === 'A' ? 'A' : 'B'}`

  return (
    <div className="mock-experience-live-region mock-experience-v2-live-region">
      <h3 className="dynamic-rules-subheading mock-experience-live-heading">
        Live experience
      </h3>
      <p className="muted small mock-experience-live-lede">
        Saved <strong>Static Content</strong> renders immediately for every
        cell. After you trigger, <strong>Refresh Experience</strong> loads the
        Personalization API (via <strong>customer_id</strong> from this event’s
        payload) and resolves{' '}
        <code>{fullFieldPath || '(no field path saved)'}</code> per cell — any
        configured dynamic targets that match override their cell’s default.{' '}
        <strong>Reset to Default Experience</strong> returns to the saved
        Static Content using the same last API response (no new request).
      </p>

      {awaitingRefresh && !loading && !hasEverRefreshed && (
        <p className="muted small mock-experience-live-placeholder">
          Publish succeeded — use <strong>Refresh Experience</strong> when you
          want to fetch personalization for this card.
        </p>
      )}

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
      )}

      {loading ?
        <div className="mock-experience-live-loading" aria-busy="true">
          <div className="mock-experience-live-skeleton" />
          <span className="muted small">Loading personalization…</span>
        </div>
      : <div className="mock-experience-v2-stage">
          {rows.length === 0 ?
            <p className="muted small">
              No Page Structure saved for this event yet.
            </p>
          : rows.map((row, rowIdx) => {
              const sides: V2DynamicTargetSide[] =
                row.layout === 'full' ? [null] : ['A', 'B']
              return (
                <div
                  key={row.id}
                  className={`page-structure-preview-row page-structure-preview-row-${row.layout} mock-experience-v2-row`}
                  aria-label={`Row ${rowIdx + 1} preview`}
                >
                  {sides.map((side) => {
                    const target = dynamicConfig?.targets.find(
                      (t) => t.rowId === row.id && t.side === side,
                    )
                    const sb = staticBlockFor(staticContent, row.id, side)
                    const label = cellLabel(rowIdx, side)
                    const resolved = resolveV2Cell(target, sb, keyVal, label, {
                      forceDefault,
                    })
                    return (
                      <div
                        key={`${row.id}-${side ?? 'full'}`}
                        className="page-structure-preview-block static-content-preview-block mock-experience-v2-cell"
                      >
                        <span
                          className={`mock-experience-v2-cell-source mock-experience-v2-cell-source-${
                            'source' in resolved ? resolved.source : 'default'
                          }`}
                          title={
                            'source' in resolved && resolved.source === 'matched'
                              ? 'Resolved from a matching dynamic target mapping'
                              : 'Resolved from saved Static Content'
                          }
                        >
                          {'source' in resolved && resolved.source === 'matched'
                            ? 'Dynamic match'
                            : 'Default'}
                        </span>
                        {resolved.kind === 'empty' ?
                          <span className="muted small">
                            {resolved.placeholder}
                          </span>
                        : resolved.kind === 'text' ?
                          <span className="static-content-preview-text mock-experience-v2-cell-text">
                            {resolved.text}
                          </span>
                        : resolved.kind === 'image' ?
                          <img
                            src={resolved.url}
                            alt={label}
                            className="static-content-preview-image mock-experience-v2-cell-image"
                          />
                        : <span className="muted small">
                            Invalid image URL
                          </span>
                        }
                      </div>
                    )
                  })}
                </div>
              )
            })
          }
        </div>
      }
    </div>
  )
}
