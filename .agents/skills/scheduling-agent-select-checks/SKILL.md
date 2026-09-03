---
name: scheduling-agent-select-checks
description: 'Use before claiming verification in scheduling-agent when a diff touches application source, generated routes, dependencies, build configuration, or repository documentation; map the actual diff to the narrowest existing checks that can expose its regression.'
---

# Select Checks

## Inspect

1. Read the complete working diff or, before version control exists, list every changed path explicitly.
2. Classify each path using the evidence map below.
3. Run every matching row. Use `pnpm verify` when a change crosses rows or alters dependencies.

## Evidence map

| Diff area                                                                  | Required evidence                                      |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| `src/routes/**`, `src/router.tsx`, `tsr.config.json`                       | `pnpm generate-routes`, `pnpm typecheck`, `pnpm build` |
| Other `src/**`, `vite.config.ts`, `tsconfig.json`                          | `pnpm lint`, `pnpm typecheck`, `pnpm build`            |
| `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `components.json` | `pnpm install --frozen-lockfile`, then `pnpm verify`   |
| Markdown under `README.md`, `AGENTS.md`, `docs/**`, `.agents/**`           | `pnpm check`                                           |

A failing relevant check blocks completion unless the failure and blocker are reported accurately. Do not claim a test layer ran merely because its dependency is installed.

## Report

Report only commands actually run, their results, and any matching check that could not run.
