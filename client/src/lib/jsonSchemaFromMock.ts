import type { SchemaNode } from '../types/schema'
import { EVENT_TYPE_KEY } from './eventTypePayload'

/** Fragment compatible with JSON Schema draft-07 `properties` values. */
export type JsonSchemaFragment = Record<string, unknown>

/**
 * Converts a single field node (including nested object/array shapes) into a JSON Schema fragment.
 */
export function fieldNodeToJsonSchema(node: SchemaNode): JsonSchemaFragment {
  switch (node.type) {
    case 'string':
      return { type: 'string' }
    case 'number':
      return { type: 'number' }
    case 'boolean':
      return { type: 'boolean' }
    case 'object': {
      const properties: Record<string, JsonSchemaFragment> = {}
      for (const f of node.fields ?? []) {
        properties[f.key] = fieldNodeToJsonSchema(f)
      }
      return {
        type: 'object',
        properties,
      }
    }
    case 'array': {
      if (!node.item) {
        return { type: 'array', items: {} }
      }
      return {
        type: 'array',
        items: fieldNodeToJsonSchema(node.item),
      }
    }
    default:
      return {}
  }
}

function slugifyEventName(name: string): string {
  const s = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return s || 'event'
}

/** PascalCase + `Record`, e.g. "Abandoned cart" → "AbandonedCartRecord". */
export function schemaTitleFromEventName(eventName: string): string {
  const parts = eventName.trim().split(/[^a-zA-Z0-9]+/).filter(Boolean)
  if (parts.length === 0) return 'MockEventRecord'
  const pascal = parts
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
    .join('')
  return pascal.endsWith('Record') ? pascal : `${pascal}Record`
}

/**
 * Full JSON Schema document suitable for GrowthLoop registration (draft-07 object with properties).
 */
export function buildGrowthLoopEventSchema(
  eventName: string,
  rootFields: SchemaNode[],
): JsonSchemaFragment {
  const properties: Record<string, JsonSchemaFragment> = {
    [EVENT_TYPE_KEY]: {
      type: 'string',
      description:
        'Identifies this mock event in GrowthLoop; equals the Mock Event name shown in the PoC UI.',
    },
  }
  for (const field of rootFields) {
    if (field.key === EVENT_TYPE_KEY) continue
    properties[field.key] = fieldNodeToJsonSchema(field)
  }

  const slug = slugifyEventName(eventName)

  return {
    $id: `http://example.com/growthloop-poc/${slug}.schema.json`,
    $schema: 'http://json-schema.org/draft-07/schema#',
    title: schemaTitleFromEventName(eventName),
    description:
      'Generated from the mock event builder in GrowthLoop PoC. Register this schema in GrowthLoop so stream payloads map to typed fields.',
    type: 'object',
    properties,
  }
}
