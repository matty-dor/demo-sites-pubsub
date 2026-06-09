import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';

const DEFAULT_BASE = 'https://app.growthloop.com';

const proxyBodySchema = z.discriminatedUnion('op', [
  z.object({
    op: z.literal('listDatasetGroups'),
    teamId: z.union([z.number(), z.string()]).optional(),
    pageNumber: z.number().int().positive().optional(),
    perPage: z.number().int().positive().max(100).optional(),
  }),
  z.object({
    op: z.literal('showDatasetGroup'),
    id: z.union([z.string(), z.number()]),
  }),
  z.object({
    op: z.literal('createAudience'),
    audience: z.record(z.unknown()),
  }),
]);

function baseUrl(): string {
  return (env.growthloopApiBaseUrl ?? DEFAULT_BASE).replace(/\/$/, '');
}

function authHeader(): string | null {
  const token = env.growthloopApiToken;
  const accessKey = env.growthloopApiAccessKey;
  if (!token || !accessKey) return null;
  return `Bearer token=${token}, access_key=${accessKey}`;
}

async function forward(url: string, init: RequestInit) {
  let upstream: Response;
  try {
    upstream = await fetch(url, init);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { error: `Upstream request failed: ${msg}` as const, upstream: null };
  }

  const text = await upstream.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  return { error: null as null, upstream, json };
}

export async function growthloopRoutes(app: FastifyInstance) {
  app.post('/api/growthloop', async (req, reply) => {
    const authorization = authHeader();
    if (!authorization) {
      reply.code(503);
      return {
        error:
          'GrowthLoop API is not configured. Set GROWTHLOOP_API_TOKEN and GROWTHLOOP_API_ACCESS_KEY on the server.',
      };
    }

    const parsed = proxyBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid request', details: parsed.error.flatten() };
    }

    const body = parsed.data;
    const headers: Record<string, string> = {
      accept: 'application/json',
      'content-type': 'application/json',
      authorization,
    };

    const root = baseUrl();

    if (body.op === 'listDatasetGroups') {
      const url = new URL(`${root}/api/public/dataset_groups`);
      if (body.teamId !== undefined && body.teamId !== '') {
        url.searchParams.set('team_id', String(body.teamId));
      }
      if (body.pageNumber !== undefined) {
        url.searchParams.set('page_number', String(body.pageNumber));
      }
      if (body.perPage !== undefined) {
        url.searchParams.set('per_page', String(body.perPage));
      }

      const result = await forward(url.href, { method: 'GET', headers });
      if (result.error) {
        reply.code(502);
        return { error: result.error };
      }

      const { upstream, json } = result;
      reply.code(upstream.ok ? 200 : upstream.status);
      return { ok: upstream.ok, status: upstream.status, data: json };
    }

    if (body.op === 'showDatasetGroup') {
      const id = String(body.id).trim();
      if (!id) {
        reply.code(400);
        return { error: 'id is required for showDatasetGroup.' };
      }

      const url = `${root}/api/public/dataset_groups/${encodeURIComponent(id)}`;
      const result = await forward(url, { method: 'GET', headers });
      if (result.error) {
        reply.code(502);
        return { error: result.error };
      }

      const { upstream, json } = result;
      reply.code(upstream.ok ? 200 : upstream.status);
      return { ok: upstream.ok, status: upstream.status, data: json };
    }

    const url = `${root}/api/public/audiences`;
    const result = await forward(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ audience: body.audience }),
    });
    if (result.error) {
      reply.code(502);
      return { error: result.error };
    }

    const { upstream, json } = result;
    reply.code(upstream.ok ? 200 : upstream.status);
    return { ok: upstream.ok, status: upstream.status, data: json };
  });
}
