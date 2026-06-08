# github-release-notifier

Підписка на email-сповіщення про нові релізи GitHub репозиторіїв.

## Стек

Node.js, Fastify, Prisma, PostgreSQL, node-cron, Nodemailer

Fastify замість Nest.js - простіше розібратись що відбувається. Prisma для міграцій і запитів до БД. node-cron для фонової перевірки релізів.

## Архітектура

Застосунок розділений на модулі з окремими зонами відповідальності:

| Модуль | Відповідальність |
|---|---|
| `subscriptions` | API підписок, підтвердження, відписка, читання активних підписок |
| `scanner` | Фонове сканування GitHub релізів і пошук нових тегів |
| `github` | Інтеграція з GitHub API |
| `notifier` service | Окремий мікросервіс для email templates і SMTP-відправки |

Моноліт `app` не працює напряму з SMTP. Він викликає `notifier` через HTTP:

```text
app :3000 -> notifier :3002 -> SMTP/MailHog
```

Публічний API залишається в `app`, а `notifier` має внутрішній API:

| Метод | Endpoint | Опис |
|---|---|---|
| `GET` | `/health` | Health check мікросервісу |
| `POST` | `/api/emails/confirmation` | Надсилання confirmation email |
| `POST` | `/api/emails/release` | Надсилання release notification email |

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
NOTIFIER_SERVICE_URL=http://localhost:3002
APP_URL=http://localhost:3000
SCAN_INTERVAL_MINUTES=5
API_KEY=
```

SMTP налаштування тепер належать `services/notifier/.env.example`, бо email delivery винесений в окремий сервіс.

## Тести

```bash
npm test
```
