/**
 * Personalization responses are shaped like `{ ok, status, data: { …profile… } }`.
 * Dynamic Content Rules always resolve dot-paths from that `data` object, so stored paths
 * must begin with `data.` (e.g. `data.entity_id`, `data.audiences.31325.phone`).
 */
export const PERSONALIZATION_DATA_PATH_PREFIX = 'data.' as const

/** Ensures a non-empty path starting with `data.`. Migrates legacy paths such as `segment`. */
export function normalizeRulesFieldPath(raw: string | undefined): string {
  const t = (raw ?? '').trim()
  if (!t) return `${PERSONALIZATION_DATA_PATH_PREFIX}segment`
  const rest = t.startsWith(PERSONALIZATION_DATA_PATH_PREFIX)
    ? t.slice(PERSONALIZATION_DATA_PATH_PREFIX.length).replace(/^\.+/, '')
    : t.replace(/^\.+/, '')
  if (!rest) return `${PERSONALIZATION_DATA_PATH_PREFIX}segment`
  return `${PERSONALIZATION_DATA_PATH_PREFIX}${rest}`
}

/** Suffix shown after the fixed `data.` prefix in the rules UI. */
export function fieldPathSuffixFromStored(full: string | undefined): string {
  return normalizeRulesFieldPath(full).slice(PERSONALIZATION_DATA_PATH_PREFIX.length)
}

/** Wrap profile JSON (`personalizationResponse.data`) for `getAtPath` with `data.*` paths. */
export function wrapPersonalizationProfileRoot(inner: unknown): Record<string, unknown> {
  return { data: inner } as Record<string, unknown>
}
