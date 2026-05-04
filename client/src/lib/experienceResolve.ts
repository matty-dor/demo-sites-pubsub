import type { DynamicContentState } from '../store/eventDynamicRulesSlice'
import { normalizeDynamicContentState } from '../store/eventDynamicRulesSlice'
import { wrapPersonalizationProfileRoot } from './personalizationFieldPath'
import { getAtPath } from './path'
import { mappingRowMatches } from './ruleMatch'
import { isValidHttpUrl } from './urlValidation'

export type LiveExperienceView =
  | {
      kind: 'static_text'
      source: 'matched' | 'default'
      text: string
    }
  | {
      kind: 'static_image'
      source: 'matched' | 'default'
      url: string
    }
  | {
      kind: 'dynamic_image'
      source: 'matched' | 'default'
      url: string
    }
  | {
      kind: 'empty'
      source: 'default'
      message: string
    }

/**
 * Resolve which content to show for saved rules. `data` is the profile object from
 * `personalizationResponse.data` (or the proxy’s inner payload); paths always include the `data.`
 * prefix and are resolved against `{ data }` so they match the full API JSON shape.
 */
export function resolveLiveExperience(
  rules: DynamicContentState,
  data: unknown,
): LiveExperienceView {
  const r = normalizeDynamicContentState(rules)
  const root = wrapPersonalizationProfileRoot(data)
  const keyVal = getAtPath(root, r.fieldPath)

  if (r.contentSourceMode === 'static') {
    const row = r.staticMappings.find((m) =>
      mappingRowMatches(keyVal, m.operator, m.value),
    )

    let contentType = r.defaultStatic.contentType
    let raw = r.defaultStatic.content
    let source: 'matched' | 'default' = 'default'

    if (row && row.content.trim()) {
      contentType = row.contentType
      raw = row.content
      source = 'matched'
    }

    const c = raw.trim()
    if (!c) {
      return {
        kind: 'empty',
        source: 'default',
        message:
          'No content for this outcome (add Default Content or a matching row with content).',
      }
    }
    if (contentType === 'text') {
      return { kind: 'static_text', source, text: c }
    }
    if (!isValidHttpUrl(c)) {
      return {
        kind: 'static_text',
        source,
        text: 'Invalid image URL',
      }
    }
    return { kind: 'static_image', source, url: c }
  }

  const row = r.dynamicMappings.find((m) =>
    mappingRowMatches(keyVal, m.operator, m.value),
  )
  const fromRow = row?.imageUrl?.trim()
  const fallback = r.defaultDynamicContent.trim()
  const url = fromRow || fallback
  if (!url) {
    return {
      kind: 'empty',
      source: 'default',
      message:
        'No image URL for this outcome (add Default image URL or a matching row).',
    }
  }
  if (!isValidHttpUrl(url)) {
    return {
      kind: 'empty',
      source: 'default',
      message: 'Resolved image URL is not valid http(s).',
    }
  }
  const source: 'matched' | 'default' = fromRow ? 'matched' : 'default'
  return { kind: 'dynamic_image', source, url }
}
