import {
  compileJsonQuery,
  emptyAggregateField,
  emptyFilterGroup,
  emptyFilterRow,
  emptyJoinedTable,
  emptyPostJoinFilter,
  FILTER_OPERATOR_LABELS,
  FILTER_OPERATORS,
  FILTER_VALUE_TYPE_LABELS,
  FILTER_VALUE_TYPES,
  type AggregateField,
  type AudienceFilterGroup,
  type AudienceFilterRow,
  type JsonQueryBuilderState,
  type JoinedTableConfig,
  type PostJoinFilterRow,
} from '../lib/growthloopJsonQueryBuilder'

type Props = {
  state: JsonQueryBuilderState
  onChange: (next: JsonQueryBuilderState) => void
}

function FilterRowsEditor({
  rows,
  onChange,
}: {
  rows: AudienceFilterRow[]
  onChange: (rows: AudienceFilterRow[]) => void
}) {
  function patchRow(id: string, patch: Partial<AudienceFilterRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <>
      {rows.map((row, idx) => (
        <div key={row.id} className="audience-query-filter-row form-grid">
          <label className="stack-label">
            <span className="muted small">Operator</span>
            <select
              className="input"
              value={row.operator}
              onChange={(e) =>
                patchRow(row.id, {
                  operator: e.target.value as AudienceFilterRow['operator'],
                })
              }
            >
              {FILTER_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {FILTER_OPERATOR_LABELS[op]}
                </option>
              ))}
            </select>
          </label>
          <label className="stack-label">
            <span className="muted small">Column</span>
            <input
              className="input"
              value={row.column}
              onChange={(e) => patchRow(row.id, { column: e.target.value })}
              placeholder="product_type or TABLE.COLUMN"
            />
          </label>
          <label className="stack-label">
            <span className="muted small">Value type</span>
            <select
              className="input"
              value={row.valueType}
              onChange={(e) =>
                patchRow(row.id, {
                  valueType: e.target.value as AudienceFilterRow['valueType'],
                })
              }
            >
              {FILTER_VALUE_TYPES.map((vt) => (
                <option key={vt} value={vt}>
                  {FILTER_VALUE_TYPE_LABELS[vt]}
                </option>
              ))}
            </select>
          </label>
          <label className="stack-label audience-query-filter-value">
            <span className="muted small">
              Value{row.operator === 'in' ? 's (comma-separated)' : ''}
            </span>
            <input
              className="input"
              value={row.value}
              onChange={(e) => patchRow(row.id, { value: e.target.value })}
              placeholder={
                row.valueType === 'date_expression'
                  ? "DATE('30 day ago')"
                  : row.operator === 'in'
                    ? 'Apparel, Food & Beverage'
                    : 'e.g. 100'
              }
            />
          </label>
          <div className="audience-query-filter-actions">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              aria-label={`Remove filter ${idx + 1}`}
              onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </>
  )
}

function FilterGroupsEditor({
  groups,
  onChange,
}: {
  groups: AudienceFilterGroup[]
  onChange: (groups: AudienceFilterGroup[]) => void
}) {
  if (groups.length === 0) return null

  return (
    <div className="audience-query-filter-groups">
      {groups.map((group, groupIdx) => (
        <div key={group.id} className="audience-query-filter-group card-nested">
          <div className="audience-query-subhead">
            <span className="muted small">
              Nested <code>and</code> group {groupIdx + 1}
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-small"
              onClick={() => onChange(groups.filter((g) => g.id !== group.id))}
            >
              Remove group
            </button>
          </div>
          <FilterRowsEditor
            rows={group.filters}
            onChange={(filters) =>
              onChange(
                groups.map((g) => (g.id === group.id ? { ...g, filters } : g)),
              )
            }
          />
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              onChange(
                groups.map((g) =>
                  g.id === group.id
                    ? { ...g, filters: [...g.filters, emptyFilterRow()] }
                    : g,
                ),
              )
            }
          >
            Add condition to group
          </button>
        </div>
      ))}
    </div>
  )
}

