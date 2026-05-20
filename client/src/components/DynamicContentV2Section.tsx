import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  API_VALUE_TEMPLATE_HINT,
  interpolateApiValues,
} from '../lib/apiValueTemplate'
import {
  firstActiveConditionValue,
  isConditionActive,
  mappingConditionsMatch,
  resolvedValuesByPathSuffix,
} from '../lib/mappingConditions'
import {
  fieldPathSuffixFromStored,
  normalizeRulesFieldPath,
  wrapPersonalizationProfileRoot,
} from '../lib/personalizationFieldPath'
import { getAtPath } from '../lib/path'
import {
  COMPARISON_OPERATORS,
  type ComparisonOperator,
  OPERATOR_LABELS,
  operatorUsesExampleThreshold,
} from '../lib/ruleMatch'
import { isValidHttpUrl } from '../lib/urlValidation'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  emptyV2MappingCondition,
  emptyV2StaticMapping,
  newV2DynamicTarget,
  normalizeV2DynamicConfig,
  setDynamicTargetsForEvent,
  type V2DynamicConfig,
  type V2DynamicTarget,
  type V2DynamicTargetSide,
  type V2MappingCondition,
  type V2StaticContentType,
  type V2StaticMappingRow,
} from '../store/eventDynamicTargetsSlice'
import type { PageStructureRow } from '../store/pageStructureSlice'
import type {
  StaticBlockContent,
  StaticContent,
} from '../store/staticContentSlice'

type Props = {
  eventId: string
}

// ---------- helpers ----------

function targetSlotKey(rowId: string, side: V2DynamicTargetSide): string {
  return `${rowId}::${side ?? 'full'}`
}

function reconcileTargetsToStructure(
  targets: V2DynamicTarget[],
  rows: PageStructureRow[],
): V2DynamicTarget[] {
  return targets.filter((t) => {
    const row = rows.find((r) => r.id === t.rowId)
    if (!row) return false
    if (row.layout === 'full') return t.side === null
    return t.side === 'A' || t.side === 'B'
  })
}

type AvailableSlot = {
  key: string
  rowId: string
  side: V2DynamicTargetSide
  label: string
}

function computeAvailableSlots(
  rows: PageStructureRow[],
  targets: V2DynamicTarget[],
): AvailableSlot[] {
  const occupied = new Set(targets.map((t) => targetSlotKey(t.rowId, t.side)))
  const slots: AvailableSlot[] = []
  rows.forEach((row, idx) => {
    if (row.layout === 'full') {
      slots.push({
        key: targetSlotKey(row.id, null),
        rowId: row.id,
        side: null,
        label: `Row ${idx + 1} · Full-Width`,
      })
    } else {
      slots.push(
        {
          key: targetSlotKey(row.id, 'A'),
          rowId: row.id,
          side: 'A',
          label: `Row ${idx + 1} · 50-50 · Side A`,
        },
        {
          key: targetSlotKey(row.id, 'B'),
          rowId: row.id,
          side: 'B',
          label: `Row ${idx + 1} · 50-50 · Side B`,
        },
      )
    }
  })
  return slots.filter((s) => !occupied.has(s.key))
}

function targetLabelFor(
  target: V2DynamicTarget,
  rows: PageStructureRow[],
): string {
  const idx = rows.findIndex((r) => r.id === target.rowId)
  const row = idx >= 0 ? rows[idx] : null
  if (!row) return 'Removed row'
  if (row.layout === 'full') return `Row ${idx + 1} · Full-Width`
  return `Row ${idx + 1} · 50-50 · Side ${target.side ?? '?'}`
}

function blockIndexForSide(side: V2DynamicTargetSide): number {
  return side === 'B' ? 1 : 0
}

function staticBlockFor(
  staticContent: StaticContent | undefined,
  rowId: string,
  side: V2DynamicTargetSide,
): StaticBlockContent | undefined {
  if (!staticContent) return undefined
  const blocks = staticContent.byRowId[rowId]
  if (!blocks) return undefined
  return blocks[blockIndexForSide(side)]
}

type ResolvedPreview =
  | { kind: 'empty'; placeholder: string }
  | { kind: 'text'; text: string }
  | { kind: 'image'; url: string }
  | { kind: 'invalidImage' }

