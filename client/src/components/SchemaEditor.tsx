import type { FieldType, SchemaNode } from '../types/schema'
import { newSchemaNode } from '../types/schema'

function FieldTypeSelect({
  value,
  onChange,
  disabled,
}: {
  value: FieldType
  onChange: (t: FieldType) => void
  disabled?: boolean
}) {
  return (
    <select
      className="input-inline"
      value={value}
      onChange={(e) => onChange(e.target.value as FieldType)}
      disabled={disabled}
    >
      <option value="string">string</option>
      <option value="number">number</option>
      <option value="boolean">boolean</option>
      <option value="object">object</option>
      <option value="array">array</option>
    </select>
  )
}

function SchemaFieldEditor({
  node,
  onChange,
  onRemove,
  depth,
  showRemove = true,
  locked = false,
  lockedKeys,
}: {
  node: SchemaNode
  onChange: (n: SchemaNode) => void
  onRemove: () => void
  depth: number
  showRemove?: boolean
  locked?: boolean
  lockedKeys?: string[]
}) {
  const setType = (type: FieldType) => {
    const base = { ...node, type }
    if (type === 'object') {
      onChange({ ...base, fields: node.fields?.length ? node.fields : [], item: undefined })
    } else if (type === 'array') {
      onChange({
        ...base,
        fields: undefined,
        item: node.item ?? newSchemaNode('object'),
      })
    } else {
      onChange({ ...base, fields: undefined, item: undefined })
    }
  }

  return (
    <div className="schema-field" style={{ marginLeft: depth * 12 }}>
      <div className="schema-field-row">
        <input
          className="input"
          placeholder="field_key"
          value={node.key}
          onChange={(e) => onChange({ ...node, key: e.target.value })}
          readOnly={locked}
          aria-disabled={locked || undefined}
          title={locked ? 'Required field — cannot be renamed.' : undefined}
        />
        <FieldTypeSelect value={node.type} onChange={setType} disabled={locked} />
        {locked ? (
          <span className="muted small schema-field-locked-hint">Required</span>
        ) : (
          showRemove && (
            <button type="button" className="btn btn-ghost" onClick={onRemove}>
              Remove
            </button>
          )
        )}
      </div>

      {node.type === 'object' && (
        <SchemaEditor
          label="Object properties"
          nodes={node.fields ?? []}
          onChange={(fields) => onChange({ ...node, fields })}
          depth={depth + 1}
          lockedKeys={lockedKeys}
        />
      )}

      {node.type === 'array' && node.item && (
        <div className="schema-nested">
          <div className="muted small">Array element shape</div>
          <SchemaFieldEditor
            node={node.item}
            depth={depth + 1}
            showRemove={false}
            onChange={(item) => onChange({ ...node, item })}
            onRemove={() => {}}
            lockedKeys={lockedKeys}
          />
        </div>
      )}
    </div>
  )
}

export function SchemaEditor({
  nodes,
  onChange,
  depth = 0,
  label = 'Fields',
  lockedKeys,
  hideAddButton = false,
}: {
  nodes: SchemaNode[]
  onChange: (nodes: SchemaNode[]) => void
  depth?: number
  label?: string
  lockedKeys?: string[]
  hideAddButton?: boolean
}) {
  const add = () => {
    onChange([...nodes, newSchemaNode('string')])
  }

  const updateAt = (i: number, n: SchemaNode) => {
    const next = nodes.slice()
    next[i] = n
    onChange(next)
  }

  const removeAt = (i: number) => {
    onChange(nodes.filter((_, j) => j !== i))
  }

  return (
    <div className="schema-editor">
      <div className="schema-editor-head">
        <span className="muted">{label}</span>
        {!hideAddButton && (
          <button type="button" className="btn btn-secondary" onClick={add}>
            Add field
          </button>
        )}
      </div>
      {nodes.length === 0 && (
        <p className="muted small">No fields yet. Add fields that match your queue payload.</p>
      )}
      {nodes.map((node, i) => {
        const locked = Boolean(lockedKeys?.includes(node.key))
        return (
          <SchemaFieldEditor
            key={node.id}
            node={node}
            depth={depth}
            locked={locked}
            lockedKeys={lockedKeys}
            onChange={(n) => updateAt(i, n)}
            onRemove={() => removeAt(i)}
          />
        )
      })}
    </div>
  )
}

/** Append a new empty string field; suitable for the "Add field" button next to Save. */
export function appendNewSchemaField(nodes: SchemaNode[]): SchemaNode[] {
  return [...nodes, newSchemaNode('string')]
}
