import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../env.js';

const proxyBodySchema = z.object({
  /** When set, server builds the request path from PERSONALIZATION_API_PATH_TEMPLATE. */
  customerId: z.string().optional(),
  path: z.string().optional(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH']).optional(),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
});

function joinBaseAndPath(base: string, pathRel: string): string {
  const b = base.replace(/\/$/, '');
  const p = pathRel.replace(/^\//, '');
  return `${b}/${p}`;
}

async function forwardPersonalizationRequest(url: string, init: RequestInit) {
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

  return {
    error: null as null,
    upstream,
    json,
  };
}

export async function personalizationRoutes(app: FastifyInstance) {
  app.post('/api/personalization', async (req, reply) => {
    const base = env.personalizationBaseUrl;
    const apiKey = env.personalizationApiKey;

    if (!base) {
      reply.code(503);
      return {
        error:
          'Personalization API is not configured. Set PERSONALIZATION_API_BASE_URL (and PERSONALIZATION_API_PATH_TEMPLATE when using customerId).',
      };
    }

    const parsed = proxyBodySchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      reply.code(400);
      return { error: 'Invalid request', details: parsed.error.flatten() };
    }

    const raw = parsed.data;
    const customerId = raw.customerId?.trim();

    const headers: Record<string, string> = {
      'content-type': 'application/json',
      ...(raw.headers ?? {}),
    };
    if (apiKey) {
      headers.authorization = headers.authorization ?? `Bearer ${apiKey}`;
    }

    let url: string;
    let init: RequestInit;

    if (customerId) {
      const template = env.personalizationPathTemplate;
      if (!template?.trim()) {
        reply.code(503);
        return {
          error:
            'customerId requests require PERSONALIZATION_API_PATH_TEMPLATE on the server, e.g. v1/profiles/{{customerId}} (must contain {{customerId}}).',
        };
      }
      if (!template.includes('{{customerId}}')) {
        reply.code(503);
        return {
          error:
            'PERSONALIZATION_API_PATH_TEMPLATE must include the literal placeholder {{customerId}}.',
        };
      }

      const pathResolved = template.replace(
        /\{\{customerId\}\}/g,
        () => encodeURIComponent(customerId),
      );
      url = joinBaseAndPath(base, pathResolved);
      init = { method: 'GET', headers };
    } else {
      const path = raw.path ?? '/';
      const method = raw.method ?? 'GET';
      url = new URL(path.replace(/^\//, ''), base.endsWith('/') ? base : `${base}/`).href;
      init = { method, headers };
      if (raw.body !== undefined && method !== 'GET') {
        init.body =
          typeof raw.body === 'string' ? raw.body : JSON.stringify(raw.body);
      }
    }

    const result = await forwardPersonalizationRequest(url, init);
    if (result.error) {
      reply.code(502);
      return { error: result.error };
    }

    const { upstream, json } = result;
    reply.code(upstream.ok ? 200 : upstream.status);
    return {
      ok: upstream.ok,
      status: upstream.status,
      data: json,
    };
  });
}
