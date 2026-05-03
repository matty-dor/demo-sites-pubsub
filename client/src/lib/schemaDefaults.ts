import type { SchemaNode } from '../types/schema'

export function defaultValueForNode(node: SchemaNode): unknown {
  switch (node.type) {
    case 'string':
      return ''
    case 'number':
      return 0
    case 'boolean':
      return false
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

export function buildDefaultPayload(schema: SchemaNode[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const node of schema) {
    out[node.key] = defaultValueForNode(node)
  }
  return out
}
