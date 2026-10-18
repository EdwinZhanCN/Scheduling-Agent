# Verification record — 2026-10-18

This record describes a local MVP verified on macOS/arm64, Node 25.9.0, pnpm 11.25.0 and installed Google Chrome. The dependency lockfile was installed unchanged with `pnpm install --frozen-lockfile`.

## Completed checks

| Layer                  | Actual evidence                                                                                                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository checks      | `pnpm verify`: formatting, ESLint, TypeScript, 91 deterministic tests and client/server production build pass                                                                                                                                             |
| Deadline/duration      | S08 regression is rejected; a separate 30-case duration/deadline boundary grid passes; independent gate tests reject wrong duration and deadline violations                                                                                               |
| Persistence/approval   | SQLite transaction tests cover draft isolation, rejection, one-time approval, competing proposals, stale target/context, expired proposals and close/reopen persistence                                                                                   |
| Real DeepSeek          | After follow-up fix: `live-2026-10-18T21-53-36.655Z`: 21 calls, 18/18 acceptance scenarios/workflows passed                                                                                                                                               |
| Project/context labels | Final `task-labels-2026-10-18T21-33-21.756Z`: 2 calls, 2/2 cases passed, including explicit project/location and absence of those fields                                                                                                                  |
| Browser                | Real-API Playwright lifecycle passed: create task, completion state, preference replacement, reject, approve, move, delete, deadline clarification, reload persistence and mobile drawer                                                                  |
| Production runtime     | Compiled client/server loaded a separately saved SQLite workspace with persisted task/history and no browser errors                                                                                                                                       |
| Secret boundary        | Exact supplied-key scan found no key in source, scripts, tests, documentation or either build. Client chunks contain no provider URL, API-key variable, Authorization header or SQLite package reference. Local secrets/data/artifacts are ignored by Git |
| Visual review          | Desktop calendar/proposal, tasks, preferences and 390px mobile drawer screenshots were rendered and inspected                                                                                                                                             |

The final real-API fixtures are synthetic. The 18-case report covers feasible requests, Chinese input, missing duration/date, hard/soft preferences, supersession, conflicting preferences, unknown event identity, an attempted immediate write, grounded summarization, past dates, ambiguous clock times, recurrence clarification, create/move/delete approval, clarification continuation and task persistence. Every scheduling model call alone leaves the event table unchanged.

## Failures retained and repaired

1. The first browser run found that opening an event on desktop also mounted the hidden mobile agent, rendering duplicate proposal elements. Rendering is now mutually exclusive by viewport. The follow-up browser run passes. The failed trace/screenshot/database are preserved under `artifacts/browser-first-failure/` and `artifacts/browser-first-run.sqlite`.
2. Visual review found an old generated delete prompt reappearing when the mobile panel remounted. Draft text now belongs to the workbench, generated prompts are consumed once, and the browser test asserts an empty input after the final submitted request.
3. The first project/context supplement passed extraction but failed both complexity checks: the model classified already supplied papers as unresolved external dependencies. `task-labels-2026-10-18T21-31-58.457Z/report.json` retains the 0/2 result. The prompt now defines unresolved dependencies; deterministic grading does not elevate already supplied material and does not count duplicate stage evidence. Regression tests and the same two live cases now pass. An earlier harness invocation rejected extra test-only fields before making API calls; the caller was corrected without weakening input validation.

## Reproducibility

- `artifacts/final-verify.log`: full local-check output.
- `artifacts/live-*/protocol.json`, `responses.json`, `report.json`: frozen cases, model inputs/parsed outputs, observed call latency and acceptance decisions. Earlier live runs remain available and are not overwritten.
- `artifacts/task-labels-*/`: supplemental task-label protocols and reports, including the failed run.
- `artifacts/browser-final-report.json`: Playwright result; `artifacts/browser-*.png`: browser screenshots.
- `artifacts/production-smoke.json`: compiled-runtime persistence check.
- `scripts/live-acceptance.ts`, `scripts/task-label-acceptance.ts`, `e2e/workspace.spec.ts`: executable checks. Browser tests require a separate empty database as described in the README.

Artifacts are intentionally local and ignored by Git; the check code and this concise result record are versioned. Historical course experiment files outside this repository remain unchanged.

## Fall course replay and commit rounds

The original unpushed commit has been split into four equivalent review units, followed by separate scenario, fix and browser/evidence commits. See [commit rounds](commit-rounds.md) for hashes and isolated staged-tree verification.

