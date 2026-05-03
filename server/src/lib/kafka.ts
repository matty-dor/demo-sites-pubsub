import { Kafka, logLevel, type Producer } from 'kafkajs';
import { env } from '../env.js';

let producer: Producer | null = null;

function brokerList(): string[] {
  const raw = env.kafkaBrokers;
  if (!raw) return [];
  return raw.split(',').map((b) => b.trim()).filter(Boolean);
}

export function kafkaConfigured(): boolean {
  return brokerList().length > 0 && Boolean(env.kafkaTopic);
}

export async function getProducer(): Promise<Producer> {
  if (!kafkaConfigured()) {
    throw new Error(
      'Kafka is not configured. Set KAFKA_BROKERS and KAFKA_TOPIC on this deployment.',
    );
  }
  if (producer) return producer;

  const kafka = new Kafka({
    clientId: 'growthloop-poc-demo',
    brokers: brokerList(),
    ssl: env.kafkaSsl,
    ...(env.kafkaUsername && env.kafkaPassword
      ? {
          sasl: {
            mechanism: 'plain',
            username: env.kafkaUsername,
            password: env.kafkaPassword,
          },
        }
      : {}),
    logLevel: logLevel.NOTHING,
  });

  producer = kafka.producer();
  await producer.connect();
  return producer;
}

export async function publishEvent(payload: unknown): Promise<void> {
  const topic = env.kafkaTopic;
  if (!topic) throw new Error('KAFKA_TOPIC is not set');

  const p = await getProducer();
  const value = JSON.stringify(payload);
  await p.send({
    topic,
    messages: [{ value }],
  });
}

export async function disconnectKafka(): Promise<void> {
  if (producer) {
    await producer.disconnect();
    producer = null;
  }
}
