import type { SchemaNode } from '../types/schema'

/** Root keys the schema editor must keep present; the key name cannot be changed or removed. */
export const LOCKED_ROOT_KEYS = ['customer_id'] as const

export const CUSTOMER_ID_FIELD_TYPES = ['string', 'number'] as const

export function isValidCustomerIdSchemaField(node: SchemaNode): boolean {
  return (
    node.key === 'customer_id' &&
    (node.type === 'string' || node.type === 'number')
  )
}

/** Every mock event must declare a root-level `customer_id` as string or number (personalization refresh). */
export function schemaHasRequiredCustomerId(schema: SchemaNode[]): boolean {
  return schema.some(isValidCustomerIdSchemaField)
}

export const CUSTOMER_ID_SCHEMA_HINT =
  'Schema must include a root field named customer_id with type string or number (required for personalization refresh).'

/** Pristine schema for a brand-new event: locked customer_id + one empty placeholder row. */
export function createInitialEventSchema(): SchemaNode[] {
  return [
    { id: crypto.randomUUID(), key: 'customer_id', type: 'string' },
    { id: crypto.randomUUID(), key: '', type: 'string' },
  ]
}

/**
 * Ensures the schema includes a valid `customer_id` row. Used when editing legacy events whose
 * persisted schema may not include it, or has an invalid type on that key.
 */
export function withLockedCustomerIdRow(schema: SchemaNode[]): SchemaNode[] {
  const idx = schema.findIndex((n) => n.key === 'customer_id')
  if (idx === -1) {
    return [
      { id: crypto.randomUUID(), key: 'customer_id', type: 'string' },
      ...schema,
    ]
  }
  const row = schema[idx]
  if (row.type === 'string' || row.type === 'number') return schema
  const next = schema.slice()
  next[idx] = { ...row, type: 'string', fields: undefined, item: undefined }
  return next
}

/** Returns true if any root or nested field has an empty/whitespace-only key. */
export function schemaHasEmptyKey(schema: SchemaNode[]): boolean {
  for (const n of schema) {
    if (!n.key.trim()) return true
    if (n.type === 'object' && schemaHasEmptyKey(n.fields ?? [])) return true
    if (n.type === 'array' && n.item && schemaHasEmptyKey([n.item])) return true
  }
  return false
}
