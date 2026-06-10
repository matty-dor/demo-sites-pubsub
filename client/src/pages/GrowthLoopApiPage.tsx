import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { ApiError } from '../api/http'
import { CreateAudienceSection } from '../components/CreateAudienceSection'
import { growthLoopApiHttpEnabled } from '../config/storageMode'
import {
  buildAudiencePayload,
  defaultCreateAudienceForm,
  exampleCreateAudienceForm,
  type CreateAudienceFormValues,
} from '../lib/growthloopAudienceTemplate'
import {
  createAudience,
  listDatasetGroups,
  showDatasetGroup,
  type GrowthLoopProxyResponse,
} from '../lib/growthloopApiClient'

type DatasetGroupRow = {
  id: string
  name: string
}

function parseDatasetGroupRows(data: unknown): DatasetGroupRow[] {
  if (!data || typeof data !== 'object' || !('data' in data)) return []
  const rows = (data as { data: unknown }).data
  if (!Array.isArray(rows)) return []
  return rows
    .map((item) => {
      if (!item || typeof item !== 'object') return null
      const rec = item as {
        id?: string | number
        attributes?: { name?: string }
      }
      const id = rec.id !== undefined ? String(rec.id) : ''
      const name =
        rec.attributes && typeof rec.attributes.name === 'string'
          ? rec.attributes.name
          : ''
      if (!id) return null
      return { id, name: name || id }
    })
    .filter((r): r is DatasetGroupRow => r !== null)
}

function ErrorBanner({ error }: { error: unknown }) {
  if (!error) return null
  return (
    <div className="banner banner-error">
      {(error as Error).message}
      {error instanceof ApiError && (
        <pre className="result-block">{JSON.stringify(error.body, null, 2)}</pre>
      )}
    </div>
  )
}

function ResponseBlock({
  title,
  response,
}: {
  title: string
  response: GrowthLoopProxyResponse | undefined
}) {
  if (!response) return null
  return (
    <details className="growthloop-api-response">
      <summary className="growthloop-api-response-summary">{title}</summary>
      <pre className="result-block growthloop-api-response-body">
        {JSON.stringify(response, null, 2)}
      </pre>
    </details>
  )
}

