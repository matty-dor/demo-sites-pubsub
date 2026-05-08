import type { SchemaNode } from '../types/schema'

/** Root keys that the schema editor must keep present and uneditable (key + type locked). */
export const LOCKED_ROOT_KEYS = ['customer_id'] as const

/** Every mock event must declare a root-level string field `customer_id` (used for Refresh Experience → Personalization API). */
export function schemaHasRequiredCustomerId(schema: SchemaNode[]): boolean {
  return schema.some((n) => n.key === 'customer_id' && n.type === 'string')
}

export const CUSTOMER_ID_SCHEMA_HINT =
  'Schema must include a root field named customer_id with type string (required for personalization refresh).'

/** Pristine schema for a brand-new event: locked customer_id + one empty placeholder row. */
export function createInitialEventSchema(): SchemaNode[] {
  return [
    { id: crypto.randomUUID(), key: 'customer_id', type: 'string' },
    { id: crypto.randomUUID(), key: '', type: 'string' },
  ]
}

/**
 * Ensures the schema starts with a locked `customer_id` string row. Used when editing legacy
 * events whose persisted schema may not include it.
 */
export function withLockedCustomerIdRow(schema: SchemaNode[]): SchemaNode[] {
  if (schemaHasRequiredCustomerId(schema)) return schema
  return [
    { id: crypto.randomUUID(), key: 'customer_id', type: 'string' },
    ...schema,
  ]
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
