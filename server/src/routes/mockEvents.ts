import type { FastifyInstance } from 'fastify';
import { mockEventSchema } from '../types.js';
import { getSupabase } from '../lib/supabase.js';
import { env } from '../env.js';
import { kafkaConfigured, publishEvent } from '../lib/kafka.js';
import {
  PayloadValidationError,
  validatePayloadAgainstSchema,
} from '../lib/validatePayload.js';
import { injectTriggerTimestamps } from '../lib/injectTriggerTimestamps.js';

export async function mockEventsRoutes(app: FastifyInstance) {
  app.get('/api/mock-events', async (_req, reply) => {
    const sb = getSupabase();
    const { data, error } = await sb
      .from('mock_events')
      .select('id,name,schema,created_at')
      .order('created_at', { ascending: false });

    if (error) {
      reply.code(500);
      return { error: error.message };
    }
    return { events: data ?? [] };
  });

  app.post('/api/mock-events', async (req, reply) => {
    const parsed = mockEventSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return {
        error: 'Invalid mock event',
        details: parsed.error.flatten(),
      };
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from('mock_events')
      .insert({
        name: parsed.data.name,
        schema: parsed.data.schema,
      })
      .select('id,name,schema,created_at')
      .single();

    if (error) {
      reply.code(500);
      return { error: error.message };
    }
    reply.code(201);
    return { event: data };
  });

  app.patch('/api/mock-events/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const parsed = mockEventSchema.safeParse(req.body);
    if (!parsed.success) {
      reply.code(400);
      return {
        error: 'Invalid mock event',
        details: parsed.error.flatten(),
      };
    }

    const sb = getSupabase();
    const { data, error } = await sb
      .from('mock_events')
      .update({
        name: parsed.data.name,
        schema: parsed.data.schema,
      })
      .eq('id', id)
      .select('id,name,schema,created_at')
      .single();

    if (error) {
      reply.code(error.code === 'PGRST116' ? 404 : 500);
      return { error: error.message };
    }
    return { event: data };
  });

  app.delete('/api/mock-events/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const sb = getSupabase();
    const { error } = await sb.from('mock_events').delete().eq('id', id);

    if (error) {
      reply.code(500);
      return { error: error.message };
    }
    return { ok: true };
  });

  app.post('/api/mock-events/:id/publish', async (req, reply) => {
    const { id } = req.params as { id: string };
    const body = req.body as { payload?: unknown };

    const sb = getSupabase();
    const { data: row, error } = await sb
      .from('mock_events')
      .select('id,name,schema')
      .eq('id', id)
      .single();

    if (error || !row) {
      reply.code(error?.code === 'PGRST116' ? 404 : 500);
      return { error: error?.message ?? 'Not found' };
    }

    const schema = row.schema as unknown;
    if (!Array.isArray(schema)) {
      reply.code(500);
      return { error: 'Stored schema is invalid' };
    }

    const rawPayload =
      body.payload !== null && typeof body.payload === 'object' && !Array.isArray(body.payload)
        ? (body.payload as Record<string, unknown>)
        : {};

    const payload = injectTriggerTimestamps(
      schema as never,
      rawPayload,
    );

    try {
      validatePayloadAgainstSchema(schema as never, payload);
    } catch (e) {
      if (e instanceof PayloadValidationError) {
        reply.code(400);
        return { error: e.message, path: e.path };
      }
      throw e;
    }

    const envelope = {
      eventName: row.name,
      mockEventId: row.id,
      payload,
      publishedAt: new Date().toISOString(),
    };

    if (!kafkaConfigured()) {
      app.log.warn(
        { envelope },
        'Kafka not configured — event not sent (dev fallback)',
      );
      return {
        ok: true,
        mode: 'simulated',
        message:
          'Kafka is not configured on this server. Payload was validated only. Set KAFKA_BROKERS and KAFKA_TOPIC to publish for real.',
        envelope,
      };
    }

    try {
      await publishEvent(envelope);
      return { ok: true, mode: 'kafka', topic: env.kafkaTopic, envelope };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      reply.code(502);
      return { error: `Kafka publish failed: ${msg}` };
    }
  });
}
