/** Default json_query shape from GrowthLoop audience create examples. */
export const DEFAULT_JSON_QUERY = {
  queries: {
    base_query: {
      join: [],
      fields: {
        CUSTOMER_ID: 'PUBLIC.MY_CUSTOMER_DATA.CUSTOMER_ID',
      },
      filter: {
        and: [
          {
            operator: 'in',
            field_name: 'PUBLIC.MY_CUSTOMER_DATA.STATE',
            field_value: ['California', 'Oregon', 'Washington'],
          },
        ],
      },
    },
  },
  operation: 'base_query',
  result_query: {
    join: [
      {
        on: [
          {
            'operation.CUSTOMER_ID': 'PUBLIC.MY_CUSTOMER_DATA.CUSTOMER_ID',
          },
        ],
        left: 'operation',
        type: 'left',
        right: 'PUBLIC.MY_CUSTOMER_DATA',
      },
    ],
    fields: {
      CUSTOMER_ID: 'operation.CUSTOMER_ID',
    },
  },
} as const

export type CreateAudienceFormValues = {
  teamId: string
  userId: string
  datasetGroupId: string
  name: string
  description: string
  treatment: string
  tags: string
  jsonQueryText: string
}

export const DEFAULT_TEAM_ID = '123'
export const DEFAULT_USER_ID = '456'

export function defaultCreateAudienceForm(): CreateAudienceFormValues {
  return {
    teamId: DEFAULT_TEAM_ID,
    userId: DEFAULT_USER_ID,
    datasetGroupId: '',
    name: 'Created from GrowthLoop API demo',
    description: 'Audience created via the PoC UI',
    treatment: '0.66',
    tags: 'tag1API',
    jsonQueryText: JSON.stringify(DEFAULT_JSON_QUERY, null, 2),
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

  let json_query: unknown
  try {
    json_query = JSON.parse(form.jsonQueryText)
  } catch {
    throw new Error('json_query must be valid JSON.')
  }

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
