/**
 * Vercel serverless: proxy Personalization API by customer_id (secret stays server-side).
 *
 * Set in Vercel → Settings → Environment Variables (NOT prefixed with VITE_):
 *   PERSONALIZATION_API_BASE_URL
 *   PERSONALIZATION_API_PATH_TEMPLATE  — must include {{customerId}}, e.g. v1/profiles/{{customerId}}
 *   PERSONALIZATION_API_KEY            — optional; sent as Authorization: Bearer <key>
 *
 * Client calls POST /api/personalization with JSON { "customerId": "..." } only.
 * The browser never receives these env vars — they exist only on Vercel’s serverless runtime.
 *
 * Optional: ALLOWED_ORIGINS (comma-separated CORS), same as api/publish.js
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

function joinBaseAndPath(base, pathRel) {
  const b = base.replace(/\/$/, '')
  const p = pathRel.replace(/^\//, '')
  return `${b}/${p}`
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

  const base = process.env.PERSONALIZATION_API_BASE_URL?.trim()
  const template = process.env.PERSONALIZATION_API_PATH_TEMPLATE?.trim()
  const apiKey = process.env.PERSONALIZATION_API_KEY?.trim()

  if (!base) {
    res.status(503).json({
      error:
        'PERSONALIZATION_API_BASE_URL is not set on this deployment (Vercel project env).',
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

  const customerId = typeof body?.customerId === 'string' ? body.customerId.trim() : ''
  if (!customerId) {
    res.status(400).json({ error: 'Body must include a non-empty string "customerId".' })
    return
  }

  if (!template) {
    res.status(503).json({
      error:
        'PERSONALIZATION_API_PATH_TEMPLATE is not set. Example: v1/profiles/{{customerId}}',
    })
    return
  }
  if (!template.includes('{{customerId}}')) {
    res.status(503).json({
      error:
        'PERSONALIZATION_API_PATH_TEMPLATE must include the literal placeholder {{customerId}}.',
    })
    return
  }

  const pathResolved = template.replace(
    /\{\{customerId\}\}/g,
    () => encodeURIComponent(customerId),
  )
  const url = joinBaseAndPath(base, pathResolved)

  const headers = {
    accept: 'application/json',
  }
  if (apiKey) {
    headers.authorization = `Bearer ${apiKey}`
  }

  let upstream
  try {
    upstream = await fetch(url, { method: 'GET', headers })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    res.status(502).json({ error: `Upstream request failed: ${msg}` })
    return
  }

  const text = await upstream.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  res.status(upstream.ok ? 200 : upstream.status).json({
    ok: upstream.ok,
    status: upstream.status,
    data: json,
  })
}
