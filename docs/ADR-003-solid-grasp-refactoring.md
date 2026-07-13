# ADR-003: Рефакторинг під SOLID та GRASP

## Статус

Прийнято.

## Контекст

Бізнес-сервіси залежали від конкретних інфраструктурних класів, репозиторії
безпосередньо використовували глобальний Prisma-singleton, а `SubscriptionService`
поєднував валідацію, роботу з БД, зовнішні виклики та формування DTO. Це давало
жорстке звʼязування, ускладнювало тестування і порушувало SRP/DIP.

## Рішення

### SOLID

- **SRP.** Валідацію email винесено у value object `EmailAddress`
  ([src/modules/subscriptions/email.ts](../src/modules/subscriptions/email.ts)),
  а формування відповіді — у мапер
  ([src/modules/subscriptions/subscription.mapper.ts](../src/modules/subscriptions/subscription.mapper.ts)).
  `SubscriptionService` тепер відповідає лише за оркестрацію сценарію.
- **OCP / ISP.** Введено вузькі порти:
  [subscription.ports.ts](../src/modules/subscriptions/subscription.ports.ts) і
  [github.ports.ts](../src/modules/github/github.ports.ts). Домен споживає
  `ReleaseProviderPort` (тільки потрібні операції), а не весь HTTP-клієнт.
- **LSP.** Конкретні адаптери (`SubscriptionRepository`, `RepositoryRepository`,
  `GitHubClient`, `GitHubService`) реалізують відповідні порти й взаємозамінні
  з фейками в тестах.
- **DIP.** Сервіси залежать від абстракцій (портів), а не від конкретних
  реалізацій. `PrismaClient` інʼєктується в репозиторії, `GitHubService`
  залежить від `GitHubApiPort`.

### GRASP

- **Low Coupling / Protected Variations.** Порти ізолюють домен від Prisma,
  axios та транспорту нотифікацій.
- **High Cohesion.** Кожен клас має одну зону відповідальності.
- **Pure Fabrication / Creator.** Єдиний composition root
  ([src/composition-root.ts](../src/composition-root.ts)) створює й звʼязує граф
  обʼєктів; сервіси та контролери не викликають `new`.
- **Information Expert.** `EmailAddress` володіє правилами валідності email;
  мапер володіє перетворенням сутності в DTO.
- **Indirection.** Порти виступають проміжним рівнем між доменом та інфраструктурою.

## Наслідки

- Юніт-тести підставляють фейки через порти без реальних Prisma/HTTP.
- Зміна ORM чи транспорту не зачіпає доменні сервіси.
- Поведінка застосунку не змінилась; наявні тести лишаються зеленими.
