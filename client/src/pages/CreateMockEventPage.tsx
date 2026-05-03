import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError } from '../api/http'
import { backendStorageEnabled } from '../config/storageMode'
import { useAppDispatch } from '../store/hooks'
import { addMockEvent } from '../store/mockEventsSlice'
import type { SchemaNode } from '../types/schema'
import { SchemaEditor } from '../components/SchemaEditor'

export function CreateMockEventPage() {
  const navigate = useNavigate()
  const backend = backendStorageEnabled()
  const dispatch = useAppDispatch()
  const [name, setName] = useState('')
  const [schema, setSchema] = useState<SchemaNode[]>([])
  const [error, setError] = useState<string | null>(null)

  const saveRemote = useMutation({
    mutationFn: () =>
      api<{ event: { id: string } }>('/api/mock-events', {
        method: 'POST',
        body: JSON.stringify({ name: name.trim(), schema }),
      }),
    onSuccess: () => {
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
    if (backend) {
      saveRemote.mutate()
      return
    }
    dispatch(addMockEvent({ name: name.trim(), schema }))
    navigate('/')
  }

  return (
    <div className="page">
      <h1>Create mock event</h1>
      <p className="lede">
        Name the event (e.g. “Abandoned cart”), then define fields and nested types. Saving adds a
        card on the home page with a generated payload form.
      </p>

      {error && <div className="banner banner-error">{error}</div>}

      <label className="stack-label">
        <span>Event name</span>
        <input
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Abandoned cart"
        />
      </label>

      <SchemaEditor nodes={schema} onChange={setSchema} label="Payload schema (root fields)" />

      <div className="actions-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!name.trim() || schema.length === 0 || (backend && saveRemote.isPending)}
          onClick={save}
        >
          Save mock event
        </button>
      </div>
    </div>
  )
}
