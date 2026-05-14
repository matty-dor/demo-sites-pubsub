import type { SchemaNode } from '../types.js';

export class PayloadValidationError extends Error {
  constructor(
    message: string,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'PayloadValidationError';
  }
}

function validateNode(
  path: string,
  node: SchemaNode,
  value: unknown,
): void {
  const key = node.key;
  const p = path ? `${path}.${key}` : key;

  switch (node.type) {
    case 'string': {
      if (typeof value !== 'string') {
        throw new PayloadValidationError(
          `Expected string at "${p}", got ${typeof value}`,
          p,
        );
      }
      return;
    }
    case 'number': {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        throw new PayloadValidationError(
          `Expected number at "${p}"`,
          p,
        );
      }
      return;
    }
    case 'boolean': {
      if (typeof value !== 'boolean') {
        throw new PayloadValidationError(
          `Expected boolean at "${p}"`,
          p,
        );
      }
      return;
    }
    case 'date': {
      if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        throw new PayloadValidationError(
          `Expected date string (YYYY-MM-DD) at "${p}"`,
          p,
        );
      }
      return;
    }
    case 'timestamp': {
      if (typeof value !== 'string' || value.trim() === '') {
        throw new PayloadValidationError(
          `Expected non-empty ISO 8601 timestamp string at "${p}"`,
          p,
        );
      }
      const ms = Date.parse(value);
      if (Number.isNaN(ms)) {
        throw new PayloadValidationError(
          `Expected parseable ISO 8601 timestamp at "${p}"`,
          p,
        );
      }
      return;
    }
    case 'object': {
      if (value === null || typeof value !== 'object' || Array.isArray(value)) {
        throw new PayloadValidationError(
          `Expected object at "${p}"`,
          p,
        );
      }
      const fields = node.fields ?? [];
      const obj = value as Record<string, unknown>;
      for (const child of fields) {
        if (!(child.key in obj)) {
          throw new PayloadValidationError(
            `Missing field "${child.key}" under "${p}"`,
            `${p}.${child.key}`,
          );
        }
        validateNode(p, child, obj[child.key]);
      }
      return;
    }
    case 'array': {
      if (!Array.isArray(value)) {
        throw new PayloadValidationError(
          `Expected array at "${p}"`,
          p,
        );
      }
      const itemSchema = node.item;
      if (!itemSchema) {
        throw new PayloadValidationError(
          `Array "${p}" has no item schema defined`,
          p,
        );
      }
      value.forEach((el, i) => {
        validateNode(`${p}[${i}]`, { ...itemSchema, key: itemSchema.key || 'item' }, el);
      });
      return;
    }
    default: {
      throw new PayloadValidationError(
        `Unknown type ${(node as SchemaNode).type}`,
        p,
      );
    }
  }
}

/** Validates root payload object against top-level schema nodes (each describes a top-level key). */
export function validatePayloadAgainstSchema(
  schema: SchemaNode[],
  payload: unknown,
): void {
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
    throw new PayloadValidationError('Payload must be a JSON object', '');
  }
  const obj = payload as Record<string, unknown>;
  for (const node of schema) {
    if (!(node.key in obj)) {
      throw new PayloadValidationError(
        `Missing root field "${node.key}"`,
        node.key,
      );
    }
    validateNode('', node, obj[node.key]);
  }
}
