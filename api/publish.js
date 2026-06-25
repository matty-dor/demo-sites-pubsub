/**
 * Vercel serverless: publish GrowthLoop-shaped event JSON to Google Cloud Pub/Sub.
 *
 * Env (runtime):
 *   GCP_PROJECT_ID
 *   GCP_PUBSUB_TOPIC          — topic ID only (e.g. demo-events), not the full resource path
 *   GCP_SERVICE_ACCOUNT_JSON  — service account key JSON (single string; needs roles/pubsub.publisher)
 *
 * Optional:
 *   PUBLISH_INGRESS_SECRET — require Authorization: Bearer <secret>
 *   ALLOWED_ORIGINS        — comma-separated CORS origins (default *)
 *
 * Message data is JSON: { event_type, …payloadFields }. event_type is set from the request
 * eventName when missing so GrowthLoop can route on event type.
 */

const { PubSub } = require('@google-cloud/pubsub')

function corsHeaders(req) {
  const raw = process.env.ALLOWED_ORIGINS
  const origin = req.headers.origin
  if (!raw || raw === '*') {
    return {
      'Access-Control-Allow-Origin': origin || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  }
  const allowed = raw.split(',').map((s) => s.trim()).filter(Boolean)
  const o = origin && allowed.includes(origin) ? origin : allowed[0] || '*'
  return {
    'Access-Control-Allow-Origin': o,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

/** @param {string} eventName @param {Record<string, unknown>} payload */
function withEventType(eventName, payload) {
  const name = (eventName || '').trim() || 'event'
  const { event_type: _omit, ...rest } = payload
  return { event_type: name, ...rest }
}

let pubsubClient = null

function getPubSubClient() {
  if (pubsubClient) return pubsubClient

  const projectId = (process.env.GCP_PROJECT_ID || '').trim()
  const rawJson = process.env.GCP_SERVICE_ACCOUNT_JSON
  if (!projectId || !rawJson) {
    throw new Error('GCP_PROJECT_ID and GCP_SERVICE_ACCOUNT_JSON are required')
  }

  let credentials
  try {
    credentials = JSON.parse(rawJson)
  } catch {
    throw new Error('GCP_SERVICE_ACCOUNT_JSON is not valid JSON')
  }

  pubsubClient = new PubSub({ projectId, credentials })
  return pubsubClient
}

module.exports = async function handler(req, res) {
  const c = corsHeaders(req)
  for (const [k, v] of Object.entries(c)) {
    res.setHeader(k, v)
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const ingress = process.env.PUBLISH_INGRESS_SECRET
  if (ingress) {
    const auth = req.headers.authorization
    if (auth !== `Bearer ${ingress}`) {
      res.status(401).json({ error: 'Unauthorized' })
      return
    }
  }

  const topicName = (process.env.GCP_PUBSUB_TOPIC || '').trim()
  const projectId = (process.env.GCP_PROJECT_ID || '').trim()

  if (!projectId || !topicName) {
    res.status(500).json({
      error:
        'Pub/Sub not configured. Set GCP_PROJECT_ID, GCP_PUBSUB_TOPIC, and GCP_SERVICE_ACCOUNT_JSON.',
    })
    return
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      res.status(400).json({ error: 'Invalid JSON body' })
      return
    }
  }

  const { payload, eventName, mockEventId } = body || {}
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    res.status(400).json({
      error: 'Body must include a JSON object "payload" (GrowthLoop properties)',
    })
    return
  }

  const messagePayload = withEventType(
    typeof eventName === 'string' ? eventName : '',
    payload,
  )
  const dataBuffer = Buffer.from(JSON.stringify(messagePayload), 'utf8')

  let messageId
  try {
    messageId = await getPubSubClient()
      .topic(topicName)
      .publishMessage({ data: dataBuffer })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[api/publish] Pub/Sub publish error', { projectId, topicName, message: msg })
    res.status(502).json({
      error: `Pub/Sub publish failed: ${msg}`,
      hint:
        'Check GCP_SERVICE_ACCOUNT_JSON (valid JSON with pubsub.publisher on the topic), GCP_PROJECT_ID, and GCP_PUBSUB_TOPIC.',
    })
    return
  }

  res.status(200).json({
    ok: true,
    mode: 'pubsub',
    topic: topicName,
    messageId,
    envelope: {
      eventName: eventName ?? null,
      mockEventId: mockEventId ?? null,
      payload: messagePayload,
      publishedAt: new Date().toISOString(),
    },
  })
}
