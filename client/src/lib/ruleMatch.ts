import { occurredWithinLastDays, parseDaysThreshold } from './relativeDateMatch'

export type ComparisonOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'is_null'
  | 'is_not_null'
  | 'within_last_days'
  | 'not_within_last_days'

export const COMPARISON_OPERATORS: ComparisonOperator[] = [
  'eq',
  'gt',
  'lt',
  'gte',
  'lte',
  'neq',
  'is_null',
  'is_not_null',
  'within_last_days',
  'not_within_last_days',
]

export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  eq: 'Equals',
  gt: 'Greater than',
  lt: 'Less than',
  gte: 'Greater than or equal to',
  lte: 'Less than or equal to',
  neq: 'Not equal to',
  is_null: 'Is null',
  is_not_null: 'Is not null',
  within_last_days: 'Occurred within the last',
  not_within_last_days: 'Did not occur within the last',
}

export type OperatorThresholdKind = 'example' | 'days' | 'none'

/** True when the path value is missing (`undefined`) or JSON `null`. */
export function isNullishResolved(resolved: unknown): boolean {
  return resolved === undefined || resolved === null
}

export function operatorThresholdKind(
  operator: ComparisonOperator,
): OperatorThresholdKind {
  if (operator === 'is_null' || operator === 'is_not_null') return 'none'
  if (operator === 'within_last_days' || operator === 'not_within_last_days') {
    return 'days'
  }
  return 'example'
}

/** @deprecated Use {@link operatorThresholdKind} instead. */
export function operatorUsesExampleThreshold(operator: ComparisonOperator): boolean {
  return operatorThresholdKind(operator) === 'example'
}

export function operatorThresholdFieldLabel(operator: ComparisonOperator): string {
  const kind = operatorThresholdKind(operator)
  if (kind === 'days') return 'Days'
  if (kind === 'none') return 'Example API Response Value'
  return 'Example API Response Value'
}

export function operatorThresholdPlaceholder(
  operator: ComparisonOperator,
): string {
  const kind = operatorThresholdKind(operator)
  if (kind === 'days') {
    return 'e.g. 7 (rolling 24h periods, evaluated when the rule runs)'
  }
  if (kind === 'none') return 'Not used for Is null / Is not null'
  return 'Compare to this value (e.g. luxury or 10)'
}

export function normalizeComparisonOperator(raw: string | undefined): ComparisonOperator {
  return COMPARISON_OPERATORS.includes(raw as ComparisonOperator)
    ? (raw as ComparisonOperator)
    : 'eq'
}

export type MappingMatchOptions = {
  /** Wall-clock reference for relative date operators (defaults to `Date.now()`). */
  referenceMs?: number
}

/**
 * Compare API field value to the rule threshold (saved in "Example API Response Value"
 * or a day count for relative date operators).
 */
export function mappingRowMatches(
  resolved: unknown,
  operator: ComparisonOperator,
  threshold: string,
  options?: MappingMatchOptions,
): boolean {
  if (operator === 'is_null') return isNullishResolved(resolved)
  if (operator === 'is_not_null') return !isNullishResolved(resolved)

  if (operator === 'within_last_days' || operator === 'not_within_last_days') {
    const days = parseDaysThreshold(threshold)
    if (days === null) return false
    const ref = options?.referenceMs ?? Date.now()
    const within = occurredWithinLastDays(resolved, days, ref)
    return operator === 'within_last_days' ? within : !within
  }

  const t = threshold.trim()
  if (t === '' && operator !== 'eq' && operator !== 'neq') return false
  return compareResolvedToThreshold(resolved, operator, threshold, options)
}

export function compareResolvedToThreshold(
  resolved: unknown,
  operator: ComparisonOperator,
  threshold: string,
  options?: MappingMatchOptions,
): boolean {
  if (operator === 'is_null') return isNullishResolved(resolved)
  if (operator === 'is_not_null') return !isNullishResolved(resolved)

  if (operator === 'within_last_days' || operator === 'not_within_last_days') {
    const days = parseDaysThreshold(threshold)
    if (days === null) return false
    const ref = options?.referenceMs ?? Date.now()
    const within = occurredWithinLastDays(resolved, days, ref)
    return operator === 'within_last_days' ? within : !within
  }

  const t = threshold.trim()
  const rStr =
    resolved === undefined || resolved === null ? '' : String(resolved).trim()

  if (operator === 'eq') return rStr === t
  if (operator === 'neq') return rStr !== t

  const rNum = Number(rStr)
  const tNum = Number(t)
  if (!Number.isFinite(rNum) || !Number.isFinite(tNum)) return false

  switch (operator) {
    case 'gt':
      return rNum > tNum
    case 'lt':
      return rNum < tNum
    case 'gte':
      return rNum >= tNum
    case 'lte':
      return rNum <= tNum
    default:
      return false
  }
}
