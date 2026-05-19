import {
  fieldPathSuffixFromStored,
  normalizeRulesFieldPath,
  wrapPersonalizationProfileRoot,
} from './personalizationFieldPath'
import { getAtPath } from './path'
import {
  mappingRowMatches,
  type ComparisonOperator,
} from './ruleMatch'

export type MappingCondition = {
  fieldPath: string
  operator: ComparisonOperator
  value: string
}

/** Condition participates in AND matching when the author entered a path after `data.`. */
export function isConditionActive(condition: MappingCondition): boolean {
  return fieldPathSuffixFromStored(condition.fieldPath).trim().length > 0
}

export function mappingConditionsMatch(
  profileData: unknown,
  conditions: MappingCondition[],
): boolean {
  const active = conditions.filter(isConditionActive)
  if (active.length === 0) return false
  const root = wrapPersonalizationProfileRoot(profileData)
  return active.every((c) => {
    const resolved = getAtPath(root, normalizeRulesFieldPath(c.fieldPath))
    return mappingRowMatches(resolved, c.operator, c.value)
  })
}

/** Map path suffix (after `data.`) → resolved API value for template interpolation. */
export function resolvedValuesByPathSuffix(
  profileData: unknown,
  conditions: MappingCondition[],
): Record<string, unknown> {
  const root = wrapPersonalizationProfileRoot(profileData)
  const out: Record<string, unknown> = {}
  for (const c of conditions) {
    const suffix = fieldPathSuffixFromStored(c.fieldPath)
    if (!suffix.trim()) continue
    out[suffix] = getAtPath(root, normalizeRulesFieldPath(c.fieldPath))
  }
  return out
}

export function firstActiveConditionValue(
  profileData: unknown,
  conditions: MappingCondition[],
): unknown {
  const active = conditions.filter(isConditionActive)
  if (active.length === 0) return undefined
  const root = wrapPersonalizationProfileRoot(profileData)
  return getAtPath(root, normalizeRulesFieldPath(active[0].fieldPath))
}
