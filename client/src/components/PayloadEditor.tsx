import { useEffect, useRef, useState } from 'react'
import type { SchemaNode } from '../types/schema'
import { defaultValueForNode } from '../lib/schemaDefaults'

const TIMESTAMP_PAYLOAD_PLACEHOLDER =
  'Timestamp is auto-generated based on when the event is triggered.'

/** Restricts a typed/pasted string to a valid numeric in-progress form: optional `-`, digits, single `.`. */
function sanitizeNumberInput(raw: string): string {
  let s = raw.replace(/[^\d.\-]/g, '')
  if (s.includes('-')) {
    const negative = s.startsWith('-')
    s = (negative ? '-' : '') + s.replace(/-/g, '')
  }
  const firstDot = s.indexOf('.')
  if (firstDot !== -1) {
    s = s.slice(0, firstDot + 1) + s.slice(firstDot + 1).replace(/\./g, '')
  }
  return s
}

function NumberField({
  value,
  onChange,
}: {
  value: unknown
  onChange: (v: number) => void
}) {
  const numeric =
    typeof value === 'number' && Number.isFinite(value) ? value : 0
  const [text, setText] = useState<string>(numeric === 0 ? '' : String(numeric))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (focusedRef.current) return
    setText(numeric === 0 ? '' : String(numeric))
  }, [numeric])

  return (
    <input
      className="input"
      type="text"
      inputMode="decimal"
      placeholder="0"
      value={text}
      onFocus={() => {
        focusedRef.current = true
      }}
      onBlur={() => {
        focusedRef.current = false
      }}
      onKeyDown={(e) => {
        if (
          e.key.length === 1 &&
          !/[0-9.\-]/.test(e.key) &&
          !e.ctrlKey &&
          !e.metaKey &&
          !e.altKey
        ) {
          e.preventDefault()
        }
      }}
      onChange={(e) => {
        const cleaned = sanitizeNumberInput(e.target.value)
        setText(cleaned)
        if (cleaned === '' || cleaned === '-' || cleaned === '.') {
          onChange(0)
          return
        }
        const parsed = Number(cleaned)
        if (Number.isFinite(parsed)) onChange(parsed)
      }}
    />
  )
}

function PayloadField({
  node,
  value,
  onChange,
}: {
  node: SchemaNode
  value: unknown
  onChange: (v: unknown) => void
}) {
  switch (node.type) {
    case 'string':
      return (
        <input
          className="input"
          type="text"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
        />
      )
    case 'number':
      return <NumberField value={value} onChange={onChange} />
    case 'boolean':
      return (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          true
        </label>
      )
    case 'date':
      return (
        <input
          className="input"
          type="date"
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          onClick={(e) => {
            const el = e.currentTarget as HTMLInputElement & {
              showPicker?: () => void
            }
            try {
              el.showPicker?.()
            } catch {
              /* showPicker not supported or blocked; native click target still opens it */
            }
          }}
          onFocus={(e) => {
            const el = e.currentTarget as HTMLInputElement & {
              showPicker?: () => void
            }
            try {
              el.showPicker?.()
            } catch {
              /* showPicker not supported or blocked from this focus event */
            }
          }}
        />
      )
    case 'timestamp':
      return (
        <input
          className="input payload-timestamp-readonly"
          type="text"
          readOnly
          disabled
          value=""
          placeholder={TIMESTAMP_PAYLOAD_PLACEHOLDER}
          title={TIMESTAMP_PAYLOAD_PLACEHOLDER}
          aria-readonly="true"
        />
      )
    case 'object': {
      const obj =
        value !== null && typeof value === 'object' && !Array.isArray(value)
          ? (value as Record<string, unknown>)
          : {}
      return (
        <div className="payload-nested">
          {(node.fields ?? []).map((child) => (
            <label key={child.id} className="payload-field">
              <span className="payload-key">{child.key}</span>
              <PayloadField
                node={child}
                value={obj[child.key]}
                onChange={(v) => onChange({ ...obj, [child.key]: v })}
              />
            </label>
          ))}
        </div>
      )
    }
    case 'array': {
      const arr = Array.isArray(value) ? value : []
      const itemSchema = node.item
      if (!itemSchema) {
        return <span className="muted small">Array has no item schema.</span>
      }
      const addRow = () => {
        onChange([...arr, defaultValueForNode(itemSchema)])
      }
      const updateRow = (i: number, v: unknown) => {
        const next = arr.slice()
        next[i] = v
        onChange(next)
      }
      const removeRow = (i: number) => {
        onChange(arr.filter((_, j) => j !== i))
      }
      return (
        <div className="payload-array">
          {arr.map((row, i) => (
            <div key={i} className="payload-array-row">
              <PayloadField node={itemSchema} value={row} onChange={(v) => updateRow(i, v)} />
              <button type="button" className="btn btn-ghost" onClick={() => removeRow(i)}>
                Remove
              </button>
            </div>
          ))}
          <button type="button" className="btn btn-secondary" onClick={addRow}>
            Add item
          </button>
        </div>
      )
    }
    default:
      return null
  }
}

export function PayloadEditor({
  schema,
  value,
  onChange,
}: {
  schema: SchemaNode[]
  value: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}) {
  return (
    <div className="payload-editor">
      {schema.map((node) => (
        <label key={node.id} className="payload-field payload-root">
          <span className="payload-key">{node.key}</span>
          <PayloadField
            node={node}
            value={value[node.key]}
            onChange={(v) => onChange({ ...value, [node.key]: v })}
          />
        </label>
      ))}
    </div>
  )
}
