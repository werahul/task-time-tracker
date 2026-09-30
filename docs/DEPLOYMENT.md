# Deployment runbook

Production is three pieces: a **Next.js** frontend, the **Express API**, and **managed PostgreSQL** (plus an optional AI provider). They deploy separately; CI gates what reaches `main`.

```text
Browser ──HTTPS──► Next.js host ──HTTPS──► Express API ──► PostgreSQL
                                                 └──────► AI provider (optional)
```

Any Next.js host and any Node.js host work. The worked example uses **Vercel** (web), **Render** (API) and **Neon** (PostgreSQL); the setting names below are theirs, and the commands and values are this repository's.

## 1. Choose a topology

Auth uses HttpOnly cookies, so the browser must treat the API's cookies as **first-party**. Pick one of these:

| Topology                                                                                         | Browser calls                           | Settings                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **A. Same site** (custom domains `app.example.com` + `api.example.com`)                          | the API directly (CORS)                 | `NEXT_PUBLIC_API_URL=https://api.example.com/api/v1`, `COOKIE_SAME_SITE=lax`, `TRUST_PROXY=1`                            |
| **B. Different sites** (e.g. `tracker.vercel.app` + `tracker-api.onrender.com`), **recommended** | the web origin, which proxies `/api/v1` | `NEXT_PUBLIC_API_URL=/api/v1`, `API_PROXY_URL=https://tracker-api.onrender.com`, `COOKIE_SAME_SITE=lax`, `TRUST_PROXY=2` |

In both, `FRONTEND_URL` is the exact web origin (e.g. `https://tracker.vercel.app`).

Why B exists: across different sites the API's cookies are third-party, and Safari (and increasingly other browsers) blocks them even with `SameSite=None; Secure`. With `API_PROXY_URL`, Next.js forwards `/api/v1/*` to the API server-side. The browser sees one origin, cookies are first-party, and `SameSite=Lax` works. `COOKIE_SAME_SITE=none` remains available but is not recommended.

`TRUST_PROXY` is the number of proxies in front of the API, used to find the client IP for rate limiting. In B there is one more hop (the web host). After deploying, confirm that the API's `request completed` log lines and rate limiting reflect real client IPs, and adjust if your hosts add different hops.

## 2. Database (Neon or any managed PostgreSQL 14+)

1. Create a database and copy its connection string, with TLS (`?sslmode=require`), as `DATABASE_URL`.
2. Schema changes reach production only through committed migrations:

   ```text
   schema.prisma change → npm run db:migrate (dev) → migration committed → CI → merge → npm run db:deploy (release)
   ```

   `prisma migrate deploy` applies pending migrations and nothing else: it never resets, drops or runs `db push`. Migrations are forward-only, so keep them backward compatible (add, backfill, then remove in a later release) so the previous API version keeps working while a release rolls out.

## 3. API (Render web service)