/**
 * Compute what to render for a single page-structure cell:
 * - First, evaluate the cell's dynamic mappings (if any); all conditions per variation must
 *   match (AND). The first matching variation wins.
 * - Matched text Content supports `{{api_value}}` and `{{api_value:path}}` tokens.
 * - Otherwise, fall back to the corresponding Static Content block (no interpolation).
 * - Otherwise, render an empty placeholder using `cellLabel`.
 */
function resolvePreviewForCell(
  target: V2DynamicTarget | undefined,
  staticBlock: StaticBlockContent | undefined,
  personalizationData: unknown,
  cellLabel: string,
): ResolvedPreview {
  if (target) {
    const match = target.staticMappings.find((m) =>
      mappingConditionsMatch(personalizationData, m.conditions),
    )
    if (match && match.content.trim()) {
      const c = match.content.trim()
      if (match.contentType === 'text') {
        const valuesBySuffix = resolvedValuesByPathSuffix(
          personalizationData,
          match.conditions,
        )
        const firstVal = firstActiveConditionValue(
          personalizationData,
          match.conditions,
        )
        return {
          kind: 'text',
          text: interpolateApiValues(c, valuesBySuffix, firstVal),
        }
      }
      if (!isValidHttpUrl(c)) return { kind: 'invalidImage' }
      return { kind: 'image', url: c }
    }
  }
  if (staticBlock) {
    const c = staticBlock.content.trim()
    if (c) {
      if (staticBlock.contentType === 'text') return { kind: 'text', text: c }
      if (!isValidHttpUrl(c)) return { kind: 'invalidImage' }
      return { kind: 'image', url: c }
    }
  }
  return { kind: 'empty', placeholder: cellLabel }
}

const previewHint =
  'Preview uses the simulated Personalization response from the Personalization API page (local mode). Cells without a dynamic target fall back to their Static Content value.'

// ---------- component ----------

