import { useMemo } from 'react'
import { getAtPath } from '../lib/path'
import {
  normalizeRulesFieldPath,
  wrapPersonalizationProfileRoot,
} from '../lib/personalizationFieldPath'
import { resolveV2Cell, staticBlockFor } from '../lib/experienceResolveV2'
import type {
  V2DynamicConfig,
  V2DynamicTargetSide,
} from '../store/eventDynamicTargetsSlice'
import type { PageStructureRow } from '../store/pageStructureSlice'
import type { StaticContent } from '../store/staticContentSlice'

type Props = {
  rows: PageStructureRow[]
  staticContent: StaticContent | undefined
  dynamicConfig: V2DynamicConfig | undefined
  /** Resolved Personalization value at the configured field path; omit when showing default-only view. */
  personalizationData: unknown
  loading: boolean
  forceDefault: boolean
}

export function MockExperienceV2LiveRegion({
  rows,
  staticContent,
  dynamicConfig,
  personalizationData,
  loading,
  forceDefault,
}: Props) {
  const fullFieldPath =
    dynamicConfig ? normalizeRulesFieldPath(dynamicConfig.fieldPath) : ''
  const keyVal = useMemo(() => {
    if (!fullFieldPath) return undefined
    if (forceDefault) return undefined
    return getAtPath(
      wrapPersonalizationProfileRoot(personalizationData),
      fullFieldPath,
    )
  }, [fullFieldPath, personalizationData, forceDefault])

  const cellLabel = (rowIdx: number, side: V2DynamicTargetSide) =>
    side === null
      ? `Row ${rowIdx + 1}`
      : `Row ${rowIdx + 1} · ${side === 'A' ? 'A' : 'B'}`

  return (
    <div className="mock-experience-live-region mock-experience-v2-live-region">
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
