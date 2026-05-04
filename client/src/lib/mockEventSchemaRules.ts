import type { SchemaNode } from '../types/schema'

/** Every mock event must declare a root-level string field `customer_id` (used for Refresh Experience → Personalization API). */
export function schemaHasRequiredCustomerId(schema: SchemaNode[]): boolean {
  return schema.some((n) => n.key === 'customer_id' && n.type === 'string')
}

export const CUSTOMER_ID_SCHEMA_HINT =
  'Schema must include a root field named customer_id with type string (required for personalization refresh).'
