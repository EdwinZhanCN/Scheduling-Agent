# Scheduling Agent

A local, single-user scheduling assistant built with TanStack Start, React, FullCalendar and SQLite. DeepSeek interprets requests; deterministic code chooses feasible times. Every calendar change remains a proposal until the user approves it.

## Implemented workflow

- English/Chinese natural-language requests to create, move or delete events, with clarification for missing or unsupported details.
- Date, duration, earliest start, latest finish and exact-start extraction with quoted request evidence. Independent numeric guards catch omitted/mismatched supported constraints, including the S08 deadline failure.
- Availability, hard unavailable periods, event conflicts, duration and deadline checks. Soft preferences rank feasible candidates without overriding hard rules.
- Versioned preferences with ownership, effective/expiry dates, archive state and supersession. Eligibility precedes lexical ranking; applicable and excluded records are displayed separately.
- Review cards show the operation, time, resolved constraints and supporting/excluded records. Approval revalidates the latest state inside a SQLite transaction; rejection never modifies events. Repeated approval is idempotent.
- Tasks have model-generated summaries, controlled activity tags, grounded project/context labels, rubric-based complexity and todo/done status. A task can be selected as scheduling context.
- Events, tasks, preferences, proposals and conversation history survive reload and process restart. A new database starts empty.
- Day/week/month calendar views, availability settings and a mobile agent drawer. UI text is English; requests may be English or Chinese.

## Run locally

Requires Node.js >=22.19.0 and pnpm (the project declares 11.7.0).

```bash
pnpm install --frozen-lockfile
cp .env.example .env.local
# Set DEEPSEEK_API_KEY in .env.local; keep this file private.
pnpm dev
```

Open <http://127.0.0.1:3000>. The development/preview servers bind to loopback by default. This is a local workspace, without multi-user authentication.

Configuration:

| Variable             | Default                                   |
| -------------------- | ----------------------------------------- |
| `DEEPSEEK_API_KEY`   | Required for interpretation/task analysis |
| `DEEPSEEK_MODEL`     | `deepseek-flash`                          |
| `SCHEDULING_DB_PATH` | `data/scheduling.sqlite`                  |

Only server code reads these values. Do not use a `VITE_` prefix for credentials. All `.env.*` variants are ignored except the credential-free `.env.example`; databases and local test artifacts are also ignored by Git. The provider calls the [official DeepSeek endpoint](https://api-docs.deepseek.com/), uses JSON mode, validates the response and reports failures without fabricated fallback replies.

Set your timezone and availability under **Preferences & availability**, then try:

> Schedule 45 minutes of study tomorrow, not before 14:00 and finish by 17:00.

Review the resolved date, time and constraints before clicking **Approve & save**. If the agent asks for clarification, a follow-up includes the prior request by default. Explicitly revised fields replace their previous values while unchanged constraints remain in force, including after a restart. Uncheck **Include previous clarification** to start a different request. Click an event or use the saved-event list to prepare a move/delete request.

## Validation

```bash
pnpm verify
pnpm exec tsx scripts/live-acceptance.ts
```

The second command makes real API calls using **only constructed fixtures**, saves a frozen protocol/responses/report under `artifacts/live-*`, and exits unsuccessfully if an acceptance case fails. It does not change the workspace database. See [validation evidence and limits](docs/validation.md).

For the real-API browser acceptance test, start a separate empty test database/server in one terminal and run Playwright in another. Chrome must be installed:

```bash
SCHEDULING_DB_PATH=artifacts/browser-test.sqlite pnpm exec vite dev --port 3001
pnpm exec playwright test
```

Use a fresh test database for each full browser run. It verifies task analysis, preference replacement, reject/approve, move/delete, reload persistence, the deadline regression and the mobile drawer.

For the archived Fall 2026 course scenarios:

```bash
pnpm exec tsx scripts/fall-scenario-acceptance.ts
pnpm build
pnpm exec playwright test --config playwright.fall.config.ts
```

These commands use real API calls. The service replay creates separate dated databases; the browser test owns a production preview on port 3011, restarts that process and opens three browser contexts. It refuses an occupied test port. Source dates, selected course facts and synthetic assumptions are documented in the [fixed scenario protocol](docs/fall-scenarios.md). This replay is not an LMS/calendar import or submission feature. See the [commit rounds](docs/commit-rounds.md) for the restructuring and subsequent test-driven fix.

## Boundaries

The first version schedules one event on one date within the next year. Recurrence, multi-day tasks, external calendar sync, multiple users, notifications, autonomous rescheduling, training/distillation and edge deployment remain out of scope. Complex or ambiguous instructions require clarification. Numeric guards are bounded; natural-language extraction is not a formal proof of the user's entire intent. Human review of the displayed constraints remains necessary.

SQLite schema version 1 is created transactionally on first use. Back up the database with SQLite's backup API or while the application is stopped (including any WAL files). No real calendar is connected.

See [architecture](docs/architecture.md), [scope decision](.agents/decisions/2026-10-18-scheduling-mvp.md) and [AGENTS.md](AGENTS.md) before extending the application.
