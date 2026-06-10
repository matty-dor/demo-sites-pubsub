import {
  compileJsonQuery,
  defaultJsonQueryBuilderState,
  validateJsonQueryBuilder,
  type JsonQueryBuilderState,
} from './growthloopJsonQueryBuilder'

export type CreateAudienceFormValues = {
  teamId: string
  userId: string
  datasetGroupId: string
  name: string
  description: string
  treatment: string
  tags: string
  queryBuilder: JsonQueryBuilderState
}

export const DEFAULT_TEAM_ID = '420'
export const DEFAULT_USER_ID = '2123'

/** Stable id so example post-join filters reference the example join row. */
export const EXAMPLE_JOIN_TABLE_ID = 'example-join-orders'

export function defaultCreateAudienceForm(): CreateAudienceFormValues {
  return {
    teamId: DEFAULT_TEAM_ID,
    userId: DEFAULT_USER_ID,
    datasetGroupId: '',
    name: 'Created from GrowthLoop API demo',
    description: 'Audience created via the PoC UI',
    treatment: '0.66',
    tags: 'tag1API',
    queryBuilder: defaultJsonQueryBuilderState(),
  }
}

/** Pre-filled reference audience for the collapsed example section on the API page. */
export function exampleCreateAudienceForm(): CreateAudienceFormValues {
  return {
    teamId: DEFAULT_TEAM_ID,
    userId: DEFAULT_USER_ID,
    datasetGroupId: '1338',
    name: 'api-test-yourinitials-number',
    description: 'Audience created via the PoC UI',
    treatment: '0.85',
    tags: 'tag1API',
    queryBuilder: {
      primary: {
        tableRef: 'industry_retail.customers',
        primaryKeyAlias: 'customer_id',
        primaryKeyColumn: 'customer_id',
        filters: [
          {
            id: 'example-primary-filter-age',
            operator: 'gt',
            column: 'age',
            value: '40',
            valueType: 'number',
          },
        ],
        filterGroups: [],
      },
      joins: [
        {
          id: EXAMPLE_JOIN_TABLE_ID,
          tableRef: 'industry_retail.orders',
          joinType: 'left',
          joinOnPrimaryField: 'customer_id',
          joinOnJoinedField: 'customer_id',
          joinKeyColumn: 'transaction_id',
          filters: [
            {
              id: 'example-join-filter-tx-value',
              operator: 'gte',
              column: 'transaction_value',
              value: '125',
              valueType: 'number',
            },
          ],
          filterGroups: [],
          aggregate: true,
          groupByColumn: 'customer_id',
          aggregateFields: [
            {
              id: 'example-join-agg-count',
              alias: 'count',
              func: 'COUNT',
              field: 'customer_id',
            },
          ],
        },
      ],
      postJoinFilters: [
        {
          id: 'example-post-join-count',
          joinId: EXAMPLE_JOIN_TABLE_ID,
          fieldName: 'count',
          operator: 'gt',
          value: '0',
          valueType: 'number',
        },
      ],
    },
  }
}

export function buildAudiencePayload(
  form: CreateAudienceFormValues,
): Record<string, unknown> {
  const teamId = Number(form.teamId.trim())
  const userId = Number(form.userId.trim())
  const datasetGroupId = Number(form.datasetGroupId.trim())
  const treatment = Number(form.treatment.trim())

  if (!Number.isFinite(teamId)) {
    throw new Error('team_id must be a number.')
  }
  if (!Number.isFinite(userId)) {
    throw new Error('user_id must be a number.')
  }
  if (!form.datasetGroupId.trim() || !Number.isFinite(datasetGroupId)) {
    throw new Error('dataset_group_id is required and must be a number.')
  }
  if (!form.name.trim()) {
    throw new Error('name is required.')
  }

  const queryErr = validateJsonQueryBuilder(form.queryBuilder)
  if (queryErr) {
    throw new Error(queryErr)
  }

  const json_query = compileJsonQuery(form.queryBuilder)

  const tags = form.tags
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  return {
    team_id: teamId,
    user_id: userId,
    dataset_group_id: datasetGroupId,
    name: form.name.trim(),
    description: form.description.trim(),
    json_query,
    treatment: Number.isFinite(treatment) ? treatment : 0,
    breakdowns: [],
    custom_attributes: {},
    tags,
  }
}
