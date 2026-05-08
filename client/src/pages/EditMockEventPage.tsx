import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { api, ApiError } from '../api/http'
import { backendStorageEnabled } from '../config/storageMode'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { updateMockEvent } from '../store/mockEventsSlice'
import { setPayloadForEvent } from '../store/eventPayloadsSlice'
import {
  CUSTOMER_ID_SCHEMA_HINT,
  LOCKED_ROOT_KEYS,
  schemaHasEmptyKey,
  schemaHasRequiredCustomerId,
  withLockedCustomerIdRow,
} from '../lib/mockEventSchemaRules'
import {
  EVENT_NAME_HINT,
  sanitizeEventName,
} from '../lib/eventNameRules'
import {
  isDuplicateEventName,
  useExistingEventNames,
} from '../hooks/useExistingEventNames'
import { alignPayloadToMockSchema } from '../lib/payloadAlign'
import type { SchemaNode } from '../types/schema'
import { SchemaEditor, appendNewSchemaField } from '../components/SchemaEditor'

type ApiMockEventRow = {
  id: string
  name: string
  schema: SchemaNode[]
  created_at: string
}

export function EditMockEventPage() {
  const { id = '' } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const backend = backendStorageEnabled()
  const dispatch = useAppDispatch()

  const reduxEvent = useAppSelector((s) =>
    s.mockEvents.events.find((e) => e.id === id),
  )
  const existingPayload = useAppSelector(
    (s) => s.eventPayloads.byEventId[id] ?? {},
  )

  const { data: backendData, isLoading } = useQuery({
    queryKey: ['mock-events'],
    queryFn: () => api<{ events: ApiMockEventRow[] }>('/api/mock-events'),
    enabled: backend,
  })

  const sourceEvent = useMemo(() => {
    if (backend) {
      const row = backendData?.events?.find((e) => e.id === id)
      return row ? { id: row.id, name: row.name, schema: row.schema ?? [] } : null
    }
    return reduxEvent
      ? { id: reduxEvent.id, name: reduxEvent.name, schema: reduxEvent.schema ?? [] }
      : null
  }, [backend, backendData, id, reduxEvent])

  const [name, setName] = useState('')
  const [schema, setSchema] = useState<SchemaNode[]>([])
  const [error, setError] = useState<string | null>(null)
  const [hydrated, setHydrated] = useState(false)
  const takenNames = useExistingEventNames(id)
  const isDuplicate = isDuplicateEventName(name, takenNames)

  useEffect(() => {
    if (!sourceEvent || hydrated) return
    setName(sanitizeEventName(sourceEvent.name))
    setSchema(withLockedCustomerIdRow(sourceEvent.schema))
    setHydrated(true)
  }, [sourceEvent, hydrated])

  const saveRemote = useMutation({
    mutationFn: () =>
      api<{ event: ApiMockEventRow }>(`/api/mock-events/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), schema }),
      }),
    onSuccess: () => {
      dispatch(
        setPayloadForEvent({
          eventId: id,
          payload: alignPayloadToMockSchema(schema, existingPayload),
        }),
      )
      navigate('/')
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
    dispatch(updateMockEvent({ id, name: name.trim(), schema }))
    dispatch(
      setPayloadForEvent({
        eventId: id,
        payload: alignPayloadToMockSchema(schema, existingPayload),
      }),
    )
    navigate('/')
  }

  const saveDisabled =
    !hydrated ||
    !name.trim() ||
    schema.length === 0 ||
    schemaHasEmptyKey(schema) ||
    isDuplicate ||
    (backend && saveRemote.isPending)

  if (backend && isLoading) {
    return (
      <div className="page">
        <h1>Edit event</h1>
        <p className="muted">Loading…</p>
      </div>
    )
  }

  if (!sourceEvent) {
    return (
      <div className="page">
        <h1>Edit event</h1>
        <div className="banner banner-error">
          Event not found. <Link to="/">Back to Events</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <h1>Edit event</h1>

      <div className="banner banner-warning" role="status">
        <strong>Heads up:</strong> changing this event&apos;s schema may diverge from the
        registered <strong>GrowthLoop Event Schema</strong>. After saving, copy the updated
        GrowthLoop Event Schema from the Events card and re-register it in GrowthLoop so the
        registered structure matches what this app publishes.
      </div>

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
        <Link to="/" className="btn btn-ghost">
          Cancel
        </Link>
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
          Save changes
        </button>
      </div>
    </div>
  )
}
