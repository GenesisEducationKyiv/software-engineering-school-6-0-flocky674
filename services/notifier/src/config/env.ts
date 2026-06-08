import 'dotenv/config';

export const config = {
  port: parseInt(process.env.PORT || '3002', 10),
  host: process.env.HOST || '0.0.0.0',

  smtp: {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '1025', 10),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.EMAIL_FROM || 'no-reply@example.com',
  },
};
