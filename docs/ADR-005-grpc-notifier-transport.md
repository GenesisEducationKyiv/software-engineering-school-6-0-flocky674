# ADR-005: gRPC-транспорт для виклику app -> notifier

## Статус

Прийнято.

## Контекст

Синхронний виклик між `app` і `notifier` (надсилання email) історично був
HTTP REST (`NotifierClient` → `POST /api/emails/*`). Завдання HW#10 — замінити
одну REST-комунікацію між мікросервісами на gRPC, описати контракт у `.proto`,
підключити `buf`, і лишити стару REST-реалізацію поряд для порівняння.

## Рішення

- Контракт: [proto/notifier/v1/mail.proto](../proto/notifier/v1/mail.proto) —
  сервіс `MailVerificationService` з unary RPC `SendConfirmationEmail` і
  `SendReleaseNotification`.
- Тулінг: `buf` для lint і кодогенерації
  ([buf.yaml](../buf.yaml), [buf.gen.yaml](../buf.gen.yaml)); плагін `ts-proto`
  з `outputServices=grpc-js`. Згенерований код комітиться в обидва пакети
  (`src/generated`, `services/notifier/src/generated`).
- Сервер: [services/notifier/src/grpc/mail.grpc.server.ts](../services/notifier/src/grpc/mail.grpc.server.ts)
  на `@grpc/grpc-js`; помилки мапляться на gRPC status codes
  (`INVALID_ARGUMENT` для невалідного запиту, `INTERNAL` для збою доставки).
- Клієнт: [src/modules/notifier/notifier.grpc.client.ts](../src/modules/notifier/notifier.grpc.client.ts)
  реалізує той самий `NotifierPort`, що й REST-клієнт та broker-publisher.
- Транспорт обирається змінною `NOTIFIER_TRANSPORT` (`broker` | `http` | `grpc`),
  дефолт `broker`. Стара REST-реалізація (`notifier.client.ts` + роути
  `/api/emails/*`) **лишається** в кодовій базі.

## REST vs gRPC

| Аспект | REST (HTTP/1.1 + JSON) | gRPC (HTTP/2 + Protobuf) |
|---|---|---|
| Контракт | неявний (тіло JSON) | суворий `.proto`, кодогенерація |
| Формат | текстовий JSON | бінарний Protobuf (компактніший) |
| Транспорт | HTTP/1.1 | HTTP/2 (мультиплексування) |
| Помилки | HTTP status codes | gRPC status codes |
| Типобезпека | ручна | згенерована з контракту |

Як зміряти throughput (bonus): для REST — `autocannon` по `POST /api/emails/confirmation`;
для gRPC — `ghz` по `notifier.v1.MailVerificationService/SendConfirmationEmail`.
Очікувано gRPC дає вищий throughput і нижчу латентність на однакових payload
завдяки бінарній серіалізації та HTTP/2.

## Наслідки

- Один і той самий виклик доступний через три транспорти за спільним `NotifierPort`.
- Контракт формалізовано; зміни валідуються через `buf lint`.
- REST лишається робочим для порівняння й зворотної сумісності.
