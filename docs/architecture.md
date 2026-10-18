# Architecture

## Boundaries and ownership

| Path                            | Responsibility                                                                            |
| ------------------------------- | ----------------------------------------------------------------------------------------- |
| `src/components/`               | Calendar, conversation, review cards, task and preference forms                           |
| `src/server/functions.ts`       | Validated TanStack Start server functions; the only browser entry to application services |
| `src/server/service.server.ts`  | Request lifecycle, clarification context, task analysis and proposal creation             |
| `src/server/provider.server.ts` | Server-only environment configuration and DeepSeek JSON interpretation                    |
| `src/server/store.server.ts`    | SQLite migration, persisted state and atomic approval/rejection                           |
| `src/domain/contracts.ts`       | Shared runtime schemas and serializable domain types                                      |
| `src/domain/planner.ts`         | Request grounding guards, deterministic time search and hard checks                       |
| `src/domain/retrieval.ts`       | Temporal eligibility and lexical ranking of preference records                            |
| `src/domain/time.ts`            | Timezone-aware instant/wall-time conversion with Temporal                                 |

Browser code imports server function stubs, never the provider, database or agent runtime. TanStack Start removes the handlers from the client bundle. Server functions validate inputs with Zod and use the framework's same-origin protection. The default server is loopback-only; public hosting/multi-user authentication is outside this version.

## Request to calendar write

1. Persist the user request and its server-established conversation turn boundaries. Include previous clarification turns only when requested. Independently cross-check explicit constraints per turn: the latest provided field replaces its old value, while omitted fields retain their previous bounds. Do not derive trusted turn boundaries by splitting user-written delimiters. Older messages without turn arrays remain readable as one original context.
2. DeepSeek extracts a typed intent, event identity and request constraints. It cannot execute operations and does not select an end time. Model/network errors become visible messages with no calendar mutation.
3. Verify quoted constraint spans and independently cross-check supported explicit numeric constraints. Missing or contradictory details require clarification.
4. Filter preferences by owner, status, effective/expiry date, supersession and target weekday, then rank lexically. Every applicable hard unavailable period is enforced, even if its lexical score is zero. Soft windows rank already-feasible slots. Conflicting soft windows require clarification when the request asks to use those preferences.
5. Search in five-minute increments from the allowed lower bound (preserving an explicitly requested minute). Check working days/window, overlap, duration, earliest start, latest finish, exact start and current time. Reject ambiguous/nonexistent DST wall times.
6. Save a pending proposal with its constraints, evidence, target event version and settings/preference revision. The calendar can display a draft without creating an event.
7. Approval accepts only a stored proposal ID, not client-supplied event fields. In an immediate SQLite transaction, re-read the target event and context, repeat hard checks and commit once. Competing proposals, changed events, changed rules or elapsed times invalidate the old proposal. Rejection updates only proposal status.

For preference questions, the server returns current applicable and excluded records directly. It does not ask the model to invent a preference answer. Task metadata uses controlled activity tags, grounded project/context labels, exact evidence quotes for work stages, and a deterministic complexity rubric: one known stage is low, two medium, three distinct stages or an explicit unresolved external dependency high; missing/unverifiable scope is unknown. Already supplied materials do not count as unresolved dependencies.

## Persistence

`better-sqlite3` owns the schema-version-1 migration and all writes. Tables store validated domain records as JSON, indexed by immutable IDs; messages have an increasing sequence. Settings include a revision incremented whenever availability or preferences change. WAL mode, a busy timeout and immediate approval transactions protect against competing writes. A separate server-only connection is opened lazily.

Instants are stored in UTC with an explicit calendar timezone. FullCalendar receives wall times projected into that named zone, so the displayed schedule does not depend on the browser's system timezone. A future timezone change invalidates pending proposals. Existing confirmed instants remain unchanged.

Drizzle and pi Agent remain installed from the scaffold but are not the runtime data-access/model execution path. A constrained language client is sufficient here; adding autonomous write tools would violate the review boundary.

## Verification

`pnpm verify` covers formatting, lint, types, deterministic tests and production compilation. Domain tests include the archived S08 failure and a new 30-case duration/deadline grid. Store/service tests cover write authorization, stale approvals, idempotency, persistence and provider failures. `scripts/live-acceptance.ts` and `e2e/workspace.spec.ts` exercise real DeepSeek calls separately; their outputs are local artifacts. See `docs/validation.md` for actual results and limits.