export function GrowthLoopApiPage() {
  const useHttpProxy = growthLoopApiHttpEnabled()
  const [teamId, setTeamId] = useState(defaultCreateAudienceForm().teamId)
  const [userId, setUserId] = useState(defaultCreateAudienceForm().userId)
  const [datasetGroupId, setDatasetGroupId] = useState('')
  const [createForm, setCreateForm] = useState<CreateAudienceFormValues>(
    defaultCreateAudienceForm,
  )
  const [exampleForm, setExampleForm] = useState<CreateAudienceFormValues>(
    exampleCreateAudienceForm,
  )
  const [listRows, setListRows] = useState<DatasetGroupRow[]>([])

  const listMutation = useMutation({
    mutationFn: () =>
      listDatasetGroups({
        teamId: teamId.trim() || undefined,
      }),
    onSuccess: (res) => {
      setListRows(parseDatasetGroupRows(res.data))
    },
  })

  const showMutation = useMutation({
    mutationFn: (id: string) => {
      const trimmed = id.trim()
      if (!trimmed) throw new Error('Enter a dataset group id.')
      return showDatasetGroup(trimmed)
    },
  })

  const createMutation = useMutation({
    mutationFn: () => {
      const audience = buildAudiencePayload({
        ...createForm,
        teamId,
        userId,
        datasetGroupId: createForm.datasetGroupId || datasetGroupId,
      })
      return createAudience(audience)
    },
  })

  const exampleCreateMutation = useMutation({
    mutationFn: () => {
      const audience = buildAudiencePayload({
        ...exampleForm,
        teamId,
        userId,
      })
      return createAudience(audience)
    },
  })

  function patchCreateForm(patch: Partial<CreateAudienceFormValues>) {
    setCreateForm((prev) => ({ ...prev, ...patch }))
  }

  function patchExampleForm(patch: Partial<CreateAudienceFormValues>) {
    setExampleForm((prev) => ({ ...prev, ...patch }))
  }

  function selectDatasetGroup(id: string) {
    setDatasetGroupId(id)
    patchCreateForm({ datasetGroupId: id })
    showMutation.reset()
    showMutation.mutate(id)
  }

  return (
    <div className="page growthloop-api-page">
      <h1>GrowthLoop API</h1>
      <p className="lede">
        Call GrowthLoop public API operations for{' '}
        <a
          href="https://docs.growthloop.com/reference/audiences"
          target="_blank"
          rel="noreferrer"
          className="link-inline"
        >
          audiences and dataset groups
        </a>
        . API credentials stay server-side (
        <code>GROWTHLOOP_API_TOKEN</code>, <code>GROWTHLOOP_API_ACCESS_KEY</code>
        ).
      </p>

      {!useHttpProxy && (
        <div className="banner banner-success">
          Local mode: enable <code>VITE_USE_BACKEND=true</code> (Fastify on port
          3001) or <code>VITE_USE_VERCEL_API=true</code> (Vercel{' '}
          <code>api/growthloop.js</code>) to call the real API.
        </div>
      )}

      <section className="growthloop-api-section card">
        <h2 className="growthloop-api-section-heading">Shared ids</h2>
        <p className="muted small">
          Used for list filtering and audience create. Defaults are placeholders
          until you replace them with your org values.
        </p>
        <div className="form-grid growthloop-api-shared-ids">
          <label className="stack-label">
            <span>team_id</span>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            />
          </label>
          <label className="stack-label">
            <span>user_id</span>
            <input
              className="input"
              type="text"
              inputMode="numeric"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
            />
          </label>
        </div>
      </section>

      <section className="growthloop-api-section card">
        <h2 className="growthloop-api-section-heading">List dataset groups</h2>
        <p className="muted small">
          <code>GET /api/public/dataset_groups</code> — optional{' '}
          <code>team_id</code> filter from the field above.
        </p>
        <div className="actions-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!useHttpProxy || listMutation.isPending}
            onClick={() => listMutation.mutate()}
          >
            List dataset groups
          </button>
        </div>
        <ErrorBanner error={listMutation.error} />
        {listRows.length > 0 && (
          <details className="growthloop-api-response">
            <summary className="growthloop-api-response-summary">
              Dataset groups ({listRows.length})
            </summary>
            <div className="growthloop-api-table-wrap growthloop-api-response-body">
              <table className="growthloop-api-table">
                <thead>
                  <tr>
                    <th scope="col">ID</th>
                    <th scope="col">Name</th>
                    <th scope="col" />
                  </tr>
                </thead>
                <tbody>
                  {listRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <code>{row.id}</code>
                      </td>
                      <td>{row.name}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-small"
                          onClick={() => selectDatasetGroup(row.id)}
                        >
                          Use id
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
        <ResponseBlock title="List response" response={listMutation.data} />
      </section>

      <section className="growthloop-api-section card">
        <h2 className="growthloop-api-section-heading">Show dataset group</h2>
        <p className="muted small">
          <code>GET /api/public/dataset_groups/:id</code>
        </p>
        <label className="stack-label">
          <span>dataset_group_id</span>
          <input
            className="input"
            value={datasetGroupId}
            onChange={(e) => setDatasetGroupId(e.target.value)}
            placeholder="e.g. 1785"
            autoComplete="off"
          />
        </label>
        <div className="actions-row">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!useHttpProxy || showMutation.isPending}
            onClick={() => showMutation.mutate(datasetGroupId)}
          >
            Show dataset group
          </button>
        </div>
        <ErrorBanner error={showMutation.error} />
        <ResponseBlock title="Show response" response={showMutation.data} />
      </section>

      <section className="growthloop-api-section card">
        <h2 className="growthloop-api-section-heading">Create audience</h2>
        <CreateAudienceSection
          form={createForm}
          onFormChange={patchCreateForm}
          datasetGroupIdFallback={datasetGroupId}
          onDatasetGroupIdChange={setDatasetGroupId}
          createMutation={createMutation}
          useHttpProxy={useHttpProxy}
        />
      </section>

      <details className="growthloop-api-section card growthloop-api-example-section">
        <summary className="growthloop-api-example-summary">
          Example: Create audience (reference)
        </summary>
        <div className="growthloop-api-example-body">
          <p className="muted small">
            Pre-filled working example with a primary-table filter, a joined orders
            table with aggregation, and a post-join filter. Expand to study each
            field, edit values (e.g. replace <code>yourinitials</code> in the name),
            then click <strong>Create audience</strong> to run the same API call.
            Uses <code>team_id</code> and <code>user_id</code> from Shared ids above.
          </p>
          <CreateAudienceSection
            form={exampleForm}
            onFormChange={patchExampleForm}
            createMutation={exampleCreateMutation}
            useHttpProxy={useHttpProxy}
          />
        </div>
      </details>
    </div>
  )
}
