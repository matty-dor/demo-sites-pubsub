import type { FieldType, SchemaNode } from '../types/schema'
import { newSchemaNode } from '../types/schema'

function FieldTypeSelect({
  value,
  onChange,
}: {
  value: FieldType
  onChange: (t: FieldType) => void
}) {
  return (
    <select
      className="input-inline"
      value={value}
      onChange={(e) => onChange(e.target.value as FieldType)}
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
}: {
  node: SchemaNode
  onChange: (n: SchemaNode) => void
  onRemove: () => void
  depth: number
  showRemove?: boolean
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
          placeholder="field key"
          value={node.key}
          onChange={(e) => onChange({ ...node, key: e.target.value })}
        />
        <FieldTypeSelect value={node.type} onChange={setType} />
        {showRemove && (
          <button type="button" className="btn btn-ghost" onClick={onRemove}>
            Remove
          </button>
        )}
      </div>

      {node.type === 'object' && (
        <SchemaEditor
          label="Object properties"
          nodes={node.fields ?? []}
          onChange={(fields) => onChange({ ...node, fields })}
          depth={depth + 1}
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
}: {
  nodes: SchemaNode[]
  onChange: (nodes: SchemaNode[]) => void
  depth?: number
  label?: string
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
        <button type="button" className="btn btn-secondary" onClick={add}>
          Add field
        </button>
      </div>
      {nodes.length === 0 && (
        <p className="muted small">No fields yet. Add fields that match your queue payload.</p>
      )}
      {nodes.map((node, i) => (
        <SchemaFieldEditor
          key={node.id}
          node={node}
          depth={depth}
          onChange={(n) => updateAt(i, n)}
          onRemove={() => removeAt(i)}
        />
      ))}
    </div>
  )
}
