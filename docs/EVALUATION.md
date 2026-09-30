# Evaluation guide

A 3–5 minute tour of the app, then the assignment requirements mapped to where each one is implemented and how it's verified.

## Demo flow (≈ 4 minutes)

Before starting: the app is running (live, or `npm run dev` + `npm run db:seed`), you're signed out, and ideally `AI_PROVIDER` is configured. With the demo seed, the dashboards already show a realistic week.

| Step | Do                                                                                                  | Point out                                                                                                    |
| ---- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1    | **Register**, or sign in as the demo user                                                           | HttpOnly cookies; nothing in `localStorage` (DevTools → Application)                                         |
| 2    | **Tasks → New task**, type _"Follow up with designer about the landing page"_ → **Improve with AI** | The suggestion only fills the form; edit the title, then **Create task**. Nothing is saved until you confirm |
| 3    | Open the task → **Start timer**                                                                     | Status moves to _In progress_; live clock; "Working on" banner on every page                                 |
| 4    | **Reload the page** (or close and reopen the browser)                                               | The timer continues from the server's start time: no drift, no reset                                         |
| 5    | Try **Start timer** on another task                                                                 | Controlled "already running" message: one running timer, enforced by the database                            |
| 6    | **Stop timer**                                                                                      | Toast with the logged duration; the session appears in the task's history and total                          |
| 7    | **Dashboard**                                                                                       | Today's tracked time, tasks worked on, completed, open workload, top task, plain-language insight            |
| 8    | Scroll to **This week** → **Previous week** → **This week**                                         | 7-day chart incl. zero days, per-day table, average/day, top tasks with % share; shareable `?week=` URL      |
| 9    | Explain the architecture (30 s)                                                                     | See below                                                                                                    |

```text
Next.js  →  REST API (/api/v1)  →  Services  →  Repositories  →  PostgreSQL
```

> "The browser only renders. The backend is the source of truth for authentication (HttpOnly rotating sessions), authorization (every query is scoped to the user), the timer (server timestamps, and one running timer guaranteed by a unique index) and analytics (aggregated in SQL, timezone-correct). AI is a side path that can only suggest."

Without an AI key, step 2 shows "AI suggestions are not available right now."; type the title yourself and carry on.

## Requirements checklist

Legend: **auto**: covered by the automated suites in CI · **e2e**: `scripts/smoke-test.sh` against production builds · **manual**: needs a person in a browser.

### Authentication

| Requirement                     | Where                                                   | Verified                                                        |
| ------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------- |
| Signup, login, logout           | `modules/auth`, `features/auth`                         | auto (`auth.*.test.ts`), e2e                                    |
| Protected routes                | `authenticate` middleware; app-shell redirect (UX only) | auto, e2e (401 after logout)                                    |
| Users can't access others' data | `userId` in every query's `WHERE`; composite FK         | auto (`tests/authorization`, both directions, incl. dashboards) |

### Task management

| Requirement                            | Where                                       | Verified                                                              |
| -------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Natural-language input + AI suggestion | `POST /tasks/suggest`, `ai-task-assist.tsx` | auto (mocked provider: success, timeout, malformed output, injection) |
| Edit suggestion before saving          | suggestion fills the normal form            | manual                                                                |
| Create, edit, delete, status changes   | `modules/tasks`; guarded transitions        | auto, e2e (create)                                                    |

### Time tracking

| Requirement                    | Where                                        | Verified                                                        |
| ------------------------------ | -------------------------------------------- | --------------------------------------------------------------- |
| Start / stop                   | `modules/time-tracking`                      | auto, e2e                                                       |
| Only one timer can run         | partial unique index + 409                   | auto (incl. forced race), e2e                                   |
| Survives refresh; logs persist | server-side `startedAt`; `/time-logs/active` | auto, e2e ("active timer restored"), manual (reload in browser) |
| Total time is accurate         | server-computed durations; CHECK constraints | auto                                                            |

### Daily summary (and weekly analytics)

