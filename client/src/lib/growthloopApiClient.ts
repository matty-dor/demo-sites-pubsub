import { api } from '../api/http'

export type GrowthLoopProxyResponse = {
  ok?: boolean
  status?: number
  data?: unknown
  error?: string
}

async function postGrowthLoop(
  body: Record<string, unknown>,
): Promise<GrowthLoopProxyResponse> {
  return api<GrowthLoopProxyResponse>('/api/growthloop', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export function listDatasetGroups(params?: {
  teamId?: number | string
  pageNumber?: number
  perPage?: number
}) {
  return postGrowthLoop({
    op: 'listDatasetGroups',
    ...params,
  })
}

export function showDatasetGroup(id: string | number) {
  return postGrowthLoop({
    op: 'showDatasetGroup',
    id,
  })
}

export function createAudience(audience: Record<string, unknown>) {
  return postGrowthLoop({
    op: 'createAudience',
    audience,
  })
}
