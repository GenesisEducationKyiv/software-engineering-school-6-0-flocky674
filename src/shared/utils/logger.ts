import pino from 'pino';
import { createLogstashStream } from './elasticsearch-log-stream';

const loggerOptions = {
  level: process.env.LOG_LEVEL || 'info',
  base: {
    service: 'github-release-notifier',
    environment: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

const logstashUrl = process.env.LOGSTASH_HTTP_URL;

export default process.env.NODE_ENV !== 'production'
  ? pino({
    ...loggerOptions,
    transport: { target: 'pino-pretty', options: { colorize: true } },
  })
  : pino(
    loggerOptions,
    pino.multistream([
      { stream: process.stdout },
      ...(logstashUrl ? [{ stream: createLogstashStream({ url: logstashUrl }) }] : []),
    ]),
  );
