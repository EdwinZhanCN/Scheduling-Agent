# Scheduling Agent

一个面向本科人工智能课程项目的 Scheduling Agent 工程骨架。计划中的产品使用 TanStack Start、React、shadcn/ui、FullCalendar、pi Agent SDK 和 SQLite；当前仓库只完成了脚手架、依赖与工程约束配置，尚未实现业务逻辑、数据库模型或正式 UI。

## 当前状态

- TanStack Start 的最小 React 路由骨架
- Tailwind CSS 4 与 shadcn/ui 基础配置
- FullCalendar v7 React 依赖及官方 shadcn registry 配置
- pi Agent SDK 依赖
- Drizzle ORM、better-sqlite3 与迁移工具依赖
- Vitest、Testing Library 与 Playwright 测试依赖
- ESLint、Prettier、TypeScript 和最小 Agent Harness

当前首页仍是 TanStack CLI 生成的占位页面。仓库中没有日历、Agent、SQLite schema 或排程算法实现。

## 环境要求

- Node.js `>= 22.19.0`
- pnpm `11.7.0`

建议通过 Corepack 使用仓库声明的 pnpm 版本：

```bash
corepack enable
pnpm install
```

## 本地开发

```bash
pnpm dev
```

开发服务器默认运行在 `http://localhost:3000`。

## 常用命令

| 命令                   | 用途                                     |
| ---------------------- | ---------------------------------------- |
| `pnpm dev`             | 启动开发服务器                           |
| `pnpm generate-routes` | 重新生成 TanStack Router 路由树          |
| `pnpm check`           | 检查 Prettier 格式                       |
| `pnpm lint`            | 运行 ESLint                              |
| `pnpm typecheck`       | 运行 TypeScript 类型检查                 |
| `pnpm test`            | 运行 Vitest；当前允许没有测试文件        |
| `pnpm build`           | 构建生产版本                             |
| `pnpm verify`          | 依次执行格式、Lint、类型、测试和构建检查 |

## 主要目录

```text
src/routes/                 TanStack Router 文件路由
src/lib/                    共享工具；目前仅有 shadcn 的 cn 工具
src/routeTree.gen.ts        自动生成的路由树，不应手工修改
components.json             shadcn/ui 与 FullCalendar registry 配置
docs/                       当前架构与长期工程原则
.agents/                    仓库本地技能、决策、复盘与执行计划入口
AGENTS.md                   Coding Agent 的最小入口说明
```

## UI 与 FullCalendar

`components.json` 已注册 FullCalendar 官方 shadcn registry，但本次没有生成任何日历组件。开始 UI 实现后，可以选择一个 FullCalendar flavor，例如：

```bash
pnpm dlx shadcn@latest add @fullcalendar/monarch-event-calendar
```

应先评审 registry 将写入的组件，再根据项目布局保留需要的部分。

## 数据库与 Agent

SQLite、Drizzle 和 pi Agent SDK 当前都只安装了依赖：

- 尚未创建 `drizzle.config.ts`、数据库文件或迁移。
- 尚未配置模型供应商或 API Key。
- 尚未创建 Agent session、tool 或 system prompt。
- 尚未定义 FullCalendar EventInput 到 SQLite 的映射。

任何密钥都应放入未提交的本地环境变量文件，不能写入源码或 README。

## Agent Harness

仓库使用 `minimal-agent-harness` 生成最小本地 Harness。进入仓库的 Coding Agent 应先阅读 [AGENTS.md](AGENTS.md)，并只加载与当前修改相关的文档、技能或活跃计划。
