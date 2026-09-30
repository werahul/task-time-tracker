# Task & Time Tracker

A small productivity app: write down tasks, run a timer while you work on them, and see where the time went each day and week.

**Live:** https://task-time-tracker-nk77.vercel.app — register an account, it takes a few seconds. The API runs on Render's free tier and sleeps when idle, so the first request after a quiet spell can take up to a minute.

![Dashboard with the daily summary and weekly analytics](docs/screenshots/dashboard.png)

It's a Next.js frontend talking to an Express + PostgreSQL API, in one npm-workspaces repo. The feature list is deliberately short. Most of the effort went into the parts that are easy to get subtly wrong in a time tracker: a timer that stays correct across tabs, reloads and devices; exactly one running timer per user, even under concurrent requests; sessions that cross midnight or a DST change; and making sure one user can never see another's data.

If you're reviewing this, [docs/EVALUATION.md](docs/EVALUATION.md) is a five-minute guided tour and [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) is the deployment runbook.

## What it does

- Accounts with email and password. Sessions live in HttpOnly cookies.
- Tasks move `PENDING → IN_PROGRESS → COMPLETED` (and can be reopened), with filtering by status and pagination.
- An optional AI helper turns a rough note ("need to finish login stuff and test it") into a clean title and description. It only fills in the form; you still review and save the task yourself.
- One timer at a time. Starting a timer on a pending task moves it to in progress, and completing a task stops its timer.
- A daily summary for any past day: time tracked, tasks worked on, completions, top tasks and a couple of plain-language insights.
- A weekly view (Monday to Sunday) with a per-day chart and table, a daily average, and each task's share of the week. The selected week is in the URL (`?week=`), so it can be linked to.

The UI is dark with an orange accent, uses a sidebar on desktop and a drawer on phones, and respects `prefers-reduced-motion`.

| Tasks                                    | Running timer                                               | Phone                                                      |
| ---------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------- |
| ![Task list](docs/screenshots/tasks.png) | ![Task with running timer](docs/screenshots/task-timer.png) | ![Mobile dashboard](docs/screenshots/mobile-dashboard.png) |

## Running it locally

You need Node.js 20+ (22 recommended), npm 10+ and PostgreSQL 14+.

```bash
git clone <repository-url> task-time-tracker && cd task-time-tracker
npm install                                   # also generates the Prisma client and builds packages/shared

cp apps/api/.env.example apps/api/.env        # set DATABASE_URL and ACCESS_TOKEN_SECRET
cp apps/web/.env.example apps/web/.env.local
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"   # a good ACCESS_TOKEN_SECRET

psql -U postgres -c "CREATE DATABASE task_time_tracker;"
npm run db:deploy                             # apply migrations
npm run db:seed                               # optional: demo@example.com / demo-password-123

npm run dev                                   # web on :3000, API on :5000
```

Swagger UI is at http://localhost:5000/api/v1/docs.

| Command                             | What it does                                                         |
| ----------------------------------- | -------------------------------------------------------------------- |
| `npm run verify`                    | typecheck, lint, format check, all tests, production build (as CI)   |
| `npm test`                          | API tests; `test:unit`, `test:api`, `test:authorization` for subsets |
| `npm run build` / `npm start`       | build shared → api → web / run both builds                           |
| `npm run db:migrate`                | author a migration after editing `schema.prisma`                     |
| `npm run db:deploy`                 | apply committed migrations (local setup, CI, production)             |
| `npm run db:seed` / `db:seed:reset` | create the demo user if missing / rebuild its data (dev only)        |

`packages/shared` compiles to `dist/`. It's rebuilt by `install`, `dev`, `build`, `typecheck` and `test`. If you change it while `npm run dev` is running, run `npm run build:shared`.

