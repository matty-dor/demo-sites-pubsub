import { useEffect, useState } from 'react'
import { isValidHttpUrl } from '../lib/urlValidation'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import type {
  PageStructureRow,
  PageStructureRowLayout,
} from '../store/pageStructureSlice'
import {
  setStaticContentForEvent,
  type StaticBlockContent,
  type StaticContent,
  type StaticContentType,
} from '../store/staticContentSlice'

type Props = {
  eventId: string
}

function blocksForLayout(layout: PageStructureRowLayout): number {
  return layout === 'full' ? 1 : 2
}

function emptyBlock(): StaticBlockContent {
  return { contentType: 'text', content: '' }
}

/**
 * Aligns the saved per-row block content with the current Page Structure rows. Drops orphaned
 * row data, pads/truncates each row's blocks to match its layout (1 for full, 2 for half-half).
 */
function reconcileToStructure(
  rows: PageStructureRow[],
  stored: StaticContent | undefined,
): StaticContent {
  const byRowId: Record<string, StaticBlockContent[]> = {}
  for (const row of rows) {
    const want = blocksForLayout(row.layout)
    const have = stored?.byRowId[row.id] ?? []
    const next: StaticBlockContent[] = []
    for (let i = 0; i < want; i++) {
      next.push(have[i] ?? emptyBlock())
    }
    byRowId[row.id] = next
  }
  return { byRowId }
}

function blockLabel(rowIdx: number, layout: PageStructureRowLayout, blockIdx: number): string {
  if (layout === 'full') return `Row ${rowIdx + 1}`
  return `Row ${rowIdx + 1} · ${blockIdx === 0 ? 'A' : 'B'}`
}

