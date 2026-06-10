import {
  compileJsonQuery,
  emptyFilterRow,
  emptyJoinedTable,
  FILTER_OPERATOR_LABELS,
  FILTER_OPERATORS,
  type AudienceFilterRow,
  type JsonQueryBuilderState,
  type JoinedTableConfig,
} from '../lib/growthloopJsonQueryBuilder'

type Props = {
  state: JsonQueryBuilderState
  onChange: (next: JsonQueryBuilderState) => void
}

function FilterRowsEditor({
  tableLabel,
  tableRef,
  rows,
  onChange,
}: {
  tableLabel: string
  tableRef: string
  rows: AudienceFilterRow[]
  onChange: (rows: AudienceFilterRow[]) => void
}) {
  function patchRow(id: string, patch: Partial<AudienceFilterRow>) {
    onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

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
        <button
          type="button"
          className="btn btn-secondary btn-small"
          onClick={() => onChange([...rows, emptyFilterRow()])}
        >
          Add filter
        </button>
      </div>
      {rows.length === 0 && (
        <p className="muted small audience-query-empty-hint">
          No filters yet. Filters compile into{' '}
          <code>filter.and</code> on this table&apos;s query.
        </p>
      )}
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
              placeholder="STATE or full TABLE.COLUMN"
            />
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
                row.operator === 'in'
                  ? 'California, Oregon, Washington'
                  : 'e.g. luxury'
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
    </div>
  )
}

function JoinedTableEditor({
  join,
  primaryTableRef,
  index,
  onChange,
  onRemove,
}: {
  join: JoinedTableConfig
  primaryTableRef: string
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
            placeholder="PUBLIC.OTHER_TABLE"
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
          <span>Join on — primary column</span>
          <input
            className="input"
            value={join.joinOnPrimaryColumn}
            onChange={(e) =>
              onChange({ ...join, joinOnPrimaryColumn: e.target.value })
            }
            placeholder="CUSTOMER_ID"
          />
        </label>
        <label className="stack-label">
          <span>Join on — joined column</span>
          <input
            className="input"
            value={join.joinOnJoinedColumn}
            onChange={(e) =>
              onChange({ ...join, joinOnJoinedColumn: e.target.value })
            }
            placeholder="CUSTOMER_ID"
          />
        </label>
      </div>
      <p className="muted small">
        Join keys compile to{' '}
        <code>
          {primaryTableRef.trim() || 'PRIMARY'}.{join.joinOnPrimaryColumn || '…'} ={' '}
          {join.tableRef.trim() || 'JOINED'}.{join.joinOnJoinedColumn || '…'}
        </code>
      </p>
      <FilterRowsEditor
        tableLabel={`joined table ${index + 1}`}
        tableRef={join.tableRef}
        rows={join.filters}
        onChange={(filters) => onChange({ ...join, filters })}
      />
    </div>
  )
}

export function AudienceJsonQueryBuilder({ state, onChange }: Props) {
  const compiled = compileJsonQuery(state)

  function patchPrimary(patch: Partial<JsonQueryBuilderState['primary']>) {
    onChange({ ...state, primary: { ...state.primary, ...patch } })
  }

  return (
    <div className="audience-query-builder">
      <h3 className="audience-query-builder-heading">Audience query builder</h3>
      <p className="muted small">
        Inputs below compile into <code>json_query</code> for the create-audience call.
        The primary table maps to <code>queries.base_query</code>; each join adds a{' '}
        <code>queries.join_N</code> entry and extends <code>result_query.join</code>.
      </p>

      <div className="audience-query-primary card-nested">
        <h4 className="audience-query-section-title">Primary table (base_query)</h4>
        <div className="form-grid">
          <label className="stack-label">
            <span>Table reference</span>
            <input
              className="input"
              value={state.primary.tableRef}
              onChange={(e) => patchPrimary({ tableRef: e.target.value })}
              placeholder="PUBLIC.MY_CUSTOMER_DATA"
            />
          </label>
          <label className="stack-label">
            <span>Primary key alias</span>
            <input
              className="input"
              value={state.primary.primaryKeyAlias}
              onChange={(e) => patchPrimary({ primaryKeyAlias: e.target.value })}
              placeholder="CUSTOMER_ID"
            />
          </label>
          <label className="stack-label">
            <span>Primary key column</span>
            <input
              className="input"
              value={state.primary.primaryKeyColumn}
              onChange={(e) => patchPrimary({ primaryKeyColumn: e.target.value })}
              placeholder="CUSTOMER_ID"
            />
          </label>
        </div>
        <p className="muted small">
          <code>fields</code> maps{' '}
          <code>{state.primary.primaryKeyAlias || 'CUSTOMER_ID'}</code> →{' '}
          <code>
            {state.primary.tableRef.trim()
              ? `${state.primary.tableRef.trim()}.${state.primary.primaryKeyColumn || '…'}`
              : 'TABLE.COLUMN'}
          </code>
          . <code>join</code> starts empty on the base table.
        </p>
        <FilterRowsEditor
          tableLabel="primary table"
          tableRef={state.primary.tableRef}
          rows={state.primary.filters}
          onChange={(filters) => patchPrimary({ filters })}
        />
      </div>

      <div className="audience-query-joins">
        <div className="audience-query-subhead">
          <h4 className="audience-query-section-title">Joined tables</h4>
          <button
            type="button"
            className="btn btn-secondary btn-small"
            onClick={() =>
              onChange({ ...state, joins: [...state.joins, emptyJoinedTable()] })
            }
          >
            Add joined table
          </button>
        </div>
        {state.joins.length === 0 && (
          <p className="muted small audience-query-empty-hint">
            Optional. Add a join when the audience should filter on columns from another
            table linked to the primary table.
          </p>
        )}
        {state.joins.map((join, index) => (
          <JoinedTableEditor
            key={join.id}
            join={join}
            primaryTableRef={state.primary.tableRef}
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
              })
            }
          />
        ))}
      </div>

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
