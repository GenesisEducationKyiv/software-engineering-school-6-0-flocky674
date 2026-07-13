import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || '0.0.0.0',

  databaseUrl: process.env.DATABASE_URL || '',

  github: {
    token: process.env.GITHUB_TOKEN || '',
    apiBase: 'https://api.github.com',
  },

  notifierService: {
    url: process.env.NOTIFIER_SERVICE_URL || 'http://localhost:3002',
    grpcUrl: process.env.NOTIFIER_GRPC_URL || 'localhost:50051',
    // Transport for the app -> notifier call: 'broker' | 'http' | 'grpc'
    transport: process.env.NOTIFIER_TRANSPORT || 'broker',
  },

  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://localhost:5672',
  },

  scanner: {
    intervalMinutes: parseInt(process.env.SCAN_INTERVAL_MINUTES || '5', 10),
  },

  apiKey: process.env.API_KEY || '',

  appUrl: process.env.APP_URL || 'http://localhost:3000',
};