export function DynamicContentV2Section({ eventId }: Props) {
  const dispatch = useAppDispatch()
  const stored = useAppSelector(
    (s) => s.eventDynamicTargets.byEventId[eventId],
  )
  const structureRows = useAppSelector(
    (s) => s.pageStructure.byEventId[eventId]?.rows ?? [],
  )
  const staticContent = useAppSelector(
    (s) => s.staticContent.byEventId[eventId],
  )
  const simData = useAppSelector(
    (s) => s.simulator.personalizationResponse?.data,
  )
  const personalizationResponse = useAppSelector(
    (s) => s.simulator.personalizationResponse,
  )
  const lastPersonalizationFetchedAt = useAppSelector(
    (s) => s.simulator.lastPersonalizationFetchedAt,
  )

  const [showPersonalizationPeek, setShowPersonalizationPeek] = useState(false)
  const [targets, setTargets] = useState<V2DynamicTarget[]>([])
  const [openTargetIds, setOpenTargetIds] = useState<Set<string>>(
    () => new Set(),
  )
  const [inputsCollapsed, setInputsCollapsed] = useState(false)
  const [saveFlash, setSaveFlash] = useState(false)
  const [validationError, setValidationError] = useState<string | null>(null)
  const [pendingSlotKey, setPendingSlotKey] = useState('')

  // Hydrate from the persisted v2 config whenever we switch events or stored data updates.
  useEffect(() => {
    const normalized = normalizeV2DynamicConfig(stored)
    const reconciled = reconcileTargetsToStructure(
      normalized.targets,
      structureRows,
    )
    setTargets(reconciled)
    setOpenTargetIds(new Set(reconciled.map((t) => t.id)))
    setValidationError(null)
    // structureRows intentionally omitted — see the dedicated effect below for keeping
    // targets in sync with structure changes after the initial hydrate.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, stored])

  // Keep targets aligned with the live page structure (drop targets whose row was
  // deleted or whose layout changed in an incompatible way).
  useEffect(() => {
    setTargets((prev) => {
      const reconciled = reconcileTargetsToStructure(prev, structureRows)
      return reconciled.length === prev.length ? prev : reconciled
    })
  }, [structureRows])

  const availableSlots = useMemo(
    () => computeAvailableSlots(structureRows, targets),
    [structureRows, targets],
  )

  const resolvedPathsPreview = useMemo(() => {
    const paths = new Set<string>()
    for (const t of targets) {
      for (const m of t.staticMappings) {
        for (const c of m.conditions) {
          if (isConditionActive(c)) {
            paths.add(normalizeRulesFieldPath(c.fieldPath))
          }
        }
      }
    }
    const root = wrapPersonalizationProfileRoot(simData)
    return [...paths].sort().map((path) => ({
      path,
      value: getAtPath(root, path),
    }))
  }, [targets, simData])

  function setMapping(
    targetId: string,
    mappingIdx: number,
    patch: Partial<V2StaticMappingRow>,
  ) {
    setTargets((prev) =>
      prev.map((t) =>
        t.id === targetId ?
          {
            ...t,
            staticMappings: t.staticMappings.map((m, i) =>
              i === mappingIdx ? { ...m, ...patch } : m,
            ),
          }
        : t,
      ),
    )
  }

  function addMapping(targetId: string) {
    setTargets((prev) =>
      prev.map((t) =>
        t.id === targetId ?
          {
            ...t,
            staticMappings: [...t.staticMappings, emptyV2StaticMapping()],
          }
        : t,
      ),
    )
  }

  function removeMapping(targetId: string, mappingIdx: number) {
    setTargets((prev) =>
      prev.map((t) =>
        t.id === targetId ?
          {
            ...t,
            staticMappings: t.staticMappings.filter((_, i) => i !== mappingIdx),
          }
        : t,
      ),
    )
  }

  function setCondition(
    targetId: string,
    mappingIdx: number,
    conditionIdx: number,
    patch: Partial<V2MappingCondition>,
  ) {
    setTargets((prev) =>
      prev.map((t) => {
        if (t.id !== targetId) return t
        return {
          ...t,
          staticMappings: t.staticMappings.map((m, mi) => {
            if (mi !== mappingIdx) return m
            return {
              ...m,
              conditions: m.conditions.map((c, ci) => {
                if (ci !== conditionIdx) return c
                const next = { ...c, ...patch }
                if (patch.fieldPath !== undefined) {
                  next.fieldPath = normalizeRulesFieldPath(patch.fieldPath)
                }
                return next
              }),
            }
          }),
        }
      }),
    )
  }

  function addCondition(targetId: string, mappingIdx: number) {
    setTargets((prev) =>
      prev.map((t) => {
        if (t.id !== targetId) return t
        return {
          ...t,
          staticMappings: t.staticMappings.map((m, mi) => {
            if (mi !== mappingIdx) return m
            const seed =
              m.conditions[0]?.fieldPath ??
              emptyV2MappingCondition().fieldPath
            return {
              ...m,
              conditions: [
                ...m.conditions,
                { ...emptyV2MappingCondition(), fieldPath: seed },
              ],
            }
          }),
        }
      }),
    )
  }

  function removeCondition(
    targetId: string,
    mappingIdx: number,
    conditionIdx: number,
  ) {
    setTargets((prev) =>
      prev.map((t) => {
        if (t.id !== targetId) return t
        return {
          ...t,
          staticMappings: t.staticMappings.map((m, mi) => {
            if (mi !== mappingIdx) return m
            if (m.conditions.length <= 1) return m
            return {
              ...m,
              conditions: m.conditions.filter((_, ci) => ci !== conditionIdx),
            }
          }),
        }
      }),
    )
  }

  function removeTarget(targetId: string) {
    setTargets((prev) => prev.filter((t) => t.id !== targetId))
    setOpenTargetIds((prev) => {
      if (!prev.has(targetId)) return prev
      const next = new Set(prev)
      next.delete(targetId)
      return next
    })
  }

  function addTargetFromPendingSlot() {
    const slot = availableSlots.find((s) => s.key === pendingSlotKey)
    if (!slot) return
    const t = newV2DynamicTarget(slot.rowId, slot.side)
    setTargets((prev) => [...prev, t])
    setOpenTargetIds((prev) => {
      const next = new Set(prev)
      next.add(t.id)
      return next
    })
    setPendingSlotKey('')
  }

  function validateBeforeSave(): string | null {
    for (let ti = 0; ti < targets.length; ti++) {
      const t = targets[ti]
      for (let mi = 0; mi < t.staticMappings.length; mi++) {
        const m = t.staticMappings[mi]
        if (
          m.contentType === 'imageUrl' &&
          m.content.trim() &&
          !isValidHttpUrl(m.content)
        ) {
          return `Target ${ti + 1}, Content Variation ${mi + 1}: Content must be a valid http(s) image URL when Content Type is Image URL.`
        }
      }
    }
    return null
  }

  function save() {
    setValidationError(null)
    const err = validateBeforeSave()
    if (err) {
      setValidationError(err)
      return
    }
    const config: V2DynamicConfig = {
      contentSourceMode: 'static',
      targets,
    }
    dispatch(setDynamicTargetsForEvent({ eventId, config }))
    setSaveFlash(true)
    window.setTimeout(() => setSaveFlash(false), 2000)
  }

  return (
    <div className="mock-event-collapsible-inner dynamic-rules-inner v2-dynamic-section">
      {validationError && (
        <div className="banner banner-error dynamic-rules-saved">
          {validationError}
        </div>
      )}

      <div className="stack-label-row field-path-label-row v2-dynamic-peek-row">
        <span className="muted small">
          Each content variation can require one or more field paths (all must match).
        </span>
          <button
            type="button"
            className="link-button field-path-peek-toggle"
            aria-expanded={showPersonalizationPeek}
            onClick={(e) => {
              e.preventDefault()
              setShowPersonalizationPeek((v) => !v)
            }}
          >
            {showPersonalizationPeek ? 'Hide' : 'Display'} the most recent
            Personalization API response
          </button>
        </div>
        {showPersonalizationPeek && (
          <div className="field-path-personalization-peek">
            {lastPersonalizationFetchedAt && personalizationResponse ?
              <pre className="result-block field-path-peek-pre">
                {JSON.stringify(personalizationResponse, null, 2)}
              </pre>
            : <p className="muted small field-path-peek-empty">
                No recent Personalization API response yet.{' '}
                <Link to="/personalization" className="link-inline">
                  Click here to call the Personalization API.
                </Link>
              </p>
            }
          </div>
        )}

      <h3 className="dynamic-rules-subheading">Content Variations</h3>

      <div
        className={`dynamic-targets-editor${inputsCollapsed ? ' inputs-collapsed' : ''}`}
      >
          <div className="dynamic-targets-toolbar">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => setInputsCollapsed((v) => !v)}
              aria-pressed={inputsCollapsed}
              title={
                inputsCollapsed ?
                  'Show the content inputs'
                : 'Hide the inputs to give the preview full width'
              }
            >
              {inputsCollapsed ? 'Show inputs' : 'Collapse inputs'}
            </button>
            {saveFlash && (
              <span className="muted small static-content-save-flash">
                Saved.
              </span>
            )}
          </div>

          {structureRows.length === 0 ?
            <p className="muted small">
              Configure rows in the <strong>Page Structure</strong> section
              above first, then return here to add dynamic targets.
            </p>
          : <div className="dynamic-targets-grid">
              <div className="dynamic-targets-controls">
                {targets.length === 0 && (
                  <p className="muted small">
                    No dynamic targets yet. Use the picker below to add one.
                  </p>
                )}

                {targets.map((target) => {
                  const isOpen = openTargetIds.has(target.id)
                  const label = targetLabelFor(target, structureRows)
                  return (
                    <details
                      key={target.id}
                      className="dynamic-target-editor"
                      open={isOpen}
                      onToggle={(e) => {
                        const willOpen = e.currentTarget.open
                        setOpenTargetIds((prev) => {
                          const next = new Set(prev)
                          if (willOpen) next.add(target.id)
                          else next.delete(target.id)
                          return next
                        })
                      }}
                    >
                      <summary className="dynamic-target-head">
                        <span className="page-structure-row-label">
                          {label}
                        </span>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={(e) => {
                            e.preventDefault()
                            removeTarget(target.id)
                          }}
                          aria-label={`Remove dynamic target for ${label}`}
                        >
                          Remove target
                        </button>
                      </summary>
                      <div className="dynamic-target-body">
                        {target.staticMappings.length === 0 && (
                          <p className="muted small">
                            No content variations yet for this target. Click
                            “Add mapping” to add one.
                          </p>
                        )}
                        {target.staticMappings.map((m, mi) => (
                          <div key={mi} className="content-variation-block">
                            <div className="content-variation-head">
                              <h4 className="dynamic-rules-variation-heading">
                                Content Variation {mi + 1}
                              </h4>
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => removeMapping(target.id, mi)}
                                aria-label={`Remove Content Variation ${mi + 1}`}
                              >
                                Remove
                              </button>
                            </div>
                            <div className="v2-mapping-conditions">
                              <p className="muted small v2-mapping-conditions-lede">
                                When <strong>all</strong> of the following match:
                              </p>
                              {m.conditions.map((cond, ci) => (
                                <div
                                  key={ci}
                                  className="v2-mapping-condition-row mapping-row-static dynamic-target-mapping-grid"
                                >
                                  <label className="stack-label mapping-cell v2-condition-path-cell">
                                    <span className="muted small">Field path</span>
                                    <div className="panel-title-field">
                                      <span
                                        className="panel-title-prefix"
                                        title="Always under the response data object"
                                      >
                                        data.
                                      </span>
                                      <input
                                        className="input panel-title-suffix"
                                        value={fieldPathSuffixFromStored(
                                          cond.fieldPath,
                                        )}
                                        onChange={(e) =>
                                          setCondition(target.id, mi, ci, {
                                            fieldPath: e.target.value,
                                          })
                                        }
                                        placeholder="segment or tier"
                                        aria-label={`Condition ${ci + 1} path under data`}
                                        autoComplete="off"
                                      />
                                    </div>
                                  </label>
                                  <label className="stack-label mapping-cell">
                                    <span className="muted small">Operator</span>
                                    <select
                                      className="input"
                                      value={cond.operator}
                                      onChange={(e) =>
                                        setCondition(target.id, mi, ci, {
                                          operator: e.target
                                            .value as ComparisonOperator,
                                        })
                                      }
                                    >
                                      {COMPARISON_OPERATORS.map((op) => (
                                        <option key={op} value={op}>
                                          {OPERATOR_LABELS[op]}
                                        </option>
                                      ))}
                                    </select>
                                  </label>
                                  <label className="stack-label mapping-cell">
                                    <span className="muted small">
                                      Example API Response Value
                                    </span>
                                    <input
                                      className="input"
                                      placeholder={
                                        operatorUsesExampleThreshold(cond.operator)
                                          ? 'Compare to this value (e.g. luxury or 10)'
                                          : 'Not used for Is null / Is not null'
                                      }
                                      value={cond.value}
                                      disabled={
                                        !operatorUsesExampleThreshold(cond.operator)
                                      }
                                      aria-disabled={
                                        !operatorUsesExampleThreshold(cond.operator) ||
                                        undefined
                                      }
                                      onChange={(e) =>
                                        setCondition(target.id, mi, ci, {
                                          value: e.target.value,
                                        })
                                      }
                                    />
                                  </label>
                                  {m.conditions.length > 1 && (
                                    <div className="v2-condition-remove-cell">
                                      <button
                                        type="button"
                                        className="btn btn-secondary btn-small"
                                        onClick={() =>
                                          removeCondition(target.id, mi, ci)
                                        }
                                        aria-label={`Remove condition ${ci + 1}`}
                                      >
                                        Remove condition
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ))}
                              <button
                                type="button"
                                className="btn btn-secondary btn-small"
                                onClick={() => addCondition(target.id, mi)}
                              >
                                Add condition
                              </button>
                            </div>
                            <div className="mapping-row-static dynamic-target-mapping-grid v2-variation-content-grid">
                              <label className="stack-label mapping-cell">
                                <span className="muted small">
                                  Content Type
                                </span>
                                <select
                                  className="input"
                                  value={m.contentType}
                                  onChange={(e) =>
                                    setMapping(target.id, mi, {
                                      contentType: e.target
                                        .value as V2StaticContentType,
                                    })
                                  }
                                >
                                  <option value="text">Text</option>
                                  <option value="imageUrl">Image URL</option>
                                </select>
                              </label>
                              <label className="stack-label mapping-cell dynamic-target-content-cell">
                                <span className="muted small">Content</span>
                                {m.contentType === 'text' ?
                                  <>
                                    <span className="muted small dynamic-target-content-hint">
                                      {API_VALUE_TEMPLATE_HINT}
                                    </span>
                                    <textarea
                                      className="input textarea textarea-compact"
                                      rows={3}
                                      placeholder="Place content here"
                                      value={m.content}
                                      onChange={(e) =>
                                        setMapping(target.id, mi, {
                                          content: e.target.value,
                                        })
                                      }
                                    />
                                  </>
                                : <input
                                    className={`input ${m.content.trim() && !isValidHttpUrl(m.content) ? 'input-invalid' : ''}`}
                                    type="url"
                                    inputMode="url"
                                    placeholder="https://…"
                                    value={m.content}
                                    onChange={(e) =>
                                      setMapping(target.id, mi, {
                                        content: e.target.value,
                                      })
                                    }
                                  />
                                }
                              </label>
                            </div>
                          </div>
                        ))}
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => addMapping(target.id)}
                        >
                          Add mapping
                        </button>
                      </div>
                    </details>
                  )
                })}

                <div className="dynamic-target-add-row">
                  {availableSlots.length === 0 ?
                    <p className="muted small">
                      Every page-structure cell already has a dynamic target.
                      Remove a target above to free up a cell.
                    </p>
                  : <>
                      <label className="stack-label dynamic-target-add-select">
                        <span className="muted small">Add a target</span>
                        <select
                          className="input"
                          value={pendingSlotKey}
                          onChange={(e) => setPendingSlotKey(e.target.value)}
                          aria-label="Select a row and side to add a dynamic target"
                        >
                          <option value="">
                            Select a row to add a target…
                          </option>
                          {availableSlots.map((slot) => (
                            <option key={slot.key} value={slot.key}>
                              {slot.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={addTargetFromPendingSlot}
                        disabled={!pendingSlotKey}
                      >
                        Add target
                      </button>
                    </>
                  }
                </div>

                <div className="dynamic-targets-actions">
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={save}
                  >
                    Save Dynamic Content
                  </button>
                </div>
              </div>

              <div className="dynamic-targets-preview">
                <div className="muted small">{previewHint}</div>
                {resolvedPathsPreview.length > 0 ?
                  <ul className="v2-resolved-paths-preview muted small">
                    {resolvedPathsPreview.map(({ path, value }) => (
                      <li key={path}>
                        Resolved <code>{path}</code> ={' '}
                        <code>
                          {value === undefined || value === null ?
                            '(empty)'
                          : String(value)}
                        </code>
                      </li>
                    ))}
                  </ul>
                : <div className="muted small">
                    Add field paths on a variation to see resolved values here.
                  </div>
                }
                {structureRows.map((row, rowIdx) => {
                  const slotsForRow: V2DynamicTargetSide[] =
                    row.layout === 'full' ? [null] : ['A', 'B']
                  return (
                    <div
                      key={row.id}
                      className={`page-structure-preview-row page-structure-preview-row-${row.layout}`}
                      aria-label={`Row ${rowIdx + 1} preview`}
                    >
                      {slotsForRow.map((side, blockIdx) => {
                        const target = targets.find(
                          (t) => t.rowId === row.id && t.side === side,
                        )
                        const sb = staticBlockFor(staticContent, row.id, side)
                        const cellLabel =
                          row.layout === 'full' ?
                            `Row ${rowIdx + 1}`
                          : `Row ${rowIdx + 1} · ${side === 'A' ? 'A' : 'B'}`
                        const resolved = resolvePreviewForCell(
                          target,
                          sb,
                          simData,
                          cellLabel,
                        )
                        return (
                          <div
                            key={blockIdx}
                            className="page-structure-preview-block static-content-preview-block dynamic-targets-preview-block"
                          >
                            {target && (
                              <span
                                className="dynamic-targets-preview-badge"
                                title="A dynamic target is configured for this cell"
                              >
                                Dynamic
                              </span>
                            )}
                            {resolved.kind === 'empty' ?
                              <span className="muted small">
                                {resolved.placeholder}
                              </span>
                            : resolved.kind === 'text' ?
                              <span className="static-content-preview-text">
                                {resolved.text}
                              </span>
                            : resolved.kind === 'image' ?
                              <img
                                src={resolved.url}
                                alt={cellLabel}
                                className="static-content-preview-image"
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
                })}
              </div>
            </div>
          }
        </div>
    </div>
  )
}
