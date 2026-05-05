/** Canonical Kafka / GrowthLoop property identifying which mock event produced the payload. */
export const EVENT_TYPE_KEY = 'event_type' as const

/**
 * Ensures `event_type` is present first with the mock event name; strips any prior `event_type`
 * so ordering stays `{ event_type, …schemaFields }` when serialized.
 */
export function withEventTypeFirst(
  eventName: string,
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const name = eventName.trim() || 'event'
  const { [EVENT_TYPE_KEY]: _omit, ...rest } = payload
  return { [EVENT_TYPE_KEY]: name, ...rest }
}
