import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';

const proxyBodySchema = z.object({
  path: z.string().default('/'),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH']).default('GET'),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

export async function personalizationRoutes(app: FastifyInstance) {
  app.post('/api/personalization', async (req, reply) => {
    const base = env.personalizationBaseUrl;
    const apiKey = env.personalizationApiKey;

    if (!base) {
      reply.code(503);
      return {
        error:
          'Personalization API is not configured. Set PERSONALIZATION_API_BASE_URL (and key if required) on the server.',
      };
    }

    const parsed = proxyBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid request', details: parsed.error.flatten() };
    }

    const { path, method, headers: extraHeaders, body } = parsed.data;
    const url = new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`);

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(extraHeaders ?? {}),
    };
    if (apiKey) {
      headers.authorization = headers.authorization ?? `Bearer ${apiKey}`;
    }

    const init: RequestInit = { method, headers };
    if (body !== undefined && method !== 'GET') {
      init.body = typeof body === 'string' ? body : JSON.stringify(body);
    }

    let upstream: Response;
    try {
      upstream = await fetch(url, init);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      reply.code(502);
      return { error: `Upstream request failed: ${msg}` };
    }

    const text = await upstream.text();
    let json: unknown;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = { raw: text };
    }

    reply.code(upstream.ok ? 200 : upstream.status);
    return {
      ok: upstream.ok,
      status: upstream.status,
      data: json,
    };
  });
}
