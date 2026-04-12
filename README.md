# github-release-notifier

Підписка на email-сповіщення про нові релізи GitHub репозиторіїв.

## Стек

Node.js, Fastify, Prisma, PostgreSQL, node-cron, Nodemailer

Fastify замість Nest.js - простіше розібратись що відбувається. Prisma для міграцій і запитів до БД. node-cron для фонової перевірки релізів.

## Запуск

```bash
cp .env.example .env
docker compose up --build
```

Локально без Docker:

```bash
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

## API
| POST | `/api/subscribe` | Підписатись |
| GET | `/api/confirm/:token` | Підтвердити підписку |
| GET | `/api/unsubscribe/:token` | Відписатись |
| GET | `/api/subscriptions?email=` | Список підписок |

Повний контракт — `swagger.yaml`.

## Як працює

При підписці надсилається confirmation email. Після підтвердження підписка стає активною. Кожні N хвилин сканер перевіряє останній реліз для кожного репо — якщо тег змінився, надсилає email підписникам.

При першій підписці фіксується поточний тег як базовий — щоб не надсилати лист про реліз який вже існував.

Якщо GitHub повертає 429 — в API повертаю 429 клієнту, в сканері пропускаю цикл і чекаю наступного.

## .env

```env
DATABASE_URL=postgresql://user@localhost:5432/github_release_notifier
GITHUB_TOKEN=
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_USER=resend
SMTP_PASS=re_xxxxxxxxxx
EMAIL_FROM=onboarding@resend.dev
APP_URL=http://localhost:3000
SCAN_INTERVAL_MINUTES=5
API_KEY=
```

Для email використовував Resend. На безкоштовному плані листи йдуть тільки на власний email — для інших потрібен свій домен.

## Тести

```bash
npm test
```