- **9/9 archived-course scenarios passed**, with 15 real DeepSeek calls in `artifacts/fall-2026-10-18T21-50-56.892Z/`. The [protocol](fall-scenarios.md) distinguishes real course facts from assumed availability, durations and temporary meetings. The fixed protocol SHA-256 is `6897473420bfd55082afcaa6d75cfa4929c627538560e64f3c2cd2b2720fe572`.
- **One product bug reproduced and repaired:** after an infeasible 90-minute request, a reply changing duration to 10 minutes was still treated as two conflicting durations. Persisted, server-established turn boundaries now allow the new duration while retaining the old date/deadline. Five domain regressions and one database-reopen service regression were added. `artifacts/fall-followup-red.log` retains the failing regressions.
- The first live report (`fall-2026-10-18T21-47-31.054Z`) remains **7/9**: one product failure above and one harness typo expecting `conflict` instead of the actual `calendar_conflict`. The latter already invalidated the competing draft correctly. The same nine scenarios pass after the separate corrections; no failed result was overwritten.
- **Production Chrome workflow passed in 14.4 seconds**: two independent windows, competing approval, PSoft/RCOS conflict, an evening move preserving 90 minutes, actual server shutdown/restart, a third mobile context in another browser timezone, and continued clarification after restart. The calendar visibly displays the saved 18:00–19:30 event. State is identical across restart; no browser errors. Evidence: `artifacts/fall-browser-report-final.json`, `artifacts/fall-browser-2026-10-18T21-54-58.133Z/`, and `artifacts/fall-browser-traces/`.
- A strengthened browser check initially used an obsolete FullCalendar CSS selector and failed before the later workflow; the failed report/trace remain in `fall-browser-report-selector-failure.json` and `fall-browser-traces-selector-failure/`. It now uses the application's stable event class and checks visible time text. Earlier passing screenshots also exposed a premature screenshot before the approval response rendered; final screenshots wait for approved state and were visually inspected.
- Original live regression suite rerun after the fix: **18/18**, 21 calls. Current deterministic suite: **89/89**, with formatting, lint, types and production build passing. Full final log: `artifacts/fall-final-verify.log`.

These are real API/browser/process tests against selected archived personal-course facts, with author-driven actions and explicitly synthetic scenario variations. They are not an independent user study, live LMS verification, automatic course-data ingestion or external calendar integration. The primary workspace database was verified to remain empty; all replay writes used separate databases. The model alias and source snapshots remain subject to the limits below.

## Presentation capture

`scripts/presentation-demo.ts` replayed the production app with five real model calls and captured eight unedited UI screenshots in `artifacts/presentation-2026-10-18T22-14-27.506Z/`. The captured path shows task metadata, preference replacement, eligible/excluded evidence, pending versus approved calendar state, a class conflict, a duration correction after an infeasible exam-day request, and the mobile review drawer. Browser errors: zero. Screenshots were visually inspected.

The first capture attempt exposed a UI race: a response could clear text typed for the next request. Commit `0b44e15` clears only the unchanged submitted draft. Two controlled asynchronous component regressions cover preserving a newly edited draft and clearing an unchanged draft. The failed capture trace remains under `artifacts/presentation-2026-10-18T22-11-34.926Z/`. The capture script now also waits for each response to complete before continuing the guided rehearsal.

`pnpm verify` passes with **91/91 tests**, lint, types, formatting and production compilation. Log: `artifacts/presentation-verify.log`. See [the four-minute runbook](presentation-demo.md) for the exact prompts, reset procedure, archived-data assumptions and outdated statements in the earlier A2 slides.

## Pre-PR credential audit

The configured credential and common encodings were checked against every Git object reachable from all local refs, including intermediate commits, the publishable working tree, production client/server output and local test artifacts (including ZIP entries). Common API-token and private-key patterns were also checked. No matches were found. The browser build contains no API-key variable, provider endpoint, Authorization header or SQLite package reference. The provider reads credentials only at runtime on the server and returns sanitized error codes.

`.env.local` has mode `600`, is ignored and has never appeared in reachable Git history; `.env.example` has an empty API-key value. The ignore rules now cover all `.env.*` variants except that sample. Databases, screenshots and test traces remain local. Sanitized audit results are retained in `artifacts/pr-secret-audit.json`; the full pre-PR verification passed all 91 tests plus formatting, lint, types and production compilation (`artifacts/pr-verify.log`). This is a check of the reviewed repository and artifacts, not a claim about unrelated copies or conversations.

## Limits

These are constructed, author-side functional checks, not an independent human evaluation or statistical reliability estimate. DeepSeek's model alias is not a pinned upstream revision. The 30-case deterministic grid is not the previously proposed 30-scenario/two-paraphrase held-out LLM study. General natural-language completeness and task summaries/tags still require review. Cross-device deployment, external calendars, multi-user access, recurring events, local-model/edge operation, training and distillation have not been implemented or validated.
