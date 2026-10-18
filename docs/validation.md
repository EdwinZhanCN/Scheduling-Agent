# Verification record — 2026-10-18

This record describes a local MVP verified on macOS/arm64, Node 25.9.0, pnpm 11.25.0 and installed Google Chrome. The dependency lockfile was installed unchanged with `pnpm install --frozen-lockfile`.

## Completed checks

| Layer                  | Actual evidence                                                                                                                                                                                                                                           |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Repository checks      | `pnpm verify`: formatting, ESLint, TypeScript, 83 deterministic tests and client/server production build pass                                                                                                                                             |
| Deadline/duration      | S08 regression is rejected; a separate 30-case duration/deadline boundary grid passes; independent gate tests reject wrong duration and deadline violations                                                                                               |
| Persistence/approval   | SQLite transaction tests cover draft isolation, rejection, one-time approval, competing proposals, stale target/context, expired proposals and close/reopen persistence                                                                                   |
| Real DeepSeek          | Final `live-2026-10-18T21-33-24.374Z`: 21 calls, 18/18 acceptance scenarios/workflows passed                                                                                                                                                              |
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

## Limits

These are constructed, author-side functional checks, not an independent human evaluation or statistical reliability estimate. DeepSeek's model alias is not a pinned upstream revision. The 30-case deterministic grid is not the previously proposed 30-scenario/two-paraphrase held-out LLM study. General natural-language completeness and task summaries/tags still require review. Cross-device deployment, external calendars, multi-user access, recurring events, local-model/edge operation, training and distillation have not been implemented or validated.
