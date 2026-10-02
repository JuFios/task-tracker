# Task Tracker

Повноцінний Task Tracker для команд: NestJS API, React Kanban-дошка з drag-and-drop, PostgreSQL, realtime-оновлення та Docker Compose.

## Технологічний стек

| Шар            | Технології                                                                                                                                                                                                      |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frontend       | React 19, Vite 6, Tailwind CSS v4, TanStack Query v5, zustand (persist), react-router-dom v7, react-hook-form + zod, **@dnd-kit/core + sortable**, socket.io-client, axios (interceptors), sonner, lucide-react |
| Backend        | NestJS 11, Prisma 6, PostgreSQL 16, Socket.IO gateway, JWT (access + refresh rotation), bcrypt, Helmet, @nestjs/throttler, class-validator, Swagger                                                             |
| Інфраструктура | Docker Compose (db → migrate → api → web), GitHub Actions CI, nginx                                                                                                                                             |

## Запуск через Docker

Потрібен лише Docker Desktop.

```bash
docker compose up --build
```

Конфігурація має безпечні для локальної розробки значення за замовчуванням. Щоб змінити їх, скопіюйте `.env.example` у `.env` перед запуском.

Після збірки:

- UI: http://localhost:5173
- API та Swagger: http://localhost:3000/api/docs
- Healthcheck: http://localhost:3000/api/health

Зупинити: `docker compose down`. Для повного скидання локальної БД: `docker compose down -v`.

## Запуск без Docker

Потрібні Node 20+ і PostgreSQL (локально або в Docker: `docker compose up -d db`).

```bash
cp .env.example .env             # Для Docker Compose
cp .env.example apps/api/.env    # Для локального запуску NestJS та Prisma
npm install
npm run db:generate    # prisma generate
npm run db:migrate     # prisma migrate dev
npm run dev            # api :3000 + web :5173
```

## Архітектура

Монорепозиторій (npm workspaces): `apps/api` (NestJS) і `apps/web` (React/Vite).

**Backend.** API розділено на модулі `auth`, `users`, `workspaces`, `projects`, `tasks` (+ comments та status history всередині tasks); кожен контролер делегує роботу сервісу, Prisma — єдиний шар доступу до даних. DTO з `class-validator` і forbidNonWhitelisted формують контракт на вході; глобальний exception filter повертає узгоджену форму помилок. Глобальний префікс `/api`, Swagger на `/api/docs`, healthcheck `/api/health` (перевіряє й БД).

**Обрано PostgreSQL + Prisma.** Для трекера задач природні транзакційні зв'язки: учасник робочого простору, проєкт, задача, коментар, журнал статусів. Складені індекси під фільтри (`projectId/status`, `projectId/priority`), індекси виконавця та журналу. Перестановку задач у колонці виконано атомарно в транзакції з `pg_advisory_xact_lock` для серіалізації конкурентних операцій.

