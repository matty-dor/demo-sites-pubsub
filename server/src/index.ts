import Fastify from 'fastify';
import cors from '@fastify/cors';
import { env } from './env.js';
import { mockEventsRoutes } from './routes/mockEvents.js';
import { dynamicContentRoutes } from './routes/dynamicContent.js';
import { personalizationRoutes } from './routes/personalization.js';
import { growthloopRoutes } from './routes/growthloop.js';

const app = Fastify({ logger: true });

await app.register(cors, {
  origin: env.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

app.get('/health', async () => ({ ok: true }));

await app.register(mockEventsRoutes);
await app.register(dynamicContentRoutes);
await app.register(personalizationRoutes);
await app.register(growthloopRoutes);

app.setErrorHandler((err, _req, reply) => {
  app.log.error(err);
  reply.code(500);
  const message = err instanceof Error ? err.message : 'Internal error';
  return { error: message };
});

try {
  await app.listen({ port: env.port, host: '0.0.0.0' });
  app.log.info(`API listening on ${env.port}`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
