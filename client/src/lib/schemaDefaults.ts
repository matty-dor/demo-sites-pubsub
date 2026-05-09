import type { SchemaNode } from '../types/schema'
import { EVENT_TYPE_KEY } from './eventTypePayload'

export function defaultValueForNode(node: SchemaNode): unknown {
  switch (node.type) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'boolean':
      return false
    case 'date':
      return ''
    case 'object': {
      const o: Record<string, unknown> = {}
      for (const f of node.fields ?? []) {
        o[f.key] = defaultValueForNode(f)
      }
      return o
    }
    case 'array':
      return []
    default:
      return null
  }
}

/** Default payload for the payload editor + Redux store; `event_type` is always first. */
export function buildDefaultPayload(
  schema: SchemaNode[],
  eventName: string,
): Record<string, unknown> {
  const et = eventName.trim() || 'event'
  const out: Record<string, unknown> = { [EVENT_TYPE_KEY]: et }
  for (const node of schema) {
    if (node.key === EVENT_TYPE_KEY) continue
    out[node.key] = defaultValueForNode(node)
  }
  return out
}
