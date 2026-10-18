# Fall 2026 scenario protocol

These are author-operated replays of the user's archived course context using the real DeepSeek API and isolated SQLite calendars. They do not submit coursework, change external calendars or establish current LMS deadlines. The protocol was written before the first calls. Failed runs must be retained.

## Evidence and assumptions

The user requested reference to their 26Fall conversations. The accessible course conversation **查今晚还有什么作业截止** was read for its October 17 result, alongside the local 26F course workspace. No complete chat with the exact title “26fall” was available in the recent-thread listing; this is a bounded reconstruction from those records.

| Source in the parent course workspace                                         | Snapshot                                 | Facts used                                                                                                                                                                                        |
| ----------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `course_materials/schedule/Fall_2026_课程时间表.md`                           | August 28 ICS, with archived exam notes  | Monday/Thursday LITR 10:00–11:50 and ECON 14:00–15:50; Tuesday AI 10:00–11:50, PSoft 14:00–15:50, RCOS 16:00–17:50; Test 2 November 10 18:00–19:50. The evening test block is not a weekly class. |
| `course_materials/offline_2026-10-04/02_截止时间.md`                          | October 4                                | ECON Discrimination lectures/background October 22 14:00; LITR CR2 draft October 25 23:59; Health reading November 8 23:59.                                                                       |
| `course_materials/offline_2026-10-04/04_学期日程.md` and `CONTEXT_COURSES.md` | October 4, updated September 24 syllabus | Health discussion November 9 supersedes the old November 12 entry. No invented individual LITR presentation date.                                                                                 |
| Course conversation and `output/due_reminders/2026-10-17.json`                | October 17 20:03–20:05 EDT               | A2 deadline conflict: Submitty October 18 23:59 versus announcement October 19 17:00. Retain the conflict; do not silently decide which is authoritative.                                         |

The fixture contains selected individual class occurrences, not a complete semester. Names, accounts, grades, emails and team identities are omitted. Reference time for service replay is October 18 08:00 EDT. Availability 09:00–21:00 including weekends, estimated task durations, temporary meetings and changing preferred study windows are explicit test assumptions. A2 rehearsal on October 19 is a scheduling exercise, not a claim that this is before its confirmed deadline. Production/browser tests use the actual server clock and are time-bounded to dates before these fixtures pass.

## Acceptance scenarios fixed before execution

1. Monday A2 rehearsal: 60 minutes after 13:30, finish by 17:00. Respect LITR/ECON; propose 15:50–16:50 and write only on approval.
2. Competing meeting: a separate proposal approves a temporary meeting at 16:00 while rehearsal approval is pending. Invalidate the rehearsal without moving any class.
3. Tuesday PSoft HW3: 90 minutes after 11:50, finish by 14:00. Move into RCOS must fail; explicitly move to 18:00 and preserve 90 minutes. Reopen the database and verify persistence. No phantom weekly evening exam on October 20.
4. Actual Test 2 day: 90 minutes after 18:00, finish by 20:00 cannot fit. Follow-up changes only duration to 10 minutes; retain date/bounds and propose 19:50–20:00.
5. ECON preparation: 60 minutes on October 22 after 11:50, before the archived 14:00 deadline. Avoid LITR/ECON and finish at 12:50.
6. Conflicting A2 source dates: ask which deadline to schedule against; clarify without making a calendar event.
7. Corrected Health discussion: November 9 14:00 is occupied; a conflicting prep request must fail. The obsolete November 12 Health date is not imported as fact.
8. LITR CR2 work: user chooses October 25 90 minutes at 19:00; reject the draft and verify no write. Time is a test choice, not an official start time.
9. Preference revision: replace a test morning preference with an afternoon preference; retrieve and show the old record as excluded, invalidate pending proposals after changes, then regenerate with current evidence.

The browser path additionally exercises two independent browser contexts, refresh, an actual server-process restart, keyboard/mobile access and calendar geometry. Service cases preserve every API input and parsed response; browser cases preserve screenshots, traces, database state and server logs. Expected failure means a visible clarification/invalidation and no unintended write, not an exception or a missing UI response.
