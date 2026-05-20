/**
 * Relative window checks for ISO date/time strings from the Personalization API
 * (e.g. `2026-07-16T00:00:00Z`). Reference time defaults to `Date.now()` when the rule runs.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000

/** Parse leading number from thresholds like `7`, `7 days`, or `14days`. */
export function parseDaysThreshold(threshold: string): number | null {
  const t = threshold.trim()
  if (!t) return null
  const m = t.match(/^(\d+(?:\.\d+)?)/)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n) || n < 0) return null
  return n
}

/** Milliseconds since epoch, or null when the value is not a parseable instant. */
export function parseResolvedInstant(resolved: unknown): number | null {
  if (resolved === undefined || resolved === null) return null
  if (typeof resolved === 'number' && Number.isFinite(resolved)) {
    return resolved
  }
  const s = String(resolved).trim()
  if (!s) return null
  const ms = Date.parse(s)
  return Number.isFinite(ms) ? ms : null
}

/**
 * True when `resolved` is a parseable instant in [referenceMs - days, referenceMs]
 * (inclusive). Future instants relative to reference do not match.
 */
export function occurredWithinLastDays(
  resolved: unknown,
  days: number,
  referenceMs: number = Date.now(),
): boolean {
  if (!Number.isFinite(days) || days < 0) return false
  const instant = parseResolvedInstant(resolved)
  if (instant === null) return false
  const windowStart = referenceMs - days * MS_PER_DAY
  return instant >= windowStart && instant <= referenceMs
}

export function didNotOccurWithinLastDays(
  resolved: unknown,
  days: number,
  referenceMs: number = Date.now(),
): boolean {
  return !occurredWithinLastDays(resolved, days, referenceMs)
}
