import pino from 'pino';

export default pino({
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'notifier',
    environment: process.env.NODE_ENV || 'development',
  },
  transport:
    process.env.NODE_ENV !== 'production'
      ? { target: 'pino-pretty', options: { colorize: true } }
      : undefined,
});
