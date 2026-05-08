/** Event names are used as `event_type` in payloads + Trigger button labels — keep them simple. */
export const EVENT_NAME_PATTERN = /^[A-Za-z0-9_]+$/

/** Strips any character that isn't a letter, number, or underscore. Spaces are dropped. */
export function sanitizeEventName(input: string): string {
  return input.replace(/[^A-Za-z0-9_]/g, '')
}

export const EVENT_NAME_HINT =
  'Letters, numbers, and underscores only (no spaces).'
