import { useEffect, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import {
  setPageStructureForEvent,
  type PageStructureRow,
  type PageStructureRowLayout,
} from '../store/pageStructureSlice'

type Props = {
  eventId: string
}

const LAYOUT_OPTIONS: { value: PageStructureRowLayout; label: string }[] = [
  { value: 'full', label: 'Full-Width' },
  { value: 'half-half', label: '50-50' },
]

function newRow(): PageStructureRow {
  return { id: crypto.randomUUID(), layout: 'full' }
}

export function PageStructureEditor({ eventId }: Props) {
  const dispatch = useAppDispatch()
  const stored = useAppSelector((s) => s.pageStructure.byEventId[eventId])
  const hasSaved = stored != null

  const [editing, setEditing] = useState<boolean>(!hasSaved)
  const [draftRows, setDraftRows] = useState<PageStructureRow[]>(
    stored?.rows?.length ? stored.rows : [newRow()],
  )
  const [saveFlash, setSaveFlash] = useState(false)

  useEffect(() => {
    if (!editing) {
      setDraftRows(stored?.rows?.length ? stored.rows : [newRow()])
    }
  }, [editing, stored])

  const displayRows: PageStructureRow[] = editing
    ? draftRows
    : (stored?.rows ?? [])

  function startEditing() {
    setDraftRows(stored?.rows?.length ? stored.rows : [newRow()])
    setEditing(true)
  }

  function cancelEditing() {
    setEditing(false)
  }

  function save() {
    dispatch(
      setPageStructureForEvent({
        eventId,
        structure: { rows: draftRows },
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
              })`}
            >
              {row.layout === 'full' ? (
                <div className="page-structure-preview-block">
                  <span className="muted small">Row {i + 1}</span>
                </div>
              ) : (
                <>
                  <div className="page-structure-preview-block">
                    <span className="muted small">Row {i + 1} · A</span>
                  </div>
                  <div className="page-structure-preview-block">
                    <span className="muted small">Row {i + 1} · B</span>
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