export function StaticContentEditor({ eventId }: Props) {
  const dispatch = useAppDispatch()
  const structureRows = useAppSelector(
    (s) => s.pageStructure.byEventId[eventId]?.rows ?? [],
  )
  const stored = useAppSelector((s) => s.staticContent.byEventId[eventId])
  const hasSaved = stored != null

  const [editing, setEditing] = useState<boolean>(
    !hasSaved && structureRows.length > 0,
  )
  const [draft, setDraft] = useState<StaticContent>(() =>
    reconcileToStructure(structureRows, stored),
  )
  const [saveFlash, setSaveFlash] = useState(false)
  const [inputsCollapsed, setInputsCollapsed] = useState(false)
  const [openRowIds, setOpenRowIds] = useState<Set<string>>(
    () => new Set(structureRows.map((r) => r.id)),
  )

  // Make brand-new rows added via Page Structure default to "open" in this editor as well.
  useEffect(() => {
    setOpenRowIds((prev) => {
      let changed = false
      const next = new Set(prev)
      for (const r of structureRows) {
        if (!next.has(r.id)) {
          next.add(r.id)
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [structureRows])

  // Keep the read-mode "effective" view aligned with structure changes that happen elsewhere.
  useEffect(() => {
    if (!editing) {
      setDraft(reconcileToStructure(structureRows, stored))
    }
  }, [editing, stored, structureRows])

  const effective = editing
    ? draft
    : reconcileToStructure(structureRows, stored)

  function setBlockField(
    rowId: string,
    blockIdx: number,
    patch: Partial<StaticBlockContent>,
  ) {
    setDraft((prev) => {
      const rowBlocks = prev.byRowId[rowId] ?? []
      const next = rowBlocks.slice()
      next[blockIdx] = { ...(next[blockIdx] ?? emptyBlock()), ...patch }
      return {
        ...prev,
        byRowId: { ...prev.byRowId, [rowId]: next },
      }
    })
  }

  function startEditing() {
    setDraft(reconcileToStructure(structureRows, stored))
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  function save() {
    dispatch(
      setStaticContentForEvent({
        eventId,
        content: reconcileToStructure(structureRows, draft),
      }),
    )
    setEditing(false)
    setSaveFlash(true)
    window.setTimeout(() => setSaveFlash(false), 1500)
  }

  if (structureRows.length === 0) {
    return (
      <p className="muted small">
        Configure rows in the <strong>Page Structure</strong> section above first, then return
        here to populate each row with content.
      </p>
    )
  }

  return (
    <div
      className={`static-content-editor${
        inputsCollapsed ? ' inputs-collapsed' : ''
      }`}
    >
      <div className="static-content-toolbar">
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => setInputsCollapsed((v) => !v)}
          aria-pressed={inputsCollapsed}
          title={
            inputsCollapsed
              ? 'Show the content inputs'
              : 'Hide the inputs to give the preview full width'
          }
        >
          {inputsCollapsed ? 'Show inputs' : 'Collapse inputs'}
        </button>
        {saveFlash && (
          <span className="muted small static-content-save-flash">Saved.</span>
        )}
      </div>

      <div className="static-content-grid">
        <div className="static-content-controls">
          {!editing ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={startEditing}
            >
              {hasSaved ? 'Edit Static Content' : 'Add Static Content'}
            </button>
          ) : (
            <>
              {structureRows.map((row, rowIdx) => {
                const blocks =
                  draft.byRowId[row.id] ??
                  Array.from({ length: blocksForLayout(row.layout) }, () =>
                    emptyBlock(),
                  )
                const rowOpen = openRowIds.has(row.id)
                return (
                  <details
                    key={row.id}
                    className="static-content-row-editor"
                    open={rowOpen}
                    onToggle={(e) => {
                      const isOpen = e.currentTarget.open
                      setOpenRowIds((prev) => {
                        const next = new Set(prev)
                        if (isOpen) next.add(row.id)
                        else next.delete(row.id)
                        return next
                      })
                    }}
                  >
                    <summary className="static-content-row-head">
                      <span className="page-structure-row-label">
                        Row {rowIdx + 1} ·{' '}
                        {row.layout === 'full' ? 'Full-Width' : '50-50'}
                      </span>
                    </summary>
                    <div
                      className={`static-content-block-grid static-content-block-grid-${row.layout}`}
                    >
                      {blocks.map((block, blockIdx) => {
                        const trimmedUrl = block.content.trim()
                        const invalidUrl =
                          block.contentType === 'imageUrl' &&
                          trimmedUrl.length > 0 &&
                          !isValidHttpUrl(block.content)
                        return (
                          <div
                            key={blockIdx}
                            className="static-content-block-editor"
                          >
                            <div className="muted small static-content-block-label">
                              {blockLabel(rowIdx, row.layout, blockIdx)}
                            </div>
                            <label className="stack-label">
                              <span className="muted small">Content Type</span>
                              <select
                                className="input"
                                value={block.contentType}
                                onChange={(e) =>
                                  setBlockField(row.id, blockIdx, {
                                    contentType: e.target.value as StaticContentType,
                                  })
                                }
                              >
                                <option value="text">Text</option>
                                <option value="imageUrl">Image URL</option>
                              </select>
                            </label>
                            <label className="stack-label">
                              <span className="muted small">Content</span>
                              {block.contentType === 'text' ? (
                                <textarea
                                  className="input textarea textarea-compact"
                                  rows={3}
                                  placeholder="Place content here"
                                  value={block.content}
                                  onChange={(e) =>
                                    setBlockField(row.id, blockIdx, {
                                      content: e.target.value,
                                    })
                                  }
                                />
                              ) : (
                                <input
                                  type="url"
                                  inputMode="url"
                                  className={`input${invalidUrl ? ' input-invalid' : ''}`}
                                  placeholder="https://…"
                                  value={block.content}
                                  aria-invalid={invalidUrl || undefined}
                                  onChange={(e) =>
                                    setBlockField(row.id, blockIdx, {
                                      content: e.target.value,
                                    })
                                  }
                                />
                              )}
                            </label>
                            {invalidUrl && (
                              <p className="static-content-invalid-hint small">
                                Enter a valid http(s) image URL.
                              </p>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </details>
                )
              })}

              <div className="static-content-actions">
                {hasSaved && (
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={cancelEditing}
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={save}
                  disabled={hasInvalidUrl(draft)}
                >
                  Save Static Content
                </button>
              </div>
            </>
          )}
        </div>

        <div className="static-content-preview">
          {structureRows.map((row, rowIdx) => {
            const blocks = effective.byRowId[row.id] ?? []
            return (
              <div
                key={row.id}
                className={`page-structure-preview-row page-structure-preview-row-${row.layout}`}
                aria-label={`Row ${rowIdx + 1} preview`}
              >
                {blocks.map((block, blockIdx) => (
                  <div
                    key={blockIdx}
                    className="page-structure-preview-block static-content-preview-block"
                  >
                    {renderBlockPreview(
                      block,
                      blockLabel(rowIdx, row.layout, blockIdx),
                    )}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function hasInvalidUrl(content: StaticContent): boolean {
  for (const blocks of Object.values(content.byRowId)) {
    for (const block of blocks) {
      if (
        block.contentType === 'imageUrl' &&
        block.content.trim().length > 0 &&
        !isValidHttpUrl(block.content)
      ) {
        return true
      }
    }
  }
  return false
}

function renderBlockPreview(
  block: StaticBlockContent,
  fallbackLabel: string,
) {
  const c = block.content.trim()
  if (!c) {
    return <span className="muted small">{fallbackLabel}</span>
  }
  if (block.contentType === 'text') {
    return <span className="static-content-preview-text">{c}</span>
  }
  if (!isValidHttpUrl(c)) {
    return <span className="muted small">Invalid image URL</span>
  }
  return (
    <img
      src={c}
      alt={fallbackLabel}
      className="static-content-preview-image"
    />
  )
}
