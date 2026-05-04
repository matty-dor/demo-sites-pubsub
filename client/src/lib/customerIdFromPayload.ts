import { alignPayloadToMockSchema } from './payloadAlign'
import type { SchemaNode } from '../types/schema'

/** Reads customer_id from aligned mock payload (string or number coerced to string). */
export function extractCustomerIdFromPayload(
  schema: SchemaNode[],
  payload: Record<string, unknown>,
): string | null {
  const aligned = alignPayloadToMockSchema(schema, payload)
  const raw = aligned.customer_id
  if (raw === undefined || raw === null) return null
  const s = typeof raw === 'string' ? raw.trim() : String(raw).trim()
  return s.length > 0 ? s : null
}
