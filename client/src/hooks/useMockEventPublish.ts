import { useMutation } from '@tanstack/react-query'
import { useCallback, useState } from 'react'
import { api, ApiError } from '../api/http'
import { backendStorageEnabled } from '../config/storageMode'
import { injectTriggerTimestamps } from '../lib/injectTriggerTimestamps'
import { useAppDispatch, useAppSelector } from '../store/hooks'
import { markExperienceAwaitingRefresh } from '../store/experienceRefreshSlice'

const publishUrl = (
  (import.meta.env.VITE_PUBLISH_URL as string | undefined) ??
  (import.meta.env.VITE_CONFLUENT_PUBLISH_URL as string | undefined)
)?.trim()

async function publishViaIngress(input: {
  payload: Record<string, unknown>
  eventName: string
  mockEventId: string
}): Promise<{
  ok?: boolean
  mode?: string
  message?: string
  error?: string
  path?: string
  envelope?: unknown
  messageId?: string
  topic?: string
}> {
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  const secret = (import.meta.env.VITE_PUBLISH_INGRESS_SECRET as string | undefined)?.trim()
  if (secret) headers.authorization = `Bearer ${secret}`

  const res = await fetch(publishUrl!, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      payload: input.payload,
      eventName: input.eventName,
      mockEventId: input.mockEventId,
    }),
  })
  const text = await res.text()
  let body: unknown = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { raw: text }
  }
  if (!res.ok) {
    const msg =
      typeof body === 'object' &&
      body !== null &&
      'error' in body &&
      typeof (body as { error: unknown }).error === 'string'
        ? (body as { error: string }).error
        : res.statusText
    throw new ApiError(msg, res.status, body)
  }
  return body as {
    ok?: boolean
    mode?: string
    envelope?: unknown
    messageId?: string
    topic?: string
  }
}

export function useMockEventPublish() {
  const dispatch = useAppDispatch()
  const backend = backendStorageEnabled()
  const reduxEvents = useAppSelector((s) => s.mockEvents.events)

  const [publishStatus, setPublishStatus] = useState<Record<string, string>>({})

  const publishRemote = useMutation({
    mutationFn: async ({
      id,
      payload,
      eventName,
    }: {
      id: string
      payload: Record<string, unknown>
      eventName: string
    }) => {
      const schema = reduxEvents.find((e) => e.id === id)?.schema ?? []
      const payloadToSend = injectTriggerTimestamps(schema, payload)
      if (publishUrl) {
        return publishViaIngress({
          payload: payloadToSend,
          eventName,
          mockEventId: id,
        })
      }
      return api<{
        ok?: boolean
        mode?: string
        message?: string
        error?: string
        path?: string
        envelope?: unknown
      }>(`/api/mock-events/${id}/publish`, {
        method: 'POST',
        body: JSON.stringify({ payload: payloadToSend }),
      })
    },
    onSuccess: (_data, vars) => {
      dispatch(markExperienceAwaitingRefresh(vars.id))
      setPublishStatus((s) => ({
        ...s,
        [vars.id]: JSON.stringify(_data, null, 2),
      }))
    },
    onError: (err: Error, vars) => {
      const msg =
        err instanceof ApiError ? `${err.message} (${JSON.stringify(err.body)})` : err.message
      setPublishStatus((s) => ({ ...s, [vars.id]: `Error: ${msg}` }))
    },
  })

  const triggerPublish = useCallback(
    (id: string, payload: Record<string, unknown>, eventName: string) => {
      const name =
        eventName.trim() ||
        reduxEvents.find((e) => e.id === id)?.name ||
        'event'

      const schema = reduxEvents.find((e) => e.id === id)?.schema ?? []
      const payloadToSend = injectTriggerTimestamps(schema, payload)

      if (publishUrl || backend) {
        publishRemote.mutate({ id, payload: payloadToSend, eventName: name })
        return
      }
      const envelope = {
        eventName: name,
        mockEventId: id,
        payload: payloadToSend,
        publishedAt: new Date().toISOString(),
      }
      const body = {
        ok: true,
        mode: 'simulated-local',
        message:
          'No publish URL — this envelope exists only in the browser. Set VITE_PUBLISH_URL=/api/publish on Vercel when you are ready.',
        envelope,
      }
      setPublishStatus((s) => ({ ...s, [id]: JSON.stringify(body, null, 2) }))
      dispatch(markExperienceAwaitingRefresh(id))
    },
    [backend, dispatch, publishRemote, reduxEvents],
  )

  return {
    triggerPublish,
    publishStatus,
    publishPending: publishRemote.isPending,
  }
}