| Requirement                     | Where                                 | Verified                            |
| ------------------------------- | ------------------------------------- | ----------------------------------- |
| Today's tasks, total time       | `GET /dashboard/daily-summary`        | auto (midnight, timezone, DST), e2e |
| Completed, pending, in-progress | `completedAt` + current status counts | auto                                |
| Weekly totals, chart, top tasks | `GET /dashboard/weekly-summary`       | auto (28 cases), e2e                |

### Deployment

| Requirement                           | Status                                                                                                                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Frontend / backend live, DB connected | Pending: follow [DEPLOYMENT.md](DEPLOYMENT.md), then update the README's Live Demo section                                                             |
| Auth works in production              | Verified against **production builds** locally (`NODE_ENV=production`, Secure cookies, proxy topology): smoke test 23/23. Repeat against the live URLs |
| README setup works                    | Verified: fresh database → `db:deploy` → seed → run                                                                                                    |
| CI passes                             | `npm run verify` passes locally; the workflow runs on the first push                                                                                   |

## Security checklist

| Item                                 | Evidence                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------------------- |
| No secrets committed                 | `.gitignore` ignores every `.env*` except templates; the seed reads its password from env |
| No API keys in frontend              | only `NEXT_PUBLIC_API_URL` is public; production bundle scanned: no server variables      |
| No tokens in `localStorage`          | tokens exist only in HttpOnly cookies; the fetch client uses `credentials: "include"`     |
| HttpOnly / Secure / SameSite cookies | `auth.cookies.ts`; unit-tested; checked on the wire by the smoke test                     |
| CORS restricted                      | exact `FRONTEND_URL` allow-list; `http://` origins rejected in production                 |
| Rate limiting                        | per-IP (all, login, register, refresh) and per-user (AI)                                  |
| Ownership enforced                   | SQL-level scoping, 404-not-403, authorization matrix tests                                |
| Database constraints active          | FKs, CHECKs, partial unique index in migrations; CI drift check                           |
| Sanitized production errors          | generic 500s; smoke test asserts no stack/Prisma text                                     |
| Logs don't expose secrets            | no headers, cookies, bodies or queries logged; redaction list                             |
| AI input/output validated            | Zod on input and on provider output; timeouts; strict output shape                        |
| Production config validated          | startup refuses weak secrets, placeholder values, `http://` origins                       |

## UX, responsive and accessibility review

Checked in a headless Chromium browser (Edge) against the production build, with a real cookie jar (25/25 checks):

| Area       | Verified                                                                                                                                                          |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Auth       | signed-out redirect; readable invalid-credentials message; HttpOnly cookies; nothing in web storage; logout protects pages                                        |
| Session    | a missing/expired access cookie refreshes silently (found and fixed: users were signed out after 15 idle minutes); a lost session redirects to sign-in            |
| Timer      | start toast; the clock never goes backwards on reload (found and fixed: up to −1 s); restored after a browser restart; conflict message; stop toast with duration |
| Dashboard  | 7 focusable chart bars; week navigation in the URL survives reload; no navigation into future weeks                                                               |
| Keyboard   | visible focus indicator on every tabbed element; "New task" dialog opens from the keyboard, takes focus, and closes on Esc                                        |
| Responsive | no horizontal overflow at 375, 768 and 1280 px on dashboard, tasks, task detail, time logs and settings                                                           |
| Contrast   | muted secondary text 4.74:1 on the page background (WCAG AA ≥ 4.5)                                                                                                |
| Console    | no errors and no CSP violations                                                                                                                                   |

Also in code: success toasts for every major action; inline, plain-language errors with a next step (`lib/api/errors.ts` never shows raw server text); loading, empty and error states with **Try again** on every list, detail and dashboard view; queries retry network/5xx errors once and never 4xx; loading regions use `aria-busy`, notices use `role="status"`/`role="alert"`; the chart's values are also a table.

**Still worth doing by hand:** the demo flow on a real phone and in Safari, and a screen-reader pass (NVDA/VoiceOver) over the dashboard.
