import { useCallback, useState } from 'react'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { setCompanyName } from '../store/brandingSlice'

const PLACEHOLDER = 'Company Name'

export function ClientCompanyName() {
  const dispatch = useAppDispatch()
  const saved = useAppSelector((s) => s.branding.companyName)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const display = saved.trim() ? saved.trim() : PLACEHOLDER
  const isPlaceholder = !saved.trim()

  const openEdit = useCallback(() => {
    setDraft(saved)
    setEditing(true)
  }, [saved])

  const save = useCallback(() => {
    dispatch(setCompanyName(draft.trim()))
    setEditing(false)
  }, [dispatch, draft])

  const cancel = useCallback(() => {
    setEditing(false)
  }, [])

  if (editing) {
    return (
      <span className="client-brand-edit" role="group" aria-label="Edit company name">
        <input
          className="input client-brand-input"
          type="text"
          value={draft}
          placeholder={PLACEHOLDER}
          autoComplete="organization"
          autoFocus
          aria-label="Company name"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') cancel()
          }}
        />
        <span className="client-brand-edit-actions">
          <button type="button" className="btn btn-secondary btn-compact" onClick={save}>
            Save
          </button>
          <button type="button" className="btn btn-ghost btn-compact" onClick={cancel}>
            Cancel
          </button>
        </span>
      </span>
    )
  }

  return (
    <button
      type="button"
      className={`client-brand-trigger ${isPlaceholder ? 'client-brand-placeholder' : ''}`}
      onClick={openEdit}
      title="Click to set company name"
    >
      {display}
    </button>
  )
}