**Frontend.** Feature-based структура (`features/board`, `features/auth`, …), спільні `components/ui`, `lib` (axios-клієнт з interceptor'ом тихої ротації токенів). Серверний стан — TanStack Query (кеш, інвалідація за доменами), клієнтський стан авторизації — zustand з persist. Форми — react-hook-form + zod-схеми.

## Ключові рішення

- **JWT access (15 хв) + refresh (7 днів) з ротацією.** У БД зберігається sha256-хеш поточного refresh-токена (не JWT), тому logout і ротація відкликають стару сесію. axios interceptor на 401 робить один спільний `POST /auth/refresh` і повторює оригінальний запит; одночасні запити дедупліковано через in-flight promise. Синхронізація між вкладками через BroadcastChannel. При конкурентному refresh другий запит отримує 401, а BroadcastChannel доставляє новий токен від першого.
- **Авторизація на рівні сервісів.** Перевірки «член workspace / owner workspace / автор коментаря» живуть у сервісах, а не в контролерах; приватні HTTP-маршрути за guard'ом, Socket.IO з'єднання перевіряє той самий JWT.
- **Realtime.** Gateway транслює `task.created`, `task.updated`, `task.deleted`, `comment.created`, `comment.deleted` у кімнату проєкту; фронт інвалідує відповідні query. Socket реконектується з новим токеном після refresh (10 спроб). На помилку підключення автоматично виконується спроба оновлення токена.
- **Kanban на @dnd-kit.** Серверні дані — джерело істини; локальний стан колонок розходиться з ним лише під час перетягування (optimistic cross-column preview у `onDragOver`, commit у `onDragEnd` через `PATCH /tasks/:id/move`). Після відповіді кеш синхронізується з сервером, при помилці — відкат і toast. При активних фільтрах drag-and-drop вимикається. Зміна статусу через `PATCH /tasks/:id` теж проходить через той самий механізм позицій, що й move.
- **Пагінація та фільтри.** Offset-пагінація з метаданими (`page`, `limit`, `total`, `totalPages`); фільтри за статусом, пріоритетом, виконавцем, пошуком **за title** (case-insensitive, не по description).
- **Обробка помилок.** Prisma помилки (P2025, P2002, P2003, P2024) мапляться на відповідні HTTP статуси (404, 409, 400, 503). 4xx запити логуються як warnings (і в exception filter, і в logging interceptor).
- **Безпека.** Rate limiting: загальний ліміт 300 запитів/хв, для `/auth/login|register` — 10 спроб/хв (для `/auth/refresh` — 30 спроб/хв). `trust proxy 1` для коректного IP за nginx. Валідація пароля: мінімум 8 символів, літера + цифра, max 72 байт (bcrypt обмеження). assigneeId, якого немає у workspace, повертає 400, а не 403.

## Можливості

- Реєстрація, вхід, вихід, тихе оновлення access-токена, захищені маршрути фронту.
- Workspaces з ролями Owner/Member: створення, запрошення зареєстрованого користувача за email, керування складом, видалення workspace (лише Owner), передача власності, вихід з workspace.
- Проєкти в workspace: CRUD; **редагування та видалення — лише Owner workspace**.
- Задачі: CRUD, три статуси (TODO / IN_PROGRESS / DONE), пріоритет (LOW / MEDIUM / HIGH / URGENT), виконавець зі списку учасників, дедлайн з підсвіткою прострочених, фільтри + пошук по title.
- Drag-and-drop між колонками та в межах колонки з атомарною перенумерацією позицій на бекенді (`pg_advisory_xact_lock` на рівні проєкту).
- Коментарі з CRUD (редагування/видалення — автор коментаря), лічильник на картці задачі.
- Історія зміни статусу: «Moved from To do to In progress — UserName · Oct 1, 01:25 PM».
- Детальний перегляд задачі в модалці: опис, метадані, коментарі, історія статусів.
- Error Boundary на рівні React-дерева, error state на дошці («Failed to load tasks» з кнопкою Retry).
- Loading / empty / error стани на всіх екранах, optimistic updates з відкатом.

## Безпека

DTO whitelist (`forbidNonWhitelisted`), параметризовані Prisma-запити (без SQL-конкатенації), Helmet, rate limiting (300 запитів/хв; 10 спроб/хв для login/register, 30 для refresh), bcrypt (12 rounds, пароль обмежений 72 байтами), CORS через `WEB_ORIGIN`, перевірки прав у сервісах, access-токен у заголовку Authorization, refresh-токен (sha256-хеш, не JWT) передається в тілі запиту. React виводить текст за замовчуванням — введений HTML не виконується.

## Тести

```bash
npm test        # unit: TasksService (list, create, update, move, comments)
npm run test:e2e  # критичний флоу: реєстрація → workspace → project → task → WebSocket
```

Для e2e-тестів потрібна тестова БД. Створіть її вручну:

```bash
createdb task_tracker_test
```

Потім виконайте міграції для тестової БД:

```bash
DATABASE_URL="postgresql://task_tracker:task_tracker_dev_password@localhost:5433/task_tracker_test" npx prisma migrate deploy --schema apps/api/prisma/schema.prisma
```

Або налаштуйте `DATABASE_URL` у `apps/api/.env` на існуючу БД з іменем, що містить `task_tracker_test` (захист від випадкового запуску на production). CI запускає тести на окремому Postgres-сервісі.

> **Захист:** тести роблять `TRUNCATE` перед запуском. `setup-env.ts` перевіряє, що `DATABASE_URL` містить `task_tracker_test` при `NODE_ENV=test`, і викидає помилку, якщо це не так.

## API (основне)

| Група      | Маршрути                                                                                                                                                                                                                                               |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Auth       | `POST /api/auth/register` · `/login` · `/refresh` · `/logout`                                                                                                                                                                                          |
| Workspaces | `GET/POST /api/workspaces` · `GET/PATCH/DELETE /api/workspaces/:id` · `POST/GET /api/workspaces/:id/members` · `PATCH/DELETE /api/workspaces/:id/members/:memberId` · `POST /api/workspaces/:id/transfer-ownership` · `POST /api/workspaces/:id/leave` |
| Projects   | `GET/POST /api/workspaces/:workspaceId/projects` · `GET/PATCH/DELETE /api/projects/:id`                                                                                                                                                                |
| Tasks      | `GET/POST /api/projects/:projectId/tasks` · `GET/PATCH/DELETE /api/tasks/:id` · `PATCH /api/tasks/:id/move`                                                                                                                                            |
| Comments   | `POST /api/tasks/:id/comments` · `PATCH/DELETE /api/tasks/:taskId/comments/:commentId`                                                                                                                                                                 |
| Users      | `GET /api/users/me`                                                                                                                                                                                                                                    |
| Health     | `GET /api/health`                                                                                                                                                                                                                                      |

Повний контракт з прикладами — у Swagger на `/api/docs`.

## WebSocket-події

Після підключення клієнт приєднується до кімнати проєкту:

```js
socket.emit('project:join', projectId, (ack) => {
  /* ack.ok: boolean */
});
socket.emit('project:leave', projectId);
```

Сервер емітить в кімнату:

| Подія             | Коли                                      |
| ----------------- | ----------------------------------------- |
| `task.created`    | Нова задача створена                      |
| `task.updated`    | Задача змінена або переміщена             |
| `task.deleted`    | Задача видалена `{ id }`                  |
| `comment.created` | Новий коментар `{ taskId, comment }`      |
| `comment.deleted` | Коментар видалено `{ taskId, commentId }` |

## Структура репозиторію

```
apps/
  api/                 NestJS + Prisma
    prisma/            schema.prisma, міграції
    src/
      auth/ users/ workspaces/ projects/ tasks/
      prisma/          PrismaService
      common/          guards, decorators, filters, interceptors, validators
      health/          /api/health endpoint
    test/              e2e (app.e2e-spec.ts)
  web/                 React + Vite + Tailwind
    src/
      features/        board, auth, workspaces
      components/ui/   дизайн-система
      lib/ stores/ types/
docker-compose.yml
.github/workflows/ci.yml
```

## Відомі компроміси

- **Email invitations.** Запрошення доступне лише для вже зареєстрованих користувачів. Повна реалізація — email invitation link з pending membership і реєстрацією.

- **Token families / refresh reuse detection.** При виявленні повторного використання відкликається лише поточний токен (не вся сесія). Реалізація token families захищає краще, але ускладнює multi-tab сценарій.

- **Конкурентний refresh (кілька вкладок).** Перша вкладка перемагає гонку; друга отримує 401 і автоматично використовує новий токен, отриманий через BroadcastChannel від першої вкладки.

- **Socket.IO після спливу токена.** Socket реконектується автоматично; на помилку підключення виконується спроба refresh. При невдалому refresh — logout.

- **Test coverage.** Основні бізнес-правила задач покриті unit-тестами (TasksService), критичний API flow — E2E-тестами (реєстрація → workspace → project → task lifecycle → WebSocket). AuthService не має окремих unit-тестів (покрито E2E).