function TableFiltersEditor({
  tableLabel,
  tableRef,
  filters,
  filterGroups,
  onFiltersChange,
  onGroupsChange,
}: {
  tableLabel: string
  tableRef: string
  filters: AudienceFilterRow[]
  filterGroups: AudienceFilterGroup[]
  onFiltersChange: (rows: AudienceFilterRow[]) => void
  onGroupsChange: (groups: AudienceFilterGroup[]) => void
}) {
  return (
    <div className="audience-query-filters">
      <div className="audience-query-subhead">
        <span className="muted small">
          Filters on <strong>{tableLabel}</strong>
          {tableRef.trim() ? (
            <>
              {' '}
              (<code>{tableRef.trim()}</code>)
            </>
          ) : null}
        </span>
        <div className="audience-query-filter-toolbar">
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => onFiltersChange([...filters, emptyFilterRow()])}
          >
            Add filter
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() => onGroupsChange([...filterGroups, emptyFilterGroup()])}
          >
            Add AND group
          </button>
        </div>
      </div>
      {filters.length === 0 && filterGroups.length === 0 && (
        <p className="muted small audience-query-empty-hint">
          No filters yet. Conditions compile into <code>filter.and</code> on this
          table&apos;s subquery.
        </p>
      )}
      <FilterRowsEditor rows={filters} onChange={onFiltersChange} />
      <FilterGroupsEditor groups={filterGroups} onChange={onGroupsChange} />
    </div>
  )
}

