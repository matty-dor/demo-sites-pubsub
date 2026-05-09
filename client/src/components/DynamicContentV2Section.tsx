import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  fieldPathSuffixFromStored,
  normalizeRulesFieldPath,
  wrapPersonalizationProfileRoot,
} from '../lib/personalizationFieldPath'
import { getAtPath } from '../lib/path'
import {
  COMPARISON_OPERATORS,
  type ComparisonOperator,
  mappingRowMatches,
  OPERATOR_LABELS,
} from '../lib/ruleMatch'
import { isValidHttpUrl } from '../lib/urlValidation'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  emptyV2StaticMapping,
  newV2DynamicTarget,
  normalizeV2DynamicConfig,
  setDynamicTargetsForEvent,
  type V2ContentSourceMode,
  type V2DynamicConfig,
  type V2DynamicTarget,
  type V2DynamicTargetSide,
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
 * - First, evaluate the cell's dynamic mappings (if any) against the resolved key value;
 *   the first match wins.
 * - Otherwise, fall back to the corresponding Static Content block.
 * - Otherwise, render an empty placeholder using `cellLabel`.
 */
function resolvePreviewForCell(
  target: V2DynamicTarget | undefined,
  staticBlock: StaticBlockContent | undefined,
  keyVal: unknown,
  cellLabel: string,
): ResolvedPreview {
  if (target) {
    const match = target.staticMappings.find((m) =>
      mappingRowMatches(keyVal, m.operator, m.value),
    )
    if (match && match.content.trim()) {
      const c = match.content.trim()
      if (match.contentType === 'text') return { kind: 'text', text: c }
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

const radioHelp =
  'Will your content contain the value from your event payload (dynamic), or will the content be hardcoded (static)? For example, if an event payload contained "cart_subtotal," and you want that value to appear in text like \u201CYou have {{cart_subtotal}} in your cart!\u201D, that would be dynamic. If you want something like \u201CYou\u2019ve qualified for free shipping!\u201D, that would be static.'

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

  const [contentSourceMode, setContentSourceMode] =
    useState<V2ContentSourceMode>('static')
  const [showPersonalizationPeek, setShowPersonalizationPeek] = useState(false)
  const [fieldPathSuffix, setFieldPathSuffix] = useState('')
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
    setContentSourceMode(normalized.contentSourceMode)
    setFieldPathSuffix(
      stored ? fieldPathSuffixFromStored(normalized.fieldPath) : '',
    )
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

  const fullFieldPath = normalizeRulesFieldPath(fieldPathSuffix)
  const resolvedRoot = wrapPersonalizationProfileRoot(simData)
  const keyVal = getAtPath(resolvedRoot, fullFieldPath)
  const keyStr = keyVal === undefined || keyVal === null ? '' : String(keyVal)

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
    const suf = fieldPathSuffix.trim().replace(/^\.+/, '')
    if (!suf) {
      return 'Field path must include at least one segment after data. (e.g. entity_id or audiences.31325.phone)'
    }
    if (contentSourceMode !== 'static') return null
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
      contentSourceMode,
      fieldPath: normalizeRulesFieldPath(fieldPathSuffix),
      targets: targets.map((t) => ({
        ...t,
        staticMappings: t.staticMappings.filter(
          (m) => m.value.trim() || m.content.trim(),
        ),
      })),
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

      <fieldset className="content-source-fieldset">
        <legend className="content-source-legend">Content source</legend>
        <p className="muted small content-source-help">{radioHelp}</p>
        <div className="radio-row">
          <label className="radio-option">
            <input
              type="radio"
              name={`content-source-v2-${eventId}`}
              checked={contentSourceMode === 'static'}
              onChange={() => setContentSourceMode('static')}
            />
            Static
          </label>
          <label className="radio-option">
            <input
              type="radio"
              name={`content-source-v2-${eventId}`}
              checked={contentSourceMode === 'flexible'}
              onChange={() => setContentSourceMode('flexible')}
            />
            Flexible
          </label>
        </div>
      </fieldset>

      <label className="stack-label">
        <div className="stack-label-row field-path-label-row">
          <span>Field path to target API Response value</span>
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
        <div className="panel-title-field">
          <span
            className="panel-title-prefix"
            title="Always under the response data object"
          >
            data.
          </span>
          <input
            className="input panel-title-suffix"
            value={fieldPathSuffix}
            onChange={(e) => setFieldPathSuffix(e.target.value)}
            placeholder="Refer to a Personalization API response to insert the proper field path."
            aria-label="Dot path under data (after data. prefix)"
            autoComplete="off"
          />
        </div>
      </label>

      <h3 className="dynamic-rules-subheading">Content Variations</h3>

      {contentSourceMode === 'flexible' ?
        <div className="dynamic-targets-flexible-placeholder">
          <p className="muted small">
            Flexible content variations are coming soon — they will let you
            interpolate event-payload values directly into your content (e.g.{' '}
            <code>{'You have {{cart_subtotal}} in your cart!'}</code>). Switch
            back to <strong>Static</strong> to configure variations now.
          </p>
        </div>
      : <div
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
                            <div className="mapping-row-static dynamic-target-mapping-grid">
                              <label className="stack-label mapping-cell">
                                <span className="muted small">Operator</span>
                                <select
                                  className="input"
                                  value={m.operator}
                                  onChange={(e) =>
                                    setMapping(target.id, mi, {
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
                                  placeholder="Compare to this value (e.g. luxury or 10)"
                                  value={m.value}
                                  onChange={(e) =>
                                    setMapping(target.id, mi, {
                                      value: e.target.value,
                                    })
                                  }
                                />
                              </label>
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
                <div className="muted small">
                  Resolved <code>{fullFieldPath}</code> ={' '}
                  <code>{keyStr || '(empty)'}</code>
                </div>
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
                          keyVal,
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
      }
    </div>
  )
}
