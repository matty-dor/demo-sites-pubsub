/**
 * UI state → GrowthLoop audience `json_query` object.
 * Simple audiences: flat `queries.base_query` + `result_query`.
 * Joined / aggregated audiences: `base_query.with` subqueries (GrowthLoop platform shape).
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
  eq: 'equals (=)',
  neq: 'not equal (!=)',
  gt: 'greater than (>)',
  lt: 'less than (<)',
  gte: 'greater than or equal (>=)',
  lte: 'less than or equal (<=)',
}

export type FilterValueType = 'auto' | 'string' | 'number' | 'date_expression'

export const FILTER_VALUE_TYPES: FilterValueType[] = [
  'auto',
  'string',
  'number',
  'date_expression',
]

export const FILTER_VALUE_TYPE_LABELS: Record<FilterValueType, string> = {
  auto: 'Auto-detect',
  string: 'Text',
  number: 'Number',
  date_expression: 'Date expression',
}

export type AudienceFilterRow = {
  id: string
  operator: FilterOperator
  /** Column on the row's table, or a full qualified name if it contains `.` */
  column: string
  /** Comma-separated for `in`; single value otherwise */
  value: string
  valueType: FilterValueType
}

export type AudienceFilterGroup = {
  id: string
  filters: AudienceFilterRow[]
}

export type AggregateFunction = 'COUNT' | 'SUM' | 'AVG' | 'MIN' | 'MAX'

export type AggregateField = {
  id: string
  alias: string
  func: AggregateFunction
  /** `*` or a column name */
  field: string
}

export type PrimaryTableConfig = {
  /** e.g. industry_retail.customers */
  tableRef: string
  /** Alias in `fields`, e.g. customer_id */
  primaryKeyAlias: string
  /** Column on the table for the primary key */
  primaryKeyColumn: string
  filters: AudienceFilterRow[]
  filterGroups: AudienceFilterGroup[]
}

export type JoinedTableConfig = {
  id: string
  tableRef: string
  joinType: 'left' | 'inner'
  /** Field key on the primary WITH subquery used in the join */
  joinOnPrimaryField: string
  /** Field key on this joined WITH subquery used in the join */
  joinOnJoinedField: string
  /** Physical column on the joined table for the join key (qualified in WITH fields) */
  joinKeyColumn: string
  filters: AudienceFilterRow[]
  filterGroups: AudienceFilterGroup[]
  aggregate: boolean
  groupByColumn: string
  aggregateFields: AggregateField[]
}

export type PostJoinFilterRow = {
  id: string
  /** JoinedTableConfig.id */
  joinId: string
  /** Field on the joined WITH alias, e.g. count */
  fieldName: string
  operator: FilterOperator
  value: string
  valueType: FilterValueType
  /** When set, emits field_func.coalesce */
  coalesce?: string
}

export type JsonQueryBuilderState = {
  primary: PrimaryTableConfig
  joins: JoinedTableConfig[]
  postJoinFilters: PostJoinFilterRow[]
}

const OPERATOR_TO_API: Record<FilterOperator, string> = {
  in: 'in',
  eq: '=',
  neq: '!=',
  gt: '>',
  lt: '<',
  gte: '>=',
  lte: '<=',
}

function newId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `f_${Math.random().toString(36).slice(2)}`
}

export function emptyFilterRow(): AudienceFilterRow {
  return {
    id: newId(),
    operator: 'in',
    column: '',
    value: '',
    valueType: 'auto',
  }
}

export function emptyFilterGroup(): AudienceFilterGroup {
  return { id: newId(), filters: [emptyFilterRow(), emptyFilterRow()] }
}

export function emptyAggregateField(): AggregateField {
  return { id: newId(), alias: 'count', func: 'COUNT', field: '*' }
}

export function defaultJsonQueryBuilderState(): JsonQueryBuilderState {
  return {
    primary: {
      tableRef: '',
      primaryKeyAlias: 'customer_id',
      primaryKeyColumn: 'customer_id',
      filters: [],
      filterGroups: [],
    },
    joins: [],
    postJoinFilters: [],
  }
}

export function emptyJoinedTable(): JoinedTableConfig {
  return {
    id: newId(),
    tableRef: '',
    joinType: 'left',
    joinOnPrimaryField: 'customer_id',
    joinOnJoinedField: 'customer_id',
    joinKeyColumn: 'customer_id',
    filters: [],
    filterGroups: [],
    aggregate: false,
    groupByColumn: 'customer_id',
    aggregateFields: [emptyAggregateField()],
  }
}

