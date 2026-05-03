/**
 * Vercel serverless: publish GrowthLoop-shaped event JSON to Confluent via REST Produce API.
 * Same pattern as example_event_bridge/vercel_kafka_shopify_checkouts_create/app.py
 *
 * Env: KAFKA_REST_HOST, KAFKA_CLUSTER_ID, KAFKA_TOPIC, KAFKA_API_KEY, KAFKA_API_SECRET
 * Optional: PUBLISH_INGRESS_SECRET — require Authorization: Bearer <secret>
 * Optional: ALLOWED_ORIGINS — comma-separated CORS origins (default *)
 */

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

  const host = process.env.KAFKA_REST_HOST
  const clusterId = process.env.KAFKA_CLUSTER_ID
  const topic = process.env.KAFKA_TOPIC || 'vercel_checkout_create'
  const apiKey = process.env.KAFKA_API_KEY
  const apiSecret = process.env.KAFKA_API_SECRET

  if (!host || !clusterId || !apiKey || !apiSecret) {
    res.status(500).json({
      error:
        'Kafka REST not configured. Set KAFKA_REST_HOST, KAFKA_CLUSTER_ID, KAFKA_API_KEY, KAFKA_API_SECRET (and optionally KAFKA_TOPIC).',
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
    res.status(400).json({ error: 'Body must include a JSON object "payload" (GrowthLoop properties)' })
    return
  }

  const kafkaRestBody = {
    value: {
      type: 'JSON',
      data: payload,
    },
  }

  const endpoint = `https://${host}/kafka/v3/clusters/${clusterId}/topics/${encodeURIComponent(topic)}/records`
  const basic = Buffer.from(`${apiKey}:${apiSecret}`, 'utf8').toString('base64')

  let cfRes
  try {
    cfRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${basic}`,
      },
      body: JSON.stringify(kafkaRestBody),
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: `Confluent request failed: ${msg}` })
    return
  }

  const text = await cfRes.text()
  let parsed = null
  try {
    parsed = text ? JSON.parse(text) : null
  } catch {
    parsed = { raw: text }
  }

  if (!cfRes.ok) {
    res.status(502).json({
      error: 'Confluent REST rejected the produce request',
      status: cfRes.status,
      details: parsed,
    })
    return
  }

  res.status(200).json({
    ok: true,
    mode: 'confluent-rest',
    topic,
    envelope: {
      eventName: eventName ?? null,
      mockEventId: mockEventId ?? null,
      payload,
      publishedAt: new Date().toISOString(),
    },
    confluent: parsed,
  })
}
