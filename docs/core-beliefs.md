# Core Beliefs

This document records long-term principles that materially influence tradeoffs. It is not a style guide or a task list.

## Product beliefs

- Scheduling Agent's value comes from reliably understanding, checking, and explaining schedules, not from taking automated actions without approval.
- Users must see a reviewable change proposal before any write. Rejecting a proposal must not change the calendar.
- Requests that cannot be satisfied or are ambiguous must be clarified or explicitly rejected; do not invent plausible but unsupported times.
- Course demonstrations use synthetic data by default to avoid sending private schedules to unapproved external models.

## Engineering beliefs

- The LLM handles natural language understanding and tool orchestration; conflicts, availability, and hard constraints belong to testable, deterministic code.
- SQLite is the source of schedule facts, FullCalendar is the presentation and interaction layer, and agent conversations are not a source of persisted facts.
- Browser, server, database, and model boundaries must be connected through explicit types and runtime validation.
- Maintain dependencies and generated content through project CLIs so lockfiles and generators remain reproducible.

## Non-goals

- The initial course scope excludes multi-user authentication, external calendar synchronization, notifications, Premium resource timelines, and complex recurring events.
- The initial scope does not include model training or introduce a vector database or RAG for scheduling.
- The agent has no tools that directly commit schedule changes.

## Applying these beliefs

When a change conflicts with these principles, record the tradeoff explicitly. If a principle itself changes, update this document and record the project-specific rationale in `.agents/decisions/`.
