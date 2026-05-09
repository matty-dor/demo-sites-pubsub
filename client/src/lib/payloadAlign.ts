import type { SchemaNode } from '../types/schema'
import { defaultValueForNode } from './schemaDefaults'

/**
 * Forces `payload` to match the mock event schema — the same tree described under `properties` in
 * {@link buildGrowthLoopEventSchema}. Extra keys are dropped; missing keys get defaults; types are
 * coerced so Kafka/trigger JSON matches what GrowthLoop expects from the registered schema.
 */
export function alignPayloadToMockSchema(
  schema: SchemaNode[],
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const node of schema) {
    const raw = payload[node.key]
    out[node.key] = alignNode(node, raw)
  }
  return out
}

function alignNode(node: SchemaNode, raw: unknown): unknown {
  switch (node.type) {
    case 'string':
      if (typeof raw === 'string') return raw
      if (raw === undefined || raw === null) return ''
      return String(raw)

    case 'number': {
      if (typeof raw === 'number' && Number.isFinite(raw)) return raw
      if (typeof raw === 'string' && raw.trim() !== '') {
        const n = Number(raw)
        if (Number.isFinite(n)) return n
      }
      return defaultValueForNode(node) as number
    }

    case 'boolean': {
      if (typeof raw === 'boolean') return raw
      if (raw === 'false' || raw === '0' || raw === 0) return false
      if (raw === 'true' || raw === '1' || raw === 1) return true
      return defaultValueForNode(node) as boolean
    }

    case 'date': {
      if (typeof raw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
      return defaultValueForNode(node) as string
    }

    case 'object': {
      const obj =
        raw !== null && typeof raw === 'object' && !Array.isArray(raw)
          ? (raw as Record<string, unknown>)
          : {}
      const nested: Record<string, unknown> = {}
      for (const f of node.fields ?? []) {
        nested[f.key] = alignNode(f, obj[f.key])
      }
      return nested
    }

    case 'array': {
      if (!node.item) return []
      const arr = Array.isArray(raw) ? raw : []
      return arr.map((el) => alignNode(node.item!, el))
    }

    default:
      return defaultValueForNode(node)
  }
}
