import { Writable } from 'stream';

interface LogstashStreamOptions {
  url: string;
}

export function createLogstashStream(options: LogstashStreamOptions) {
  return new Writable({
    write(chunk, _encoding, callback) {
      const lines = chunk.toString('utf8').split('\n').filter(Boolean);

      for (const line of lines) {
        void sendLogLine(options.url, line);
      }

      callback();
    },
  });
}

async function sendLogLine(url: string, line: string) {
  try {
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: line,
    });
  } catch {
    // Logging must never break the application request path.
  }
}
