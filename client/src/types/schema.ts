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
    return { id, key: 'object', type, fields: [] }
  }
  if (type === 'array') {
    return {
      id,
      key: 'items',
      type,
      item: { id: crypto.randomUUID(), key: 'item', type: 'object', fields: [] },
    }
  }
  return { id, key: 'field', type }
}
