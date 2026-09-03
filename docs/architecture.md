# Architecture

本文档记录仓库当前存在的系统边界。操作流程属于 `.agents/skills/`，决策理由属于 `.agents/decisions/`，未完成的多阶段工作属于 `.agents/exec-plans/active/`。

## System context

仓库当前是单体 TanStack Start 应用骨架。目标产品是单用户 Scheduling Agent，但日历、Agent、数据库与排程能力尚未实现。当前可运行边界只有 TanStack Start 生成的最小页面和构建工具。

## Module ownership

| Module or path    | Responsibility                      | Entry point                                     |
| ----------------- | ----------------------------------- | ----------------------------------------------- |
| `src/routes/`     | 文件路由、根文档和当前占位首页      | `src/routes/__root.tsx`、`src/routes/index.tsx` |
| `src/router.tsx`  | 创建并注册 TanStack Router          | `getRouter()`                                   |
| `src/lib/`        | 与具体功能无关的共享工具            | `src/lib/utils.ts`                              |
| `src/styles.css`  | Tailwind、shadcn tokens 与全局样式  | `src/routes/__root.tsx` 的 stylesheet link      |
| `components.json` | shadcn 代码生成和外部 registry 配置 | shadcn CLI                                      |

## Dependency direction

当前路由可以依赖 `src/lib/` 与全局样式。生成的 `src/routeTree.gen.ts` 依赖路由文件，其他模块不得依赖它的内部实现。

后续引入功能模块时，浏览器组件只能调用 TanStack Start 的服务端边界，不能直接导入 `better-sqlite3`、Drizzle 连接或 pi Agent runtime。数据库与 Agent 可以依赖纯领域类型和确定性排程模块，反向依赖禁止出现。

## Data and state ownership

当前没有业务数据、SQLite 文件或数据库 schema。`src/routeTree.gen.ts` 是由 `pnpm generate-routes` 派生的生成文件。`pnpm-lock.yaml` 是依赖解析的权威锁文件，`components.json` 是 shadcn registry 与 alias 的权威配置。

## External boundaries

当前运行时没有配置外部 API、模型供应商或持久化服务。FullCalendar、pi Agent SDK、Drizzle 与 better-sqlite3 仅作为已安装依赖存在。任何未来的模型密钥必须留在服务端环境变量中。

## Runtime entry paths

- 开发服务器：`pnpm dev`
- 生产构建：`pnpm build`
- 生产构建预览：`pnpm preview`
- 路由生成：`pnpm generate-routes`
- 完整本地验证：`pnpm verify`

## Verification boundaries

| Boundary              | Current guardrail                    |
| --------------------- | ------------------------------------ |
| TypeScript 与导入边界 | `pnpm typecheck`、`pnpm lint`        |
| 路由生成和 SSR 构建   | `pnpm generate-routes`、`pnpm build` |
| 格式与 Harness 文档   | `pnpm check`                         |
| 测试运行器接线        | `pnpm test`；当前允许零测试          |
| 跨边界或依赖修改      | `pnpm verify`                        |
