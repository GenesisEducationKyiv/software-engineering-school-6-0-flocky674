import amqplib, { Channel, Connection } from 'amqplib';
import { config } from '../config/env';
import logger from '../shared/utils/logger';

let connection: Connection | null = null;
let channel: Channel | null = null;

async function connectWithRetry(retries = 10, delayMs = 3_000): Promise<Connection> {
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await amqplib.connect(config.rabbitmq.url);
    } catch (err) {
      logger.warn({ attempt, retries }, 'rabbitmq connection failed, retrying');
      if (attempt === retries) {
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  throw new Error('rabbitmq connection failed');
}

export async function getChannel(): Promise<Channel> {
  if (channel) {
    return channel;
  }

  connection = await connectWithRetry();
  channel = await connection.createChannel();

  connection.on('close', () => {
    connection = null;
    channel = null;
  });

  logger.info('rabbitmq channel established');
  return channel;
}

export async function closeConnection(): Promise<void> {
  await channel?.close();
  await connection?.close();
  channel = null;
  connection = null;
}
