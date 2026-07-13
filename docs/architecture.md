# Архітектура застосунку

GitHub Release Notifier — сервіс підписки на email-сповіщення про нові релізи
GitHub-репозиторіїв. Складається з двох сервісів (`app` і `notifier`) та
інфраструктури (PostgreSQL, RabbitMQ, стек спостережуваності, MailHog).

## 1. System context

```mermaid
flowchart TB
  user([Користувач])
  github[GitHub API]
  smtp[SMTP / MailHog]

  subgraph system [GitHub Release Notifier]
    app[app - API + scanner]
    notifier[notifier - email service]
  end

  user -->|"HTTP: підписка, підтвердження, відписка"| app
  app -->|"перевірка репо / релізи"| github
  app -->|"команди на email"| notifier
  notifier -->|"надсилання листів"| smtp
```

## 2. Container diagram

```mermaid
flowchart LR
  user([Користувач])

  subgraph app_c [app / API service]
    api["HTTP API (Fastify)"]
    scanner["Release scanner (cron)"]
  end

  db[(PostgreSQL)]
  mq[["RabbitMQ (exchange notifications)"]]

  subgraph notifier_c [notifier service]
    consumer["Email consumer"]
    http_routes["HTTP routes /api/emails/*"]
    mailer["SMTP mailer"]
  end

  smtp[SMTP / MailHog]
  github[GitHub API]

  subgraph obs [Observability]
    logstash[Logstash] --> es[(Elasticsearch)] --> kibana[Kibana]
    prometheus[Prometheus] --> grafana[Grafana]
  end

  user --> api
  api --> db
  scanner --> db
  api --> github
  scanner --> github
  api -->|"publish"| mq
  scanner -->|"publish"| mq
  mq --> consumer
  consumer --> mailer --> smtp
  http_routes --> mailer
  api -->|"JSON logs"| logstash
  prometheus -->|"scrape /metrics"| api
```

## 3. Компонентна структура `app` (шари)

```mermaid
flowchart TD
  subgraph interface [Interface / delivery]
    controller["subscription.controller"]
    job["scanner.job"]
    root["app.ts / server.ts (composition root)"]
  end

  subgraph application [Application / services]
    subService["subscription.service"]
    scanService["scanner.service"]
    ghService["github.service"]
  end

  subgraph infrastructure [Infrastructure / adapters]
    repo["subscription.repository"]
    ghClient["github.client"]
    publisher["notifier.publisher"]
    restClient["notifier.client (REST)"]
    dbc["shared/db (prisma)"]
    mqc["shared/messaging"]
    metrics["shared/metrics"]
  end

  subgraph domain [Domain / shared kernel]
    errors["shared/errors"]
    utils["shared/utils"]
    types["notifier.types"]
    cfg["config"]
  end

  controller --> subService
  job --> scanService
  root --> subService
  root --> scanService
  subService --> ghService
  subService --> repo
  subService --> publisher
  scanService --> repo
  scanService --> ghService
  scanService --> publisher
  ghService --> ghClient
  repo --> dbc
  publisher --> mqc
  application --> domain
  infrastructure --> domain
```

Правило напряму залежностей: `interface → application → infrastructure`, і всі
шари можуть залежати від `domain` (shared kernel). Зворотних залежностей немає
(наприклад, infrastructure не імпортує application). Це перевіряється
автоматично — див. розділ 6.

## 4. Потік підписки (sequence)

```mermaid
sequenceDiagram
  participant U as Користувач
  participant A as app (API)
  participant G as GitHub API
  participant DB as PostgreSQL
  participant MQ as RabbitMQ
  participant N as notifier
  participant M as SMTP

  U->>A: POST /api/subscribe {email, repo}
  A->>G: verify repo + latest release
  A->>DB: upsert repository, create subscription
  A->>MQ: publish email.confirmation
  A-->>U: 200 Confirmation email sent
  MQ->>N: deliver command
  N->>M: send confirmation email
```

## 5. Потік сканування релізів (sequence)

```mermaid
sequenceDiagram
  participant C as Scanner (cron)
  participant DB as PostgreSQL
  participant G as GitHub API
  participant MQ as RabbitMQ
  participant N as notifier

  C->>DB: repos with confirmed subscriptions
  loop для кожного репо
    C->>G: latest release
    alt новий тег
      C->>DB: update lastSeenTag
      C->>DB: confirmed subscribers
      C->>MQ: publish email.release (на кожного підписника)
    end
  end
  MQ->>N: deliver commands -> send release emails
```

## 6. Шари та тести архітектурних залежностей (зірочка)

Шари визначено за розташуванням файлів:

| Шар | Файли |
|---|---|
| Interface | `*.controller.ts`, `*.job.ts`, `app.ts`, `server.ts` |
| Application | `*.service.ts` |
| Infrastructure | `*.repository.ts`, `*.client.ts`, `*.publisher.ts`, `shared/db`, `shared/messaging`, `shared/metrics` |
| Domain (shared kernel) | `shared/errors`, `shared/utils`, `*.types.ts`, `config` |

Правила залежностей закодовано в [.dependency-cruiser.cjs](../.dependency-cruiser.cjs)
і перевіряються тестом [tests/unit/architecture.test.ts](../tests/unit/architecture.test.ts):

- відсутність циклічних залежностей;
- infrastructure не залежить від application;
- application/infrastructure не залежать від interface;
- domain (shared kernel) не залежить від жодного вищого шару.

Запуск:

```bash
npm run arch:validate   # dependency-cruiser
npm run test:unit       # включає architecture.test.ts
```