function AggregateFieldsEditor({
  tableRef,
  fields,
  onChange,
}: {
  tableRef: string
  fields: AggregateField[]
  onChange: (fields: AggregateField[]) => void
}) {
  function patchField(id: string, patch: Partial<AggregateField>) {
    onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)))
  }

  return (
    <div className="audience-query-aggregates">
      {fields.map((field, idx) => (
        <div key={field.id} className="audience-query-aggregate-row form-grid">
          <label className="stack-label">
            <span className="muted small">Output alias</span>
            <input
              className="input"
              value={field.alias}
              onChange={(e) => patchField(field.id, { alias: e.target.value })}
              placeholder="count"
            />
          </label>
          <label className="stack-label">
            <span className="muted small">Function</span>
            <select
              className="input"
              value={field.func}
              onChange={(e) =>
                patchField(field.id, {
                  func: e.target.value as AggregateField['func'],
                })
              }
            >
              <option value="COUNT">COUNT</option>
              <option value="SUM">SUM</option>
              <option value="AVG">AVG</option>
              <option value="MIN">MIN</option>
              <option value="MAX">MAX</option>
            </select>
          </label>
          <label className="stack-label">
            <span className="muted small">Field</span>
            <input
              className="input"
              value={field.field}
              onChange={(e) => patchField(field.id, { field: e.target.value })}
              placeholder="* or column name"
            />
          </label>
          <div className="audience-query-filter-actions">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              aria-label={`Remove aggregate ${idx + 1}`}
              onClick={() => onChange(fields.filter((f) => f.id !== field.id))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-secondary btn-small"
        onClick={() => onChange([...fields, emptyAggregateField()])}
      >
        Add aggregate field
      </button>
      {tableRef.trim() && (
        <p className="muted small">
          Example: <code>count</code> →{' '}
          <code>{'{ "COUNT": "*" }'}</code> on <code>{tableRef.trim()}</code>.
        </p>
      )}
    </div>
  )
}

function JoinedTableEditor({
  join,
  primaryKeyAlias,
  index,
  onChange,
  onRemove,
}: {
  join: JoinedTableConfig
  primaryKeyAlias: string
  index: number
  onChange: (next: JoinedTableConfig) => void
  onRemove: () => void
}) {
  return (
    <div className="audience-query-join-block">
      <div className="audience-query-join-head">
        <h4 className="audience-query-join-title">Joined table {index + 1}</h4>
        <button type="button" className="btn btn-secondary btn-small" onClick={onRemove}>
          Remove join
        </button>
      </div>
      <div className="form-grid">
        <label className="stack-label">
          <span>Table reference</span>
          <input
            className="input"
            value={join.tableRef}
            onChange={(e) => onChange({ ...join, tableRef: e.target.value })}
            placeholder="industry_retail.orders"
          />
        </label>
        <label className="stack-label">
          <span>Join type</span>
          <select
            className="input"
            value={join.joinType}
            onChange={(e) =>
              onChange({
                ...join,
                joinType: e.target.value as JoinedTableConfig['joinType'],
              })
            }
          >
            <option value="left">left</option>
            <option value="inner">inner</option>
          </select>
        </label>
        <label className="stack-label">
          <span>Join key — primary field</span>
          <input
            className="input"
            value={join.joinOnPrimaryField}
            onChange={(e) =>
              onChange({ ...join, joinOnPrimaryField: e.target.value })
            }
            placeholder={primaryKeyAlias}
          />
        </label>
        <label className="stack-label">
          <span>Join key — joined field</span>
          <input
            className="input"
            value={join.joinOnJoinedField}
            onChange={(e) =>
              onChange({ ...join, joinOnJoinedField: e.target.value })
            }
            placeholder="customer_id"
          />
        </label>
        <label className="stack-label">
          <span>Joined table key column</span>
          <input
            className="input"
            value={join.joinKeyColumn}
            onChange={(e) => onChange({ ...join, joinKeyColumn: e.target.value })}
            placeholder="customer_id"
          />
        </label>
      </div>
      <label className="audience-query-checkbox stack-label">
        <input
          type="checkbox"
          checked={join.aggregate}
          onChange={(e) => onChange({ ...join, aggregate: e.target.checked })}
        />
        <span>Aggregate joined rows (GROUP BY)</span>
      </label>
      {join.aggregate && (
        <div className="audience-query-aggregate-section card-nested">
          <label className="stack-label">
            <span>Group by column</span>
            <input
              className="input"
              value={join.groupByColumn}
              onChange={(e) => onChange({ ...join, groupByColumn: e.target.value })}
              placeholder="customer_id"
            />
          </label>
          <AggregateFieldsEditor
            tableRef={join.tableRef}
            fields={join.aggregateFields}
            onChange={(aggregateFields) => onChange({ ...join, aggregateFields })}
          />
        </div>
      )}
      <TableFiltersEditor
        tableLabel={`joined table ${index + 1}`}
        tableRef={join.tableRef}
        filters={join.filters}
        filterGroups={join.filterGroups}
        onFiltersChange={(filters) => onChange({ ...join, filters })}
        onGroupsChange={(filterGroups) => onChange({ ...join, filterGroups })}
      />
    </div>
  )
}

function PostJoinFiltersEditor({
  joins,
  rows,
  onChange,
}: {
  joins: JoinedTableConfig[]
  rows: PostJoinFilterRow[]
  onChange: (rows: PostJoinFilterRow[]) => void
}) {
  const activeJoins = joins.filter((j) => j.tableRef.trim())

  function patchRow(id: string, patch: Partial<PostJoinFilterRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  return (
    <div className="audience-query-post-join card-nested">
      <div className="audience-query-subhead">
        <h4 className="audience-query-section-title">Post-join filters</h4>
        <button
          type="button"
          className="btn btn-secondary btn-small"
          disabled={activeJoins.length === 0}
          onClick={() => {
            const first = activeJoins[0]
            if (!first) return
            onChange([...rows, emptyPostJoinFilter(first.id)])
          }}
        >
          Add post-join filter
        </button>
      </div>
      <p className="muted small">
        Applied on <code>queries.base_query.filter</code> after WITH subqueries are
        joined. Reference joined aliases (e.g. <code>orders_…_base_query.count</code>
        ) — the preview shows the compiled names.
      </p>
      {rows.length === 0 && (
        <p className="muted small audience-query-empty-hint">
          Example: <code>count &gt; 0</code> with <code>coalesce: 0</code> on the
          orders aggregate.
        </p>
      )}
      {rows.map((row, idx) => (
        <div key={row.id} className="audience-query-filter-row form-grid">
          <label className="stack-label">
            <span className="muted small">Joined table</span>
            <select
              className="input"
              value={row.joinId}
              onChange={(e) => patchRow(row.id, { joinId: e.target.value })}
            >
              {activeJoins.map((j, i) => (
                <option key={j.id} value={j.id}>
                  {j.tableRef.trim() || `Joined table ${i + 1}`}
                </option>
              ))}
            </select>
          </label>
          <label className="stack-label">
            <span className="muted small">Field on join alias</span>
            <input
              className="input"
              value={row.fieldName}
              onChange={(e) => patchRow(row.id, { fieldName: e.target.value })}
              placeholder="count"
            />
          </label>
          <label className="stack-label">
            <span className="muted small">Operator</span>
            <select
              className="input"
              value={row.operator}
              onChange={(e) =>
                patchRow(row.id, {
                  operator: e.target.value as PostJoinFilterRow['operator'],
                })
              }
            >
              {FILTER_OPERATORS.map((op) => (
                <option key={op} value={op}>
                  {FILTER_OPERATOR_LABELS[op]}
                </option>
              ))}
            </select>
          </label>
          <label className="stack-label">
            <span className="muted small">Value type</span>
            <select
              className="input"
              value={row.valueType}
              onChange={(e) =>
                patchRow(row.id, {
                  valueType: e.target.value as PostJoinFilterRow['valueType'],
                })
              }
            >
              {FILTER_VALUE_TYPES.map((vt) => (
                <option key={vt} value={vt}>
                  {FILTER_VALUE_TYPE_LABELS[vt]}
                </option>
              ))}
            </select>
          </label>
          <label className="stack-label">
            <span className="muted small">Value</span>
            <input
              className="input"
              value={row.value}
              onChange={(e) => patchRow(row.id, { value: e.target.value })}
            />
          </label>
          <label className="stack-label">
            <span className="muted small">coalesce (optional)</span>
            <input
              className="input"
              value={row.coalesce ?? ''}
              onChange={(e) => patchRow(row.id, { coalesce: e.target.value })}
              placeholder="0"
            />
          </label>
          <div className="audience-query-filter-actions">
            <button
              type="button"
              className="btn btn-ghost btn-small"
              aria-label={`Remove post-join filter ${idx + 1}`}
              onClick={() => onChange(rows.filter((r) => r.id !== row.id))}
            >
              Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export function AudienceJsonQueryBuilder({ state, onChange }: Props) {
  const compiled = compileJsonQuery(state)
  const hasJoins = state.joins.some((j) => j.tableRef.trim())

  function patchPrimary(patch: Partial<JsonQueryBuilderState['primary']>) {
    onChange({ ...state, primary: { ...state.primary, ...patch } })
  }

  function addJoin() {
    const join = emptyJoinedTable()
    onChange({
      ...state,
      joins: [...state.joins, join],
      postJoinFilters:
        state.postJoinFilters.length === 0
          ? [emptyPostJoinFilter(join.id)]
          : state.postJoinFilters,
    })
  }

  return (
    <div className="audience-query-builder">
      <h3 className="audience-query-builder-heading">Audience query builder</h3>
      <p className="muted small">
        Inputs compile into <code>json_query</code>. A single-table audience uses a
        flat <code>queries.base_query</code>. When you add a joined table, the builder
        switches to GrowthLoop&apos;s <code>with</code> subquery pattern (join +
        optional aggregation + post-join filters).
      </p>

      <div className="audience-query-primary card-nested">
        <h4 className="audience-query-section-title">Primary table</h4>
        <div className="form-grid">
          <label className="stack-label">
            <span>Table reference</span>
            <input
              className="input"
              value={state.primary.tableRef}
              onChange={(e) => patchPrimary({ tableRef: e.target.value })}
              placeholder="industry_retail.customers"
            />
          </label>
          <label className="stack-label">
            <span>Primary key alias</span>
            <input
              className="input"
              value={state.primary.primaryKeyAlias}
              onChange={(e) => patchPrimary({ primaryKeyAlias: e.target.value })}
              placeholder="customer_id"
            />
          </label>
          <label className="stack-label">
            <span>Primary key column</span>
            <input
              className="input"
              value={state.primary.primaryKeyColumn}
              onChange={(e) => patchPrimary({ primaryKeyColumn: e.target.value })}
              placeholder="customer_id"
            />
          </label>
        </div>
        <TableFiltersEditor
          tableLabel="primary table"
          tableRef={state.primary.tableRef}
          filters={state.primary.filters}
          filterGroups={state.primary.filterGroups}
          onFiltersChange={(filters) => patchPrimary({ filters })}
          onGroupsChange={(filterGroups) => patchPrimary({ filterGroups })}
        />
      </div>

      <div className="audience-query-joins">
        <div className="audience-query-subhead">
          <h4 className="audience-query-section-title">Joined tables</h4>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={addJoin}
          >
            Add joined table
          </button>
        </div>
        {state.joins.length === 0 && (
          <p className="muted small audience-query-empty-hint">
            Add a join to filter on another table (e.g. orders linked by{' '}
            <code>customer_id</code>). Enable aggregation when you need counts or sums
            per customer before applying post-join filters.
          </p>
        )}
        {state.joins.map((join, index) => (
          <JoinedTableEditor
            key={join.id}
            join={join}
            primaryKeyAlias={state.primary.primaryKeyAlias}
            index={index}
            onChange={(next) =>
              onChange({
                ...state,
                joins: state.joins.map((j) => (j.id === join.id ? next : j)),
              })
            }
            onRemove={() =>
              onChange({
                ...state,
                joins: state.joins.filter((j) => j.id !== join.id),
                postJoinFilters: state.postJoinFilters.filter(
                  (f) => f.joinId !== join.id,
                ),
              })
            }
          />
        ))}
      </div>

      {hasJoins && (
        <PostJoinFiltersEditor
          joins={state.joins}
          rows={state.postJoinFilters}
          onChange={(postJoinFilters) => onChange({ ...state, postJoinFilters })}
        />
      )}

      <details className="audience-query-preview growthloop-api-response">
        <summary className="growthloop-api-response-summary">
          Compiled json_query
        </summary>
        <p className="muted small audience-query-preview-lede">
          Read-only preview of what will be sent in the API body.
        </p>
        <pre className="result-block growthloop-api-response-body">
          {JSON.stringify(compiled, null, 2)}
        </pre>
      </details>
    </div>
  )
}