export function emptyPostJoinFilter(joinId: string): PostJoinFilterRow {
  return {
    id: newId(),
    joinId,
    fieldName: 'count',
    operator: 'gt',
    value: '0',
    valueType: 'number',
    coalesce: '0',
  }
}

/** Stable WITH alias matching GrowthLoop's `table_hash_base_query` pattern. */
export function withSubqueryAlias(tableRef: string, stableId: string): string {
  const segment = tableRef.split('.').pop() ?? 'table'
  const slug =
    segment.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase() || 'table'
  const suffix = stableId.replace(/[^a-z0-9]/gi, '').slice(0, 6).toLowerCase() || '0'
  return `${slug}_${suffix}_base_query`
}

/** Fully qualified field name: `TABLE.COLUMN` unless column already qualified. */
export function qualifiedField(tableRef: string, column: string): string {
  const col = column.trim()
  if (!col) return ''
  if (col.includes('.')) return col
  const table = tableRef.trim()
  return table ? `${table}.${col}` : col
}

function parseListValue(raw: string): unknown[] {
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((item) => {
      const n = Number(item)
      return Number.isFinite(n) && item !== '' ? n : item
    })
}

export function parseFilterValue(
  operator: FilterOperator,
  value: string,
  valueType: FilterValueType,
): unknown {
  const t = value.trim()
  if (!t) return t

  if (valueType === 'number') {
    const n = Number(t)
    return Number.isFinite(n) ? n : t
  }
  if (valueType === 'date_expression' || valueType === 'string') {
    return t
  }

  // auto
  if (operator === 'in') {
    return parseListValue(t)
  }
  if (
    operator === 'gt' ||
    operator === 'lt' ||
    operator === 'gte' ||
    operator === 'lte'
  ) {
    const n = Number(t)
    return Number.isFinite(n) ? n : t
  }
  return t
}

type CompiledFilter = Record<string, unknown>

function compileFilterRow(
  tableRef: string,
  row: AudienceFilterRow,
): CompiledFilter | null {
  if (!row.column.trim() || !row.value.trim()) return null
  return {
    operator: OPERATOR_TO_API[row.operator],
    field_name: qualifiedField(tableRef, row.column),
    field_value: parseFilterValue(row.operator, row.value, row.valueType),
  }
}

function compileFilterAnd(
  tableRef: string,
  rows: AudienceFilterRow[],
  groups: AudienceFilterGroup[],
): CompiledFilter[] {
  const items: CompiledFilter[] = rows
    .map((row) => compileFilterRow(tableRef, row))
    .filter((item): item is CompiledFilter => item !== null)

  for (const group of groups) {
    const nested = group.filters
      .map((row) => compileFilterRow(tableRef, row))
      .filter((item): item is CompiledFilter => item !== null)
    if (nested.length > 0) {
      items.push({ and: nested })
    }
  }

  return items
}

