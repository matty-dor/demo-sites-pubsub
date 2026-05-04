import { useCallback, useMemo, useState } from 'react'
import type { SchemaNode } from '../types/schema'
import { buildGrowthLoopEventSchema } from '../lib/jsonSchemaFromMock'

type Props = {
  eventName: string
  rootFields: SchemaNode[]
}

export function GrowthLoopSchemaPanel({ eventName, rootFields }: Props) {
  const [copied, setCopied] = useState(false)

  const schemaJson = useMemo(
    () => JSON.stringify(buildGrowthLoopEventSchema(eventName, rootFields), null, 2),
    [eventName, rootFields],
  )

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(schemaJson)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }, [schemaJson])

  return (
    <details className="mock-event-collapsible">
      <summary className="mock-event-collapsible-summary">GrowthLoop Event Schema</summary>
      <p className="muted small mock-event-collapsible-hint">
        Auto-generated from your mock fields. Paste into GrowthLoop when registering the event
        schema so payloads match this structure.
      </p>
      <div className="mock-event-collapsible-toolbar">
        <button type="button" className="btn btn-secondary" onClick={() => void copy()}>
          {copied ? 'Copied' : 'Copy JSON'}
        </button>
      </div>
      <pre className="result-block mock-event-collapsible-pre">{schemaJson}</pre>
    </details>
  )
}
