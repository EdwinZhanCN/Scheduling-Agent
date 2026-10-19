# Classroom demo runbook

Suggested running time: four minutes, matching the existing rehearsal plan. This is a proposed presentation flow, not a newly verified course time limit. All app times below use America/New_York, even if the browser/computer uses another timezone.

Core statement: **The model interprets the request, deterministic code checks feasibility, and the user approves every calendar write.**

## Four-minute main path

| Time      | Action                                                                                                                                                                   | Point to explain                                                                                                                                       |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 0:00–0:30 | Show the archived-course calendar and the three responsibility boundaries                                                                                                | This is a working local scheduling application; selected course facts were entered as fixtures, not synchronized from an LMS.                          |
| 0:30–1:40 | Show morning preference replaced by an afternoon record effective November 1. Request 60 minutes of Health discussion notes on November 9. Expand evidence, then approve | The newer eligible preference yields 16:00–17:00; the old record is explicitly excluded. The yellow draft is not a saved event until approval.         |
| 1:40–2:50 | Request 90 minutes after the November 10 exam, no earlier than 18:00 and finished by 20:00. Then change only duration to 10 minutes                                      | The exam occupies 18:00–19:50. The first request is infeasible. The reply yields 19:50–20:00 while retaining the date/deadline.                        |
| 2:50–3:25 | Refresh and show saved events and retained conversation/proposal state                                                                                                   | SQLite persists facts and review state. Process restart was also tested separately; a refresh demonstration alone should not be called a restart test. |
| 3:25–4:00 | State evidence and remaining scope                                                                                                                                       | Current deterministic suite plus archived real-API/course/browser evidence; local single-user system, without external calendar sync or recurrence.    |

## Copyable prompts

Use these with the prepared November fixture. Wait until each response finishes before the next action. Do not include the quotation marks.

1. `Use my current preferences to schedule 60 minutes of Health discussion notes on 2026-11-09, not before 15:50 and finish by 18:00.`
2. Optional class conflict: `Schedule 60 minutes of Health notes on 2026-11-09 at 14:00.` The saved Health class occupies 14:00–15:50.
3. Start a new request (uncheck **Include previous clarification** if it appears): `Schedule Test 2 reflection on 2026-11-10 for 90 minutes, not before 18:00 and finish by 20:00.`
4. Keep **Include previous clarification** checked: `Change the duration to 10 minutes; keep the date and time bounds.`

Task summaries/tags/complexity and the mobile review drawer are useful optional Q&A demonstrations. Avoid making the main four-minute flow depend on every feature.

## Rehearsal and screenshots

```bash
pnpm build
pnpm exec tsx scripts/presentation-demo.ts
```

The script uses installed Chrome and the configured real DeepSeek endpoint. It creates a new isolated SQLite calendar, owns a temporary production preview on port 3004, performs UI actions, captures eight unedited screenshots and a browser trace, and stops its preview when complete. It refuses an occupied port. Evidence is written to a new `artifacts/presentation-*/` directory, including `capture.json` and the resulting calendar. The script does not overwrite the primary workspace. The demo uses future November dates; it must be refreshed after those dates have passed.

Morning/afternoon preferences, availability and estimated durations are demo assumptions. The course/exam facts and source dates are documented in [the Fall protocol](fall-scenarios.md). Saved snapshots are the presentation fallback if the API/network is unavailable; label them as recorded screenshots.

## Slide accuracy

The earlier A2 script and slides predate the implementation and still say “the repository is still a scaffold” and that persistence/approval are future integration. Those statements are outdated for the current app. Update the implementation/status slide before presenting. Keep historical experiment results clearly dated, and distinguish those experimental validators from the current application validator. This runbook does not itself update the existing PPTX/PDF or submit course files.
