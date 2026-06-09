/**
 * Vercel serverless: proxy GrowthLoop public API (audiences, dataset groups).
 *
 * Server env (NOT VITE_*):
 *   GROWTHLOOP_API_TOKEN
 *   GROWTHLOOP_API_ACCESS_KEY
 *   GROWTHLOOP_API_BASE_URL  — optional, default https://app.growthloop.com
 *
 * Client: POST /api/growthloop with JSON body:
 *   { "op": "listDatasetGroups", "teamId"?: number, "pageNumber"?: number, "perPage"?: number }
 *   { "op": "showDatasetGroup", "id": string }
 *   { "op": "createAudience", "audience": { ... } }  — wrapped as { audience } upstream
 */

const DEFAULT_BASE = 'https://app.growthloop.com'

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

function baseUrl() {
  const b = process.env.GROWTHLOOP_API_BASE_URL?.trim()
  return (b || DEFAULT_BASE).replace(/\/$/, '')
}

function authHeader() {
  const token = process.env.GROWTHLOOP_API_TOKEN?.trim()
  const accessKey = process.env.GROWTHLOOP_API_ACCESS_KEY?.trim()
  if (!token || !accessKey) return null
  return `Bearer token=${token}, access_key=${accessKey}`
}

function parseBody(req) {
  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return { error: 'Invalid JSON body' }
    }
  }
  if (!body || typeof body !== 'object') {
    return { error: 'Body must be a JSON object' }
  }
  return { body }
}

async function forward(url, init) {
  let upstream
  try {
    upstream = await fetch(url, init)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return { error: `Upstream request failed: ${msg}`, status: 502 }
  }

  const text = await upstream.text()
  let json
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    json = { raw: text }
  }

  return {
    ok: upstream.ok,
    status: upstream.status,
    data: json,
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

  const authorization = authHeader()
  if (!authorization) {
    res.status(503).json({
      error:
        'GROWTHLOOP_API_TOKEN and GROWTHLOOP_API_ACCESS_KEY must be set on this deployment.',
    })
    return
  }

  const parsed = parseBody(req)
  if (parsed.error) {
    res.status(400).json({ error: parsed.error })
    return
  }

  const { body } = parsed
  const op = typeof body.op === 'string' ? body.op.trim() : ''
  const headers = {
    accept: 'application/json',
    'content-type': 'application/json',
    authorization,
  }

  const root = baseUrl()

  if (op === 'listDatasetGroups') {
    const url = new URL(`${root}/api/public/dataset_groups`)
    if (body.teamId !== undefined && body.teamId !== null && body.teamId !== '') {
      url.searchParams.set('team_id', String(body.teamId))
    }
    if (body.pageNumber !== undefined && body.pageNumber !== null) {
      url.searchParams.set('page_number', String(body.pageNumber))
    }
    if (body.perPage !== undefined && body.perPage !== null) {
      url.searchParams.set('per_page', String(body.perPage))
    }
    const result = await forward(url.href, { method: 'GET', headers })
    if (result.error) {
      res.status(result.status).json({ error: result.error })
      return
    }
    res.status(result.ok ? 200 : result.status).json(result)
    return
  }

  if (op === 'showDatasetGroup') {
    const id = typeof body.id === 'string' ? body.id.trim() : String(body.id ?? '').trim()
    if (!id) {
      res.status(400).json({ error: 'Body must include a non-empty "id" for showDatasetGroup.' })
      return
    }
    const url = `${root}/api/public/dataset_groups/${encodeURIComponent(id)}`
    const result = await forward(url, { method: 'GET', headers })
    if (result.error) {
      res.status(result.status).json({ error: result.error })
      return
    }
    res.status(result.ok ? 200 : result.status).json(result)
    return
  }

  if (op === 'createAudience') {
    const audience = body.audience
    if (!audience || typeof audience !== 'object' || Array.isArray(audience)) {
      res.status(400).json({
        error: 'Body must include an object "audience" for createAudience.',
      })
      return
    }
    const url = `${root}/api/public/audiences`
    const result = await forward(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ audience }),
    })
    if (result.error) {
      res.status(result.status).json({ error: result.error })
      return
    }
    res.status(result.ok ? 200 : result.status).json(result)
    return
  }

  res.status(400).json({
    error:
      'Unknown op. Use listDatasetGroups, showDatasetGroup, or createAudience.',
  })
}