function compilePostJoinFilter(
  joinAlias: string,
  row: PostJoinFilterRow,
): CompiledFilter | null {
  if (!row.fieldName.trim() || !row.value.trim()) return null
  const cond: CompiledFilter = {
    operator: OPERATOR_TO_API[row.operator],
    field_name: `${joinAlias}.${row.fieldName.trim()}`,
    field_value: parseFilterValue(row.operator, row.value, row.valueType),
  }
  const coalesce = row.coalesce?.trim()
  if (coalesce !== undefined && coalesce !== '') {
    const n = Number(coalesce)
    cond.field_func = { coalesce: Number.isFinite(n) ? n : coalesce }
  }
  return cond
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

function compileSimpleJsonQuery(state: JsonQueryBuilderState): CompiledJsonQuery {
  const primaryTable = state.primary.tableRef.trim()
  const pkAlias = state.primary.primaryKeyAlias.trim() || 'customer_id'
  const pkPath = qualifiedField(
    primaryTable,
    state.primary.primaryKeyColumn.trim() || pkAlias,
  )

  const base_query = {
    join: [] as unknown[],
    fields: { [pkAlias]: pkPath },
    filter: {
      and: compileFilterAnd(
        primaryTable,
        state.primary.filters,
        state.primary.filterGroups,
      ),
    },
  }

  return {
    queries: { base_query },
    operation: 'base_query',
    result_query: {
      join: primaryTable
        ? [
            {
              on: [{ [`operation.${pkAlias}`]: pkPath }],
              left: 'operation',
              type: 'left',
              right: primaryTable,
            },
          ]
        : [],
      fields: { [pkAlias]: `operation.${pkAlias}` },
    },
  }
}

function compileWithJoinJsonQuery(state: JsonQueryBuilderState): CompiledJsonQuery {
  const primaryTable = state.primary.tableRef.trim()
  const pkAlias = state.primary.primaryKeyAlias.trim() || 'customer_id'
  const pkPath = qualifiedField(
    primaryTable,
    state.primary.primaryKeyColumn.trim() || pkAlias,
  )
  const primaryAlias = withSubqueryAlias(primaryTable, 'primary')

  const withClause: Record<string, unknown> = {
    [primaryAlias]: {
      join: [],
      fields: { [pkAlias]: pkPath },
      filter: {
        and: compileFilterAnd(
          primaryTable,
          state.primary.filters,
          state.primary.filterGroups,
        ),
      },
    },
  }

  const joinSpecs: CompiledJsonQuery['result_query']['join'] = []
  const baseJoins: Array<{
    on: Array<Record<string, string>>
    left: string
    type: string
    right: string
  }> = []

  const joinAliasById = new Map<string, string>()

  for (const join of state.joins) {
    const joinedTable = join.tableRef.trim()
    if (!joinedTable) continue

    const joinAlias = withSubqueryAlias(joinedTable, join.id)
    joinAliasById.set(join.id, joinAlias)

    const joinKeyField = join.joinOnJoinedField.trim() || pkAlias
    const joinKeyPath = qualifiedField(
      joinedTable,
      join.joinKeyColumn.trim() || joinKeyField,
    )

    const fields: Record<string, unknown> = {
      [joinKeyField]: joinKeyPath,
    }

    if (join.aggregate) {
      for (const agg of join.aggregateFields) {
        const alias = agg.alias.trim()
        if (!alias) continue
        fields[alias] = { [agg.func]: agg.field.trim() || '*' }
      }
    }

    const subquery: Record<string, unknown> = {
      join: [],
      fields,
      filter: {
        and: compileFilterAnd(joinedTable, join.filters, join.filterGroups),
      },
    }

    if (join.aggregate && join.groupByColumn.trim()) {
      subquery.group_by = [qualifiedField(joinedTable, join.groupByColumn)]
    }

    withClause[joinAlias] = subquery

    const primaryField = join.joinOnPrimaryField.trim() || pkAlias
    baseJoins.push({
      on: [{ [`${primaryAlias}.${primaryField}`]: `${joinAlias}.${joinKeyField}` }],
      left: primaryAlias,
      type: join.joinType,
      right: joinAlias,
    })
  }

  const postJoinItems = state.postJoinFilters
    .map((row) => {
      const joinAlias = joinAliasById.get(row.joinId)
      if (!joinAlias) return null
      return compilePostJoinFilter(joinAlias, row)
    })
    .filter((item): item is CompiledFilter => item !== null)

  const base_query = {
    join: baseJoins,
    with: withClause,
    fields: { [pkAlias]: `${primaryAlias}.${pkAlias}` },
    filter: { and: postJoinItems },
  }

  if (primaryTable) {
    joinSpecs.push({
      on: [{ [`operation.${pkAlias}`]: pkPath }],
      left: 'operation',
      type: 'left',
      right: primaryTable,
    })
  }

  return {
    queries: { base_query },
    operation: 'base_query',
    result_query: {
      join: joinSpecs,
      fields: { [pkAlias]: `operation.${pkAlias}` },
    },
  }
}

/**
 * Build the `json_query` payload from builder state.
 * No joins → flat base_query. With joins → `with` subqueries + base_query.join.
 */
export function compileJsonQuery(state: JsonQueryBuilderState): CompiledJsonQuery {
  const hasJoin = state.joins.some((j) => j.tableRef.trim())
  if (!hasJoin) {
    return compileSimpleJsonQuery(state)
  }
  return compileWithJoinJsonQuery(state)
}

export function validateJsonQueryBuilder(state: JsonQueryBuilderState): string | null {
  if (!state.primary.tableRef.trim()) {
    return 'Primary table reference is required (e.g. industry_retail.customers).'
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
    if (j.aggregate) {
      if (!j.groupByColumn.trim()) {
        return `Joined table ${i + 1}: group-by column is required when aggregating.`
      }
      const hasAgg = j.aggregateFields.some((a) => a.alias.trim())
      if (!hasAgg) {
        return `Joined table ${i + 1}: at least one aggregate field alias is required.`
      }
    }
  }
  return null
}
