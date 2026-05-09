import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '../api/http'
import { backendStorageEnabled } from '../config/storageMode'
import { useAppDispatch } from '../store/hooks'
import { addMockEvent } from '../store/mockEventsSlice'
import {
  CUSTOMER_ID_SCHEMA_HINT,
  LOCKED_ROOT_KEYS,
  createInitialEventSchema,
  schemaHasEmptyKey,
  schemaHasRequiredCustomerId,
} from '../lib/mockEventSchemaRules'
import {
  EVENT_NAME_HINT,
  sanitizeEventName,
} from '../lib/eventNameRules'
import {
  isDuplicateEventName,
  useExistingEventNames,
} from '../hooks/useExistingEventNames'
import type { SchemaNode } from '../types/schema'
import { SchemaEditor, appendNewSchemaField } from '../components/SchemaEditor'
import { useScopePaths } from '../scope/ScopeContext'

export function CreateMockEventPage() {
  const navigate = useNavigate()
  const scopePaths = useScopePaths()
  const backend = backendStorageEnabled()
  const dispatch = useAppDispatch()
  const [name, setName] = useState('')
  const [schema, setSchema] = useState<SchemaNode[]>(() => createInitialEventSchema())
  const [error, setError] = useState<string | null>(null)
  const takenNames = useExistingEventNames()
  const isDuplicate = isDuplicateEventName(name, takenNames)

  const saveRemote = useMutation({
    mutationFn: () =>
      api<{ event: { id: string } }>('/api/mock-events', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), schema }),
      }),
    onSuccess: () => {
      navigate(scopePaths.events)
    },
    onError: (err: Error) => {
      const msg = err instanceof ApiError ? err.message : err.message
      setError(msg)
    },
  })

  function save() {
    setError(null)
    if (!name.trim() || schema.length === 0) return
    if (isDuplicate) {
      setError('An event with this name already exists. Event names must be unique.')
      return
    }
    if (!schemaHasRequiredCustomerId(schema)) {
      setError(CUSTOMER_ID_SCHEMA_HINT)
      return
    }
    if (schemaHasEmptyKey(schema)) {
      setError('Every field must have a non-empty key.')
      return
    }
    if (backend) {
      saveRemote.mutate()
      return
    }
    dispatch(addMockEvent({ name: name.trim(), schema }))
    navigate(scopePaths.events)
  }

  const saveDisabled =
    !name.trim() ||
    schema.length === 0 ||
    schemaHasEmptyKey(schema) ||
    isDuplicate ||
    (backend && saveRemote.isPending)

  return (
    <div className="page">
      <h1>Create event</h1>
      <p className="lede">
        Name the event (e.g. <code>abandoned_cart</code>), then define payload fields. Saving adds
        a card on the Events page with a generated payload form.
      </p>

      {error && <div className="banner banner-error">{error}</div>}

      <label className="stack-label">
        <span className="stack-label-row">
          <span>Event name</span>
          {isDuplicate && (
            <span
              className="event-name-duplicate-warning"
              role="alert"
            >
              An event with this name already exists. Event names must be unique.
            </span>
          )}
        </span>
        <input
          className={`input${isDuplicate ? ' input-invalid' : ''}`}
          value={name}
          onChange={(e) => setName(sanitizeEventName(e.target.value))}
          placeholder="abandoned_cart"
          autoComplete="off"
          inputMode="text"
          aria-invalid={isDuplicate || undefined}
        />
        <span className="muted small">{EVENT_NAME_HINT}</span>
      </label>

      <SchemaEditor
        nodes={schema}
        onChange={setSchema}
        label="Payload schema (root fields)"
        lockedKeys={[...LOCKED_ROOT_KEYS]}
        hideAddButton
      />

      <div className="actions-row">
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setSchema(appendNewSchemaField(schema))}
        >
          Add field
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saveDisabled}
          onClick={save}
        >
          Save event
        </button>
      </div>
    </div>
  )
}
