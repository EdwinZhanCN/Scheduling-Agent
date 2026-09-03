# Agent Guide

这是 Scheduling Agent 仓库中 Coding Agent 的精简入口。面向人的安装与命令说明以 [README.md](README.md) 为准。

## Product invariants

- 日程事实最终由 SQLite 持有，并通过接近 FullCalendar `EventInput` 的领域结构进入 UI；FullCalendar 运行时对象不是持久化来源。
- Agent 只能读取日程并生成变更提案；创建、移动或删除事件必须经过显式批准后才能提交。
- 硬约束和冲突判断属于确定性排程代码，不交给模型自由生成。
- 当前仓库只是依赖与工具骨架；不要把占位页面描述为已实现的产品能力。
- **i18n 采用 Extract then Fill 规则**：所有面向用户的界面文本必须先提取至 `src/i18n/locales/en.json`，再在组件中通过 `useTranslation()` / `t(...)` 引用；语言当前仅支持英文（English only）。

## Repository map

- `src/routes/`: TanStack Start 文件路由与应用入口。
- `src/lib/`: 可被应用代码共享的通用工具；包含 shadcn `cn` 工具与演示数据。
- `src/i18n/`: i18next 初始化配置与 `locales/en.json` 翻译资源。
- `src/styles.css`: Tailwind 与 shadcn 的全局样式入口。
- `components.json`: shadcn aliases 及 FullCalendar registry 配置。
- `docs/`: 当前架构和长期工程原则。
- `.agents/`: 可复用流程、决策、复盘与未完成执行计划。

## Read before changing

- 修改运行时边界、数据归属或模块划分前阅读 [`docs/architecture.md`](docs/architecture.md)。
- 发生产品范围或工程权衡时阅读 [`docs/core-beliefs.md`](docs/core-beliefs.md)。
- 检查 `.agents/exec-plans/active/`，只读取与当前修改相关的活跃计划。

## Recurring procedures

- [`scheduling-agent-select-checks`](.agents/skills/scheduling-agent-select-checks/SKILL.md): 根据实际 diff 选择最窄但可靠的验证命令。

## Non-negotiable boundaries

- `src/routeTree.gen.ts` 由 `pnpm generate-routes` 生成，禁止手工编辑。
- 依赖必须通过 pnpm 或官方脚手架 CLI 修改，不能直接手填 `package.json` 或锁文件。
- `better-sqlite3`、Drizzle 数据访问和 pi Agent runtime 只能进入服务端模块，不能被浏览器组件直接导入。
- 面向用户的文案必须遵循 **Extract then Fill** 规范提取到 `src/i18n/locales/en.json`，严禁在 JSX/组件中硬编码文案。
- 声称完成前按本地 skill 选择检查；跨层或依赖变更默认运行 `pnpm verify`。

## Durable memory

- `.agents/decisions/` 只保存未来可能被重新讨论的项目级理由。
- `.agents/postmortems/` 只保存已逃逸的系统性问题，并必须链接真实 guardrail。
- `.agents/exec-plans/active/` 只保存尚未完成的多阶段工作；完成后提取持久结论并删除计划。

---

Harness structure generated with [minimal-agent-harness](https://github.com/EdwinZhanCN) by Edwin Zhan.