AI is off unless you configure it. Setting `AI_PROVIDER=gemini` with a key from [Google AI Studio](https://aistudio.google.com/apikey) works on Gemini's free tier, no billing needed. `AI_PROVIDER=anthropic` uses Claude instead.

## How it's put together

```text
apps/web            Next.js 16 · React 19 · Tailwind v4 · shadcn/ui (Base UI) · TanStack Query · RHF + Zod
   │  JSON over HTTPS, HttpOnly cookies
   ▼
apps/api            Express 5 · Zod · Prisma 6 · Argon2id · JWT · pino
   │                modules: auth · tasks (+ ai) · time-tracking · dashboard
   ▼
PostgreSQL          constraints and indexes that the app relies on, not just the ORM

packages/shared     Zod request schemas, response types and formatters used by both apps
```

Every API module has the same shape: `routes → controller → service → repository`. Controllers never touch the database, services don't import Prisma, `userId` always comes from the verified session (never from the request), and repositories never fetch a task or log by id alone. `tests/unit/architecture.test.ts` fails the build if any of those rules is broken, so they don't erode over time.

On the frontend, the TanStack Query cache is the only client-side copy of server state. Mutations invalidate what they affect, and the UI doesn't recompute numbers the API already computed.

```text
task-time-tracker/
├── apps/web/            app/ (routes), features/{auth,tasks,time-tracking,dashboard}, components/, lib/api/
├── apps/api/            prisma/ (schema, migrations, seed), src/modules/, src/{config,lib,middleware,routes,docs}/, tests/
├── packages/shared/
├── scripts/smoke-test.sh
└── docs/                DEPLOYMENT.md, EVALUATION.md, screenshots/
```

## The decisions that matter

### The server owns the timer

Client clocks drift, sleep and can be changed, so the browser never decides how long anything took. Start and stop take no body. The server records `startedAt` and `stoppedAt` and computes the duration. `GET /time-logs/active` returns the elapsed time the server calculated, and the client anchors to it and renders `now − anchor` once a second. That means a reload, a sleeping laptop or a second tab all show the same number. The client also refetches on focus, on reconnect and every 60 seconds, which is enough to pick up a timer stopped on another device without adding WebSockets.

"One running timer per user" is a partial unique index (`("userId") WHERE "stoppedAt" IS NULL`), not an `if` in the service. When two start requests race, the database rejects the second (it becomes a 409) and its transaction rolls back. Stop is a conditional update, so two concurrent stops can't both succeed.

### The database enforces the invariants

```text
User 1──N Task 1──N TimeLog        User 1──N Session
```

| Rule                                   | How it's enforced                                                 |
| -------------------------------------- | ----------------------------------------------------------------- |
| At most one running timer per user     | partial unique index                                              |
| A time log belongs to its task's owner | composite FK `("taskId","userId") → Task("id","userId")`          |
| Durations are consistent               | `CHECK`s: `>= 0`, `stoppedAt >= startedAt`, duration = timestamps |
| `completedAt` is set iff `COMPLETED`   | `CHECK (("status" = 'COMPLETED') = ("completedAt" IS NOT NULL))`  |

Prisma can't express partial indexes or CHECK constraints, so they're hand-written SQL inside the versioned migrations. CI replays every migration into an empty database and fails if the result drifts from `schema.prisma`. All timestamps are `timestamptz`, deletes cascade from user to tasks to logs, and the indexes match the queries the app actually runs.

### Analytics are computed in SQL

A day is a half-open range `[start, end)` in the viewer's IANA timezone, calculated by PostgreSQL, so DST days come out as 23 or 25 hours rather than being off by one. Sessions that cross midnight are split between the two days, and a running timer counts up to "now". The weekly view is seven of those day windows (`generate_series`): the total is their sum, and the average divides by the days elapsed so far. Completions count by `completedAt`, so last week's numbers don't change if you reopen a task today. The browser gets back a small JSON summary instead of every log.

### Auth stays out of JavaScript

Passwords are hashed with Argon2id. Login responds identically, with equal timing, to an unknown email and a wrong password. A session is a 15-minute access JWT plus an opaque refresh token. Both are HttpOnly cookies, `Secure` in production and `SameSite=Lax`, and the refresh cookie is scoped to `/api/v1/auth`. Only a SHA-256 hash of the refresh token is stored. It rotates on every use inside one transaction, so a replayed token can't mint a second session. When the access cookie expires, the client refreshes quietly and retries.

Every query includes the owner's `userId` in its `WHERE` clause. Asking for someone else's task returns the same 404 as a task that doesn't exist, and the authorization test suite checks every task-scoped endpoint in both directions (user A → user B, and B → A).

State-changing requests from an `Origin` outside `FRONTEND_URL` are rejected. CORS is an exact allow-list and bodies must be JSON. On top of that there are request size limits, per-IP rate limits (plus a per-user limit on AI), helmet headers, and error responses that never contain Prisma or SQL text. The API refuses to start with a missing, weak or placeholder secret, or with `http://` origins in production.

In production the web app (Vercel) and the API (Render) sit on different sites, and browsers increasingly block third-party cookies. So the Next.js app proxies `/api/v1` to the API, which keeps the cookies first-party instead of depending on `SameSite=None`.

### AI can only suggest

`POST /tasks/suggest` takes a note and returns `{ title, description }`. It never reads or writes data; `POST /tasks` is still the only way to create a task. The provider sits behind a small interface whose output is treated as untrusted: the service applies a hard timeout, validates the result against the same rules as task creation, strips it to two fields and logs without content. Only the note itself is sent, clearly delimited, and the model has no tools. Gemini and Anthropic adapters share that path, so switching providers is a config change. With no provider configured the endpoint returns 503 `AI_CONFIGURATION_ERROR`, the form says so, and everything else keeps working.

## API

Base path `/api/v1`. The OpenAPI document is generated from the same Zod schemas that validate requests, and a contract test checks real responses against it. Swagger UI is on by default in development and off in production.

| Area      | Endpoints                                                                                                                              |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Auth      | `POST /auth/register` · `POST /auth/login` · `POST /auth/logout` · `POST /auth/refresh` · `GET /auth/me`                               |
| Tasks     | `GET /tasks` · `POST /tasks` · `GET /tasks/:id` · `PATCH /tasks/:id` · `DELETE /tasks/:id` · `POST /tasks/suggest`                     |
| Time      | `POST /tasks/:id/timer/start` · `POST /tasks/:id/timer/stop` · `GET /tasks/:id/time-logs` · `GET /time-logs` · `GET /time-logs/active` |
| Dashboard | `GET /dashboard/daily-summary?date=&timezone=` · `GET /dashboard/weekly-summary?startDate=&timezone=`                                  |
| Health    | `GET /health` (liveness) · `GET /health/ready` (database reachable, not shutting down)                                                 |

Responses are `{ "success": true, "data": … }` or `{ "success": false, "error": { "code", "message", "details"?, "requestId"? } }`, and every response carries `X-Request-ID`, so an error in the UI can be traced to a log line. Lists take `?page=&limit=` and return `{ items, pagination }`. Error codes are stable (for example `ACTIVE_TIMER_EXISTS` → 409) and all of them are listed in the OpenAPI document.

## Configuration

The API validates its environment at startup and exits on anything missing or invalid, naming the variable without printing its value. Everything is documented in [`.env.example`](.env.example). These are the ones you're likely to touch:

| Variable                                  | Default                        | Notes                                                                                            |
| ----------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`                            | required                       | PostgreSQL connection string                                                                     |
| `ACCESS_TOKEN_SECRET`                     | required                       | ≥ 32 characters (≥ 64 in production); placeholders are rejected                                  |
| `FRONTEND_URL`                            | `http://localhost:3000`        | exact allowed origin(s), comma-separated; `https://` in production                               |
| `TRUST_PROXY`                             | `0` (prod `1`)                 | proxy hops in front of the API; `2` behind the web proxy                                         |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL` | unset                          | `gemini` or `anthropic`; model defaults to `gemini-3.5-flash-lite` / `claude-opus-5`             |
| `API_DOCS_ENABLED`                        | `true` (prod `false`)          | Swagger UI and `openapi.json`                                                                    |
| `DEMO_USER_EMAIL` / `DEMO_USER_PASSWORD`  | `demo@example.com` / dev only  | used by the seed; the password is required in production                                         |
| `NEXT_PUBLIC_API_URL` (web)               | `http://localhost:5000/api/v1` | build-time; an absolute `https://` URL or `/api/v1` when proxying. Invalid values fail the build |
| `API_PROXY_URL` (web)                     | unset                          | the API origin that `/api/v1` is proxied to                                                      |

Token lifetimes, rate limits, timeouts, `APP_TIMEZONE`, `COOKIE_SAME_SITE` and `LOG_LEVEL` have sensible defaults; see `.env.example`. Nothing secret is prefixed `NEXT_PUBLIC_`.

Migrations are versioned and committed. Use `db:migrate` to write one and `db:deploy` (`prisma migrate deploy`) to apply them anywhere else; `prisma db push` is never used. The seed only touches the demo user and changes nothing if that user already exists, and `db:seed:reset` refuses to run in production. `npm run db:cleanup-sessions -w apps/api` deletes expired sessions and is worth scheduling daily.

## Tests

```bash
psql -U postgres -c "CREATE DATABASE task_time_tracker_test;"
cp apps/api/.env.test.example apps/api/.env.test   # the database name must end in _test
npm test
```

The tests run against a real PostgreSQL database, not mocks. The setup refuses any database whose name doesn't end in `_test`, and it truncates tables between cases.

- `tests/unit`: environment validation (including production fail-fast), cookie flags, the rate limiter, graceful shutdown, AI adapter parsing and errors, and the architecture rules.
- `tests/api`: auth (rotation, reuse, CSRF/CORS), tasks, timers (races and constraints), both dashboards (midnight, timezones, DST, completions), the AI endpoint (timeouts, malformed output, prompt injection), platform concerns, and the OpenAPI contract.
- `tests/authorization`: every task-scoped endpoint, A → B and B → A, plus checks that lists and aggregates contain only the caller's rows.

I mutation-checked the important guarantees: removing the `userId` scoping, the AI output validation or the race handling makes tests fail.

CI (`.github/workflows/ci.yml`) runs on every PR and every push to `main`: install, check that migrations match the schema, typecheck, lint, format, unit tests, integration tests against a PostgreSQL service, and build.

`scripts/smoke-test.sh <api-url> <frontend-origin>` runs sign-up → task → timer → dashboard → logout against a live deployment over plain HTTP with a cookie jar (23 checks).

## Deployment

Production is Vercel for `apps/web`, Render for the API (a long-running Node service) and Neon for PostgreSQL. Only `main` deploys, and CI runs on every push to it. The full runbook, including running the API on Vercel as a serverless function instead, is in [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). The short version:

1. Create a Neon database. Give the API the **direct** connection string: Prisma's migration lock doesn't work through Neon's pooler.
2. Render build command: `npm ci --include=dev && npm run build:shared && npm run build -w apps/api`. Start command: `npm run start:migrate -w apps/api` (applies migrations, then starts). Health check: `/api/v1/health/ready`.
3. Vercel root directory: `apps/web`. Set `NEXT_PUBLIC_API_URL=/api/v1` and `API_PROXY_URL=<Render URL>`, and set the API's `FRONTEND_URL` to the exact Vercel URL.
4. Run `scripts/smoke-test.sh` against it.

`/health` reports the deployed commit, which makes it easy to confirm what's actually live.

## Known limitations and what I'd do next

- Access tokens can outlive logout by up to 15 minutes. Next steps: revoke all of a user's sessions when refresh-token reuse is detected, and optionally check the session on each request.
- Rate limits are in memory, which is fine for one instance. A second instance would need a shared store such as Redis.
- The CSP ships in report-only mode. An enforcing CSP with per-request nonces is the next step.
- Two concurrent status changes to the same task can both pass the transition check, because rows aren't locked. For single-user data I accepted that.
- A session split across midnight can lose up to one second in total, because each day's portion is rounded down.
- Registration reveals whether an email is already taken (409); login doesn't.
- The Gemini path is verified in production on the free tier; the Anthropic adapter has only run against a mocked provider. Free-tier capacity varies, so a suggestion can occasionally take several seconds, or fail with a "try again" message.
- Browser QA is a local headless-Chromium script, run against production builds at phone, tablet and desktop widths. It hasn't been tested in Safari or on physical devices, and it should become Playwright tests in CI.
- `npm audit` flags `deepmerge-ts`, a dependency of the Prisma CLI's config loader. It only ever merges this repo's own `prisma.config.ts`, never request data, and no Prisma 6 or 7 release ships a fix yet.
- Also on the list: idle-timer detection (a nudge after hours without activity), status history for historical workload figures, and cursor pagination for long histories.
