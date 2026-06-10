import type { UseMutationResult } from '@tanstack/react-query'
import { ApiError } from '../api/http'
import { AudienceJsonQueryBuilder } from './AudienceJsonQueryBuilder'
import type { CreateAudienceFormValues } from '../lib/growthloopAudienceTemplate'
import type { GrowthLoopProxyResponse } from '../lib/growthloopApiClient'

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

type Props = {
  form: CreateAudienceFormValues
  onFormChange: (patch: Partial<CreateAudienceFormValues>) => void
  /** When set, used as fallback for dataset_group_id if the form field is empty. */
  datasetGroupIdFallback?: string
  onDatasetGroupIdChange?: (id: string) => void
  createMutation: UseMutationResult<GrowthLoopProxyResponse, Error, void, unknown>
  useHttpProxy: boolean
  intro?: string
}

export function CreateAudienceSection({
  form,
  onFormChange,
  datasetGroupIdFallback = '',
  onDatasetGroupIdChange,
  createMutation,
  useHttpProxy,
  intro,
}: Props) {
  function patchForm(patch: Partial<CreateAudienceFormValues>) {
    onFormChange(patch)
  }

  const datasetGroupValue = form.datasetGroupId || datasetGroupIdFallback

  return (
    <>
      {intro ? <p className="muted small">{intro}</p> : null}
      <p className="muted small">
        <code>POST /api/public/audiences</code> with body{' '}
        <code>{'{ "audience": { … } }'}</code>.
      </p>
      <div className="form-grid">
        <label className="stack-label">
          <span>dataset_group_id</span>
          <input
            className="input"
            type="text"
            inputMode="numeric"
            value={datasetGroupValue}
            onChange={(e) => {
              patchForm({ datasetGroupId: e.target.value })
              onDatasetGroupIdChange?.(e.target.value)
            }}
            placeholder="Required"
          />
        </label>
        <label className="stack-label">
          <span>name</span>
          <input
            className="input"
            value={form.name}
            onChange={(e) => patchForm({ name: e.target.value })}
          />
        </label>
        <label className="stack-label">
          <span>description</span>
          <input
            className="input"
            value={form.description}
            onChange={(e) => patchForm({ description: e.target.value })}
          />
        </label>
        <label className="stack-label">
          <span>treatment</span>
          <input
            className="input"
            type="text"
            inputMode="decimal"
            value={form.treatment}
            onChange={(e) => patchForm({ treatment: e.target.value })}
          />
        </label>
        <label className="stack-label">
          <span>tags (comma-separated)</span>
          <input
            className="input"
            value={form.tags}
            onChange={(e) => patchForm({ tags: e.target.value })}
          />
        </label>
      </div>
      <AudienceJsonQueryBuilder
        state={form.queryBuilder}
        onChange={(queryBuilder) => patchForm({ queryBuilder })}
      />
      <div className="actions-row">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!useHttpProxy || createMutation.isPending}
          onClick={() => createMutation.mutate()}
        >
          Create audience
        </button>
      </div>
      <ErrorBanner error={createMutation.error} />
      <ResponseBlock title="Create response" response={createMutation.data} />
    </>
  )
}
