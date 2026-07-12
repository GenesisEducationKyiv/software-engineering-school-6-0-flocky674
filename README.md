# github-release-notifier

Підписка на email-сповіщення про нові релізи GitHub репозиторіїв.

## Стек

Node.js, Fastify, Prisma, PostgreSQL, node-cron, Nodemailer, Elasticsearch, Kibana, Prometheus, Grafana

Fastify замість Nest.js - простіше розібратись що відбувається. Prisma для міграцій і запитів до БД. node-cron для фонової перевірки релізів.

## Запуск

```bash
cp .env.example .env
docker compose up --build
```

Після старту доступні:

| Сервіс | URL | Для чого |
|---|---|---|
| App | http://localhost:3000 | Основний застосунок |
| Metrics | http://localhost:3000/metrics | Prometheus endpoint |
| Elasticsearch | http://localhost:9200 | Сховище логів |
| Kibana | http://localhost:5601 | Пошук і агрегація логів |
| Prometheus | http://localhost:9090 | Збір RED-метрик |
| Grafana | http://localhost:3001 | Dashboard з RED-метриками |
| MailHog | http://localhost:8025 | Перегляд локальних email |

Grafana логін: `admin`, пароль: `admin`.

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

## Observability

У Docker застосунок пише структуровані JSON-логи через Pino і відправляє їх у Logstash через HTTP. Logstash записує події в Elasticsearch в індекси `github-release-notifier-logs-*`. У Kibana можна створити data view для `github-release-notifier-logs-*` і фільтрувати логи за `service`, `app.level`, `app.route`, `app.statusCode`, `app.requestId`.

Застосунок також відкриває endpoint `/metrics`. Prometheus збирає з нього RED-метрики:

- `http_requests_total` — rate, кількість HTTP-запитів за `method`, `route`, `status_code`;
- `http_request_errors_total` — errors, кількість 5xx відповідей;
- `http_request_duration_seconds` — duration, histogram тривалості запитів.

Grafana автоматично підключає Prometheus як datasource і створює dashboard `GitHub Release Notifier RED Metrics`.

Щоб згенерувати трафік для метрик і логів:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/metrics
```

Після цього дані можна перевірити:

- у Prometheus: `http_requests_total`;
- у Grafana: dashboard `GitHub Release Notifier RED Metrics`;
- у Kibana: data view `github-release-notifier-logs-*`.

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
