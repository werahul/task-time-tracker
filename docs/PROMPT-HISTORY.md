# Prompt History

This project was built with Claude Code as an AI pair programmer. I set the requirements for each phase, reviewed the output, ran the deployments, and decided what to keep, what to change and when something was done. This file records the prompts I used so reviewers can see how the work was directed.

The prompts are condensed and lightly edited for readability. Credentials, keys and environment values have been removed; none of them are in this repository.

## How I worked

- **One phase at a time.** Each phase had a written spec with scope and acceptance criteria. The next phase started only after the current one was reviewed.
- **Tests with every feature.** Each feature came with automated tests, and I asked for bugs to be reproduced in a test before they were fixed.
- **Verification before sign-off.** Every change was checked with typecheck, lint, the test suite, a production build and, for UI work, a real-browser pass.
- **Root causes, not patches.** When something broke, I asked for the cause first and the fix second.
- **Hands-on deployment.** I set up and deployed the hosting myself (Vercel, Render, Neon), configured the environments, and fed errors from the platforms back into the debugging loop.

## Sessions

### Phases 1–8: Foundations (earlier sessions)

The earlier phases built the core of the app: project setup, authentication, tasks, time tracking, the daily dashboard and the AI task assistant. Each phase shipped with its own tests. The prompts for those sessions aren't reproduced here.

### Phase 9: Weekly analytics

> Build weekly productivity analytics: an API endpoint and a dashboard view showing totals, a per-day breakdown, a daily average and top tasks for a selected week. Cover it with tests, including edge cases around week boundaries.

**Outcome:** a weekly summary endpoint and dashboard section, with integration tests for the date and timezone edge cases.

### Phase 10: Deployment and evaluation readiness

> Make the project deployment- and evaluation-ready: CI/CD, environment validation, deployment documentation and a short guide for reviewers.

**Outcome:**

- A CI pipeline running typecheck, lint, format, tests and build.
- A deployment runbook.
- A five-minute evaluation guide.

### Phase 11: Final review and QA

> Do a final review and QA pass across the whole app. Test the real user flows in a browser, fix anything that's broken, and polish the submission.

**Outcome:** the QA pass found and fixed three issues:

- a running timer that could display incorrectly after a page reload
- users being signed out after a period of inactivity
- completed tasks keeping a timer running

Each fix came with a regression test.

### Version control

> Initialise the git repository and make the first commit with a clear, meaningful message.

### Choosing the hosting setup

> What are the next steps, in order? Can both the frontend and the backend be deployed on Vercel? What do you suggest for a single repository?

**Outcome:** we compared the options. I deployed the API on Render, the web app on Vercel and the database on Neon.

### Post-deployment verification

> The production deployment is live. Verify everything end to end yourself.

**Outcome:** an automated smoke test against the live API (23/23 checks), plus a real-browser pass through sign-up, tasks, timer, dashboards and logout.

### AI on a free tier

> The AI suggestions need to work without any paid plan. Find a free option and make it work.

**Outcome:** a second AI provider adapter (Google Gemini, free tier) behind the existing provider interface, with unit tests for its responses and error handling.

### Debugging: failed deployment

> The Render deploy fails with this migration error [log attached]. Find the cause and fix it.

**Outcome:** the cause was the database connection type used during migrations. The fix was a configuration change plus a startup guard that explains the problem clearly if it happens again. The deployment runbook gained a troubleshooting section.

### Debugging: AI not responding in production

> AI suggestions still show "not available" in production. Find the root cause.

**Outcome:** a combination of a deployment that hadn't gone live and an AI model that had become unavailable for new accounts. Fixed, and the service now reports its deployed version and configuration state so problems like this are quicker to diagnose.

### UI redesign

> Redesign the UI: a dark theme with an orange primary colour, sidebar navigation for the dashboard, more refined buttons, and animations, transitions and gradients. Don't change any logic or features.

**Outcome:** a new visual design with a sidebar on desktop and a drawer on mobile. Verified with automated browser checks covering every flow, the dialogs, and layout at phone widths.

### Refinement and documentation

> Refine the UI so it feels more restrained and crafted. Rewrite the README in a clear, senior-engineer voice, then push the code.

**Outcome:** a quieter visual design, a rewritten README with updated screenshots, CI passing, and production re-verified in the browser (12/12 checks) after the deploy.

## Testing and debugging summary

- **API tests:** 344, running against a real PostgreSQL database. They cover:
  - authentication and session handling
  - task and timer rules, including concurrent requests
  - daily and weekly analytics across timezones and daylight-saving changes
  - AI input and output handling
  - per-user data isolation, checked in both directions
- **CI:** every push runs typecheck, lint, format check, the tests and a production build.
- **Deployment checks:** a smoke-test script exercises the whole user flow against a live deployment.
- **Browser QA:** real-browser checks of the main flows on production builds at phone and desktop widths.
- **Production debugging:** two production issues, a failed migration and the AI outage, were traced to root causes from platform logs and fixed with safeguards against recurrence.
