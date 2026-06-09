/**
 * UI state → GrowthLoop audience `json_query` object.
 * Shape follows the public API create-audience examples (base_query + result_query).
 */

export type FilterOperator =
  | 'in'
  | 'eq'
  | 'neq'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'

export const FILTER_OPERATORS: FilterOperator[] = [
  'in',
  'eq',
  'neq',
  'gt',
  'lt',
  'gte',
  'lte',
]

export const FILTER_OPERATOR_LABELS: Record<FilterOperator, string> = {
  in: 'in (list)',
  eq: 'equals',
  neq: 'not equal',
  gt: 'greater than',
  lt: 'less than',
  gte: 'greater than or equal',
  lte: 'less than or equal',
}

export type AudienceFilterRow = {
  id: string
  operator: FilterOperator
  /** Column on the row’s table, or a full qualified name if it contains `.` */
  column: string
  /** Comma-separated for `in`; single value otherwise */
  value: string
}

export type PrimaryTableConfig = {
  /** e.g. PUBLIC.MY_CUSTOMER_DATA */
  tableRef: string
  /** Alias in `fields`, e.g. CUSTOMER_ID */
  primaryKeyAlias: string
  /** Column on the table for the primary key */
  primaryKeyColumn: string
  filters: AudienceFilterRow[]
}

export type JoinedTableConfig = {
  id: string
  tableRef: string
  joinType: 'left' | 'inner'
  /** Column on the primary (base) table used in the join */
  joinOnPrimaryColumn: string
  /** Column on this joined table */
  joinOnJoinedColumn: string
  filters: AudienceFilterRow[]
}

export type JsonQueryBuilderState = {
  primary: PrimaryTableConfig
  joins: JoinedTableConfig[]
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `f_${Math.random().toString(36).slice(2)}`
}

export function emptyFilterRow(): AudienceFilterRow {
  return { id: newId(), operator: 'in', column: '', value: '' }
}

export function defaultJsonQueryBuilderState(): JsonQueryBuilderState {
  return {
    primary: {
      tableRef: '',
      primaryKeyAlias: 'CUSTOMER_ID',
      primaryKeyColumn: 'CUSTOMER_ID',
      filters: [],
    },
    joins: [],
  }
}

export function emptyJoinedTable(): JoinedTableConfig {
  return {
    id: newId(),
    tableRef: '',
    joinType: 'left',
    joinOnPrimaryColumn: 'CUSTOMER_ID',
    joinOnJoinedColumn: 'CUSTOMER_ID',
    filters: [],
  }
}

/** Fully qualified field name: `TABLE.COLUMN` unless column already qualified. */
export function qualifiedField(tableRef: string, column: string): string {
  const col = column.trim()
  if (!col) return ''
  if (col.includes('.')) return col
  const table = tableRef.trim()
  return table ? `${table}.${col}` : col
}

function parseFilterValue(operator: FilterOperator, value: string): unknown {
  const t = value.trim()
  if (operator === 'in') {
    return t
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
  }
  if (operator === 'gt' || operator === 'lt' || operator === 'gte' || operator === 'lte') {
    const n = Number(t)
    return Number.isFinite(n) ? n : t
  }
  return t
}

function compileFilters(
  tableRef: string,
  rows: AudienceFilterRow[],
): Array<{
  operator: string
  field_name: string
  field_value: unknown
}> {
  return rows
    .filter((r) => r.column.trim() && r.value.trim())
    .map((r) => ({
      operator: r.operator,
      field_name: qualifiedField(tableRef, r.column),
      field_value: parseFilterValue(r.operator, r.value),
    }))
}

export type CompiledJsonQuery = {
  queries: Record<string, unknown>
  operation: string
  result_query: {
    join: Array<{
      on: Array<Record<string, string>>
      left: string
      type: string
      right: string
    }>
    fields: Record<string, string>
  }
}

/**
 * Build the `json_query` payload from builder state. Omitted or empty filters → `{ and: [] }`.
 */
export function compileJsonQuery(state: JsonQueryBuilderState): CompiledJsonQuery {
  const primaryTable = state.primary.tableRef.trim()
  const pkAlias = state.primary.primaryKeyAlias.trim() || 'CUSTOMER_ID'
  const pkPath = qualifiedField(
    primaryTable,
    state.primary.primaryKeyColumn.trim() || pkAlias,
  )

  const base_query = {
    join: [] as unknown[],
    fields: { [pkAlias]: pkPath },
    filter: { and: compileFilters(primaryTable, state.primary.filters) },
  }

  const queries: Record<string, unknown> = { base_query }

  const resultJoins: CompiledJsonQuery['result_query']['join'] = []

  if (primaryTable) {
    resultJoins.push({
      on: [{ [`operation.${pkAlias}`]: pkPath }],
      left: 'operation',
      type: 'left',
      right: primaryTable,
    })
  }

  state.joins.forEach((join, index) => {
    const joinedTable = join.tableRef.trim()
    if (!joinedTable) return

    const onPrimary = qualifiedField(primaryTable, join.joinOnPrimaryColumn)
    const onJoined = qualifiedField(joinedTable, join.joinOnJoinedColumn)
    const joinSpec = {
      on: [{ [onPrimary]: onJoined }],
      left: primaryTable || 'operation',
      type: join.joinType,
      right: joinedTable,
    }

    const queryKey = `join_${index + 1}`
    queries[queryKey] = {
      join: [joinSpec],
      fields: { [pkAlias]: onPrimary || pkPath },
      filter: { and: compileFilters(joinedTable, join.filters) },
    }

    resultJoins.push(joinSpec)
  })

  return {
    queries,
    operation: 'base_query',
    result_query: {
      join: resultJoins,
      fields: { [pkAlias]: `operation.${pkAlias}` },
    },
  }
}

export function validateJsonQueryBuilder(state: JsonQueryBuilderState): string | null {
  if (!state.primary.tableRef.trim()) {
    return 'Primary table reference is required (e.g. PUBLIC.MY_CUSTOMER_DATA).'
  }
  const pkPath = qualifiedField(
    state.primary.tableRef,
    state.primary.primaryKeyColumn || state.primary.primaryKeyAlias,
  )
  if (!pkPath) {
    return 'Primary key column is required.'
  }
  for (let i = 0; i < state.joins.length; i++) {
    const j = state.joins[i]
    if (!j.tableRef.trim()) {
      return `Joined table ${i + 1}: table reference is required.`
    }
  }
  return null
}
