import type { SchemaNode } from '../types/schema'

/**
 * Walks the schema and replaces every `timestamp` field with `new Date().toISOString()`.
 * Used at publish/trigger time so payloads carry a real clock value (e.g. for downstream
 * Personalization rules like "within the last 5 minutes") while the editor keeps timestamps
 * non-editable.
 */
export function injectTimestampInNode(node: SchemaNode, raw: unknown): unknown {
  switch (node.type) {
    case 'timestamp':
      return new Date().toISOString()
    case 'object': {
      const obj =
        raw !== null && typeof raw === 'object' && !Array.isArray(raw)
          ? { ...(raw as Record<string, unknown>) }
          : {}
      for (const f of node.fields ?? []) {
        obj[f.key] = injectTimestampInNode(f, obj[f.key])
      }
      return obj
    }
    case 'array': {
      if (!node.item) return []
      const arr = Array.isArray(raw) ? raw : []
      return arr.map((el) => injectTimestampInNode(node.item!, el))
    }
    default:
      return raw
  }
}

export function injectTriggerTimestamps(
  schema: SchemaNode[],
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...payload }
  for (const node of schema) {
    out[node.key] = injectTimestampInNode(node, out[node.key])
  }
  return out
}
