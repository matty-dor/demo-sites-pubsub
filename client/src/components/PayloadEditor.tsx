import type { SchemaNode } from '../types/schema'
import { defaultValueForNode } from '../lib/schemaDefaults'

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
      return (
        <input
          className="input"
          type="number"
          value={typeof value === 'number' ? value : 0}
          onChange={(e) => onChange(Number(e.target.value))}
        />
      )
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
