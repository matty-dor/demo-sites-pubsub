import type { SchemaNode } from '../types/schema'

/** "Complete" means: every input element has a meaningful value. Booleans always count as complete. */
export function isNodeValueComplete(node: SchemaNode, value: unknown): boolean {
  switch (node.type) {
    case 'string':
      return typeof value === 'string' && value.trim().length > 0
    case 'number':
      return typeof value === 'number' && Number.isFinite(value)
    case 'boolean':
      return typeof value === 'boolean'
    case 'date':
      return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
      const obj = value as Record<string, unknown>
      for (const f of node.fields ?? []) {
        if (!isNodeValueComplete(f, obj[f.key])) return false
      }
      return true
    }
    case 'array': {
      if (!Array.isArray(value)) return false
      const item = node.item
      if (!item) return true
      for (const el of value) {
        if (!isNodeValueComplete(item, el)) return false
      }
      return true
    }
    default:
      return true
  }
}

export function isPayloadComplete(
  schema: SchemaNode[],
  payload: Record<string, unknown>,
): boolean {
  for (const node of schema) {
    if (!isNodeValueComplete(node, payload[node.key])) return false
  }
  return true
}

/** Top-level field keys that are still incomplete; used for hint copy. */
export function listIncompleteRootKeys(
  schema: SchemaNode[],
  payload: Record<string, unknown>,
): string[] {
  const out: string[] = []
  for (const node of schema) {
    if (!isNodeValueComplete(node, payload[node.key])) out.push(node.key)
  }
  return out
}