| Setting            | Value                                                         |
| ------------------ | ------------------------------------------------------------- |
| Root directory     | repository root                                               |
| Build command      | `npm ci && npm run build:shared && npm run build -w apps/api` |
| Pre-deploy command | `npm run db:deploy`                                           |
| Start command      | `npm start -w apps/api`                                       |
| Health check path  | `/api/v1/health/ready`                                        |
| Node version       | 22 (`engines` requires ≥ 20)                                  |
| Auto-deploy        | after CI checks pass (see [CI gate](#6-ci-gate))              |

Order per release: install → build → **migrate** → start. If your plan has no pre-deploy step, use `npm run start:migrate -w apps/api` as the start command: it runs `prisma migrate deploy` and then starts the server, and it won't start if migrating fails. `prisma` is a runtime dependency, so this works with production-only installs.

**Environment** (the platform's secret store; never committed):

| Variable                                               | Value                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                             | `production`                                                                                            |
| `PORT`                                                 | provided by the platform (or `5000`)                                                                    |
| `DATABASE_URL`                                         | from step 2                                                                                             |
| `ACCESS_TOKEN_SECRET`                                  | a new 64+ char secret: `node -e "console.log(require('crypto').randomBytes(64).toString('base64url'))"` |
| `ACCESS_TOKEN_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` | `15m` / `7d`                                                                                            |
| `FRONTEND_URL`                                         | exact web origin, `https://…` (comma-separate extra origins)                                            |
| `COOKIE_SAME_SITE`                                     | `lax`                                                                                                   |
| `TRUST_PROXY`                                          | `1` (topology A) or `2` (topology B)                                                                    |
| `AI_PROVIDER` / `AI_API_KEY` / `AI_MODEL`              | `anthropic` / key / model, or leave `AI_PROVIDER` empty to disable AI                                   |

The API refuses to start with an `http://` `FRONTEND_URL`, a secret under 64 characters or equal to an example value, `SameSite=None` outside production, or an AI provider without a key. API docs are off in production unless `API_DOCS_ENABLED=true`.

**Health checks:** `GET /api/v1/health` is liveness (process up, no dependencies). `GET /api/v1/health/ready` runs `SELECT 1` against PostgreSQL within 2 s and returns 503 if the database is unreachable or the server is shutting down. Neither exposes hosts, credentials or error text. On shutdown (SIGTERM) the API fails readiness, drains in-flight requests for up to `SHUTDOWN_TIMEOUT_MS`, then exits.

**Scheduled job:** run `npm run db:cleanup-sessions -w apps/api` daily (e.g. a Render cron job with the same `DATABASE_URL`).

## 4. Web (Vercel project)

| Setting        | Value                                                                  |
| -------------- | ---------------------------------------------------------------------- |
| Root directory | `apps/web` (npm workspace; installs from the repository root)          |
| Framework      | Next.js                                                                |
| Build command  | `npm run build:shared --prefix ../.. && next build`                    |
| Environment    | `NEXT_PUBLIC_API_URL` and, for topology B, `API_PROXY_URL` (section 1) |

Both variables are read **at build time**, so redeploy after changing them. The build fails fast on an unusable `NEXT_PUBLIC_API_URL` (not `https://`, a `/` path, or `http://localhost`). No secret belongs in the web project: the browser bundle contains no server variables.

Preview deployments get their own origins. Add them to `FRONTEND_URL` if they should be able to sign in; otherwise the API rejects their state-changing requests (403 `FORBIDDEN_ORIGIN`).

## 5. Demo account (optional)

Evaluators can simply register. To provide a pre-filled account, seed it once from a trusted machine:

```bash
DATABASE_URL="<production url>" NODE_ENV=production \
DEMO_USER_EMAIL=demo@example.com DEMO_USER_PASSWORD="<generated password>" \
npm run db:seed
```

The seed only creates the demo user if it doesn't exist and never overwrites or deletes data in production (`db:seed:reset` is refused there). Share the password separately, never in the repository.

## 6. CI gate

Validation and deployment are separate:

```text
Pull request → CI (drift check, typecheck, lint, format, unit, integration, build) → merge to main → hosts deploy main
```

- `.github/workflows/ci.yml` only validates; it holds no deployment secrets.
- In GitHub → Settings → Branches, protect `main`: require a pull request and require the **CI / verify** status check to pass.
- On the API host, deploy only after checks pass (Render: _Auto-Deploy → After CI Checks Pass_). Vercel builds every push; with `main` protected, only CI-green code reaches production.

## 7. Verify the deployment

1. **Health:** `curl https://<api>/api/v1/health` and `…/health/ready` both return `"success": true`.
2. **Smoke test** (creates one throwaway `e2e.*@example.com` user):

   ```bash
   # Topology B: go through the web origin so the proxy is tested too
   scripts/smoke-test.sh https://tracker.vercel.app/api/v1 https://tracker.vercel.app
   # Topology A
   scripts/smoke-test.sh https://api.example.com/api/v1 https://app.example.com
   ```

   It checks: register → cookie flags → logout → login → `/auth/me` → create task → start timer → second start rejected → active timer restored → stop → daily and weekly dashboards → refresh rotation → foreign `Origin` rejected → sanitized errors → logout → protected endpoint and old refresh token rejected.

3. **In a real browser** (Chrome and Safari, desktop and phone):
   - Register → land on the dashboard → DevTools → Application → Cookies: `access_token` and `refresh_token` are `HttpOnly`, `Secure`, `SameSite=Lax`, on the expected domain; `refresh_token` has `Path=/api/v1/auth`; nothing in Local/Session Storage.
   - Create a task → start its timer → **reload** → the timer is still running with the right elapsed time → navigate between pages → stop it → the dashboard total updates.
   - Sign out → the back button or `/dashboard` sends you to sign-in.
   - Wait 15+ minutes (the access token expires), then act: the session refreshes silently.

## 8. Rollback

Redeploy the previous build on each host. Migrations are not rolled back automatically; because they are backward compatible (section 2), the previous API version runs against the newer schema. If a migration itself is wrong, fix it forward with a new migration.

## Pre-launch checklist

- [ ] Secrets only in the platform secret stores; `git ls-files | grep -i '\.env'` lists only `*.example` templates.
- [ ] `ACCESS_TOKEN_SECRET` freshly generated for production (not reused from any other environment).
- [ ] `FRONTEND_URL` is exactly the production web origin; `NEXT_PUBLIC_API_URL` matches the chosen topology.
- [ ] `npm run db:deploy` succeeded; `npm run db:status -w apps/api` reports the schema up to date.
- [ ] `/health/ready` is the platform health check.
- [ ] Smoke test passes; browser checklist done.
- [ ] `main` protected by the CI check; API auto-deploys after checks pass.
- [ ] Session cleanup scheduled.
- [ ] README [Live Demo](../README.md#live-demo) updated.
