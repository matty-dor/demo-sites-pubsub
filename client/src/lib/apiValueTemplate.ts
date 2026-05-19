/**
 * Tiny templating helper for v2 Dynamic Content variations.
 *
 * Authors place tokens in text Content:
 * - `{{api_value}}` — value from the first active condition (legacy / shorthand)
 * - `{{api_value:segment}}` — value at `data.segment` (suffix matches the path after `data.`)
 *
 * Scope is intentionally narrow: no expressions or filters. URL Content does not interpolate.
 */

const API_VALUE_TOKEN = /\{\{\s*api_value(?:\s*:\s*([^}]+?))?\s*\}\}/g

export const API_VALUE_TEMPLATE_HINT =
  'Use {{api_value}} for the first condition’s value, or {{api_value:path}} using the segment after data. (e.g. {{api_value:segment}} or {{api_value:tier}}).'

export function interpolateApiValues(
  text: string,
  valuesBySuffix: Record<string, unknown>,
  firstConditionValue?: unknown,
): string {
  if (!text.includes('{{')) return text
  return text.replace(API_VALUE_TOKEN, (_match, rawKey?: string) => {
    const key = rawKey?.trim()
    const resolved =
      key ?
        valuesBySuffix[key]
      : firstConditionValue
    return resolved === undefined || resolved === null ? '' : String(resolved)
  })
}

/** @deprecated Prefer {@link interpolateApiValues} with a suffix map. */
export function interpolateApiValue(text: string, value: unknown): string {
  return interpolateApiValues(text, {}, value)
}
