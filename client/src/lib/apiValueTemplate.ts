/**
 * Tiny templating helper for v2 Dynamic Content variations.
 *
 * Authors place the literal token `{{api_value}}` (whitespace inside the braces is tolerated)
 * inside their text Content. At render time we substitute the resolved Personalization API
 * value at the configured `data.…` field path.
 *
 * Scope is intentionally narrow: a single token, text Content only, no expressions or filters.
 * URL Content does not interpolate (a URL with template syntax would fail validation upstream).
 */

const API_VALUE_TOKEN = /\{\{\s*api_value\s*\}\}/g

export const API_VALUE_TEMPLATE_HINT =
  "If you want the value from the Personalization API to be included in your content, type \u2018{{api_value}}\u2019 wherever you want that value to appear in your text."

export function interpolateApiValue(text: string, value: unknown): string {
  if (!text.includes('{{')) return text
  const replacement =
    value === undefined || value === null ? '' : String(value)
  return text.replace(API_VALUE_TOKEN, replacement)
}
