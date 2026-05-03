export type ComparisonOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte'

export const COMPARISON_OPERATORS: ComparisonOperator[] = [
  'eq',
  'gt',
  'lt',
  'gte',
  'lte',
  'neq',
]

export const OPERATOR_LABELS: Record<ComparisonOperator, string> = {
  eq: 'Equals',
  gt: 'Greater than',
  lt: 'Less than',
  gte: 'Greater than or equal to',
  lte: 'Less than or equal to',
  neq: 'Not equal to',
}

export function normalizeComparisonOperator(raw: string | undefined): ComparisonOperator {
  return COMPARISON_OPERATORS.includes(raw as ComparisonOperator)
    ? (raw as ComparisonOperator)
    : 'eq'
}

/**
 * Compare API field value to the rule threshold (saved in "Example API Response Value").
 * Ordering operators require finite numbers on both sides; otherwise false.
 */
/** Use for mapping rows: ordering ops need a non-empty threshold. */
export function mappingRowMatches(
  resolved: unknown,
  operator: ComparisonOperator,
  threshold: string,
): boolean {
  const t = threshold.trim()
  if (t === '' && operator !== 'eq' && operator !== 'neq') return false
  return compareResolvedToThreshold(resolved, operator, threshold)
}

export function compareResolvedToThreshold(
  resolved: unknown,
  operator: ComparisonOperator,
  threshold: string,
): boolean {
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
