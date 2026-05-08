export type FieldType = 'string' | 'number' | 'boolean' | 'object' | 'array'

export interface SchemaNode {
  id: string
  key: string
  type: FieldType
  fields?: SchemaNode[]
  item?: SchemaNode
}

export function newSchemaNode(type: FieldType): SchemaNode {
  const id = crypto.randomUUID()
  if (type === 'object') {
    return { id, key: '', type, fields: [] }
  }
  if (type === 'array') {
    return {
      id,
      key: '',
      type,
      item: { id: crypto.randomUUID(), key: '', type: 'object', fields: [] },
    }
  }
  return { id, key: '', type }
}
