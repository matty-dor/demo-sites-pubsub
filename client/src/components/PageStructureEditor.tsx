import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  normalizePageStructureRow,
  setPageStructureForEvent,
  type PageStructureRow,
  type PageStructureRowDefaultDisplay,
  type PageStructureRowLayout,
} from '../store/pageStructureSlice'

type Props = {
  eventId: string
}

const LAYOUT_OPTIONS: { value: PageStructureRowLayout; label: string }[] = [
  { value: 'full', label: 'Full-Width' },
  { value: 'half-half', label: '50-50' },
]

const DEFAULT_DISPLAY_OPTIONS: {
  value: PageStructureRowDefaultDisplay
  label: string
}[] = [
  { value: 'show', label: 'Show' },
  { value: 'hide', label: 'Hide' },
]

function newRow(): PageStructureRow {
  return { id: crypto.randomUUID(), layout: 'full', defaultDisplay: 'show' }
}

function normalizeRows(rows: PageStructureRow[]): PageStructureRow[] {
  return rows.map(normalizePageStructureRow)
}

export function PageStructureEditor({ eventId }: Props) {
  const dispatch = useAppDispatch()
  const stored = useAppSelector((s) => s.pageStructure.byEventId[eventId])
  const hasSaved = stored != null

  const [editing, setEditing] = useState<boolean>(!hasSaved)
  const [draftRows, setDraftRows] = useState<PageStructureRow[]>(() =>
    normalizeRows(stored?.rows?.length ? stored.rows : [newRow()]),
  )
  const [saveFlash, setSaveFlash] = useState(false)

  useEffect(() => {
    if (!editing) {
      setDraftRows(
        normalizeRows(stored?.rows?.length ? stored.rows : [newRow()]),
      )
    }
  }, [editing, stored])

  const displayRows: PageStructureRow[] = editing
    ? draftRows
    : normalizeRows(stored?.rows ?? [])

  function startEditing() {
    setDraftRows(normalizeRows(stored?.rows?.length ? stored.rows : [newRow()]))
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  function save() {
    dispatch(
      setPageStructureForEvent({
        eventId,
        structure: { rows: normalizeRows(draftRows) },
      }),
    )
    setEditing(false)
    setSaveFlash(true)
    window.setTimeout(() => setSaveFlash(false), 1500)
  }

  function setLayout(rowId: string, layout: PageStructureRowLayout) {
    setDraftRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, layout } : r)),
    )
  }

  function setDefaultDisplay(
    rowId: string,
    defaultDisplay: PageStructureRowDefaultDisplay,
  ) {
    setDraftRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, defaultDisplay } : r)),
    )
  }

  function addRow() {
    setDraftRows((prev) => [...prev, newRow()])
  }

  function removeRow(rowId: string) {
    setDraftRows((prev) => prev.filter((r) => r.id !== rowId))
  }

  return (
    <div className="page-structure-editor">
      <div className="page-structure-controls">
        {!editing && hasSaved && (
          <div className="page-structure-controls-head">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={startEditing}
            >
              Edit Page Structure
            </button>
            {saveFlash && (
              <span className="muted small page-structure-save-flash">
                Saved.
              </span>
            )}
          </div>
        )}

        {!editing && hasSaved && stored && stored.rows.length === 0 && (
          <p className="muted small">No rows configured.</p>
        )}

        {editing && (
          <>
            {draftRows.map((row, i) => (
              <div key={row.id} className="page-structure-row-editor">
                <div className="page-structure-row-head">
                  <span className="page-structure-row-label">Row {i + 1}</span>
                  <button
                    type="button"
                    className="btn btn-ghost btn-small"
                    onClick={() => removeRow(row.id)}
                    aria-label={`Remove Row ${i + 1}`}
                  >
                    Remove
                  </button>
                </div>
                <div
                  className="radio-row page-structure-layout-row"
                  role="radiogroup"
                  aria-label={`Layout for Row ${i + 1}`}
                >
                  {LAYOUT_OPTIONS.map((opt) => (
                    <label key={opt.value} className="radio-option">
                      <input
                        type="radio"
                        name={`page-structure-row-${row.id}`}
                        checked={row.layout === opt.value}
                        onChange={() => setLayout(row.id, opt.value)}
                      />
                      {opt.label}
                    </label>
                  ))}
                </div>
                <label className="stack-label page-structure-default-display">
                  <span className="muted small">Default Display</span>
                  <select
                    className="input"
                    value={row.defaultDisplay}
                    onChange={(e) =>
                      setDefaultDisplay(
                        row.id,
                        e.target.value as PageStructureRowDefaultDisplay,
                      )
                    }
                    aria-label={`Default display for Row ${i + 1}`}
                  >
                    {DEFAULT_DISPLAY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ))}

            <div className="page-structure-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={addRow}
              >
                Add Another Row
              </button>
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
                disabled={draftRows.length === 0}
              >
                Save Page Structure
              </button>
            </div>
          </>
        )}
      </div>

      <div className="page-structure-preview">
        {displayRows.length === 0 ? (
          <p className="muted small">
            Configure rows on the left to see the layout outline.
          </p>
        ) : (
          displayRows.map((row, i) => (
            <div
              key={row.id}
              className={`page-structure-preview-row page-structure-preview-row-${row.layout}`}
              aria-label={`Row ${i + 1} preview (${
                row.layout === 'full' ? 'Full-Width' : '50-50'
              })${row.defaultDisplay === 'hide' ? ', Default Display: Hide' : ''}`}
            >
              {row.layout === 'full' ? (
                <div className="page-structure-preview-block">
                  <span className="muted small">
                    Row {i + 1}
                    {row.defaultDisplay === 'hide' && (
                      <span className="page-structure-preview-hide-pill"> · Hide</span>
                    )}
                  </span>
                </div>
              ) : (
                <>
                  <div className="page-structure-preview-block">
                    <span className="muted small">
                      Row {i + 1} · A
                      {row.defaultDisplay === 'hide' && (
                        <span className="page-structure-preview-hide-pill"> · Hide</span>
                      )}
                    </span>
                  </div>
                  <div className="page-structure-preview-block">
                    <span className="muted small">
                      Row {i + 1} · B
                      {row.defaultDisplay === 'hide' && (
                        <span className="page-structure-preview-hide-pill"> · Hide</span>
                      )}
                    </span>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
