# Session session-001 - 工程入口与最小 TypeScript + Node 程序

## 元数据

- Track: fullstack-learning-system
- Module: m01-ts-node-foundation
- Status: paused
- Created: 2026-05-19T09:01:10Z
- Updated: 2026-05-19T09:10:00Z
- Planned duration: 120-150 minutes
- Independence target: hinted first, assisted only when blocked

## 目标

本轮只完成一件事：跑通一个最小 TypeScript + Node 工程入口，并能解释它为什么能运行。

这轮不是为了大量写 TS 语法，也不是为了进入后端 API。它是整个后端路线的地基：先确认你能从一个空 workspace 建出最小工程、运行 TypeScript、读懂最基础的类型错误。

## 为什么做这一轮

你有长期前端经验，但 TypeScript 和后端工程入口需要重新建立清晰模型。后续 Node API、Nest、Prisma 都依赖这一层：

- `package.json` 决定项目脚本和依赖入口。
- `tsconfig.json` 决定 TypeScript 如何理解和编译代码。
- `src/index.ts` 是最小运行入口。
- 命令输出和报错是后续排错能力的起点。

这也是 Learning OS 的第一次真实试运行，需要观察 session 粒度、证据要求和 handoff 是否足够好。

## 目标 Outcomes

- `o01-explain-ts-node-project`：能解释 `package.json`、脚本、`tsconfig`、`src` 目录和 Node 运行入口之间的关系。
- `o02-write-typed-functions`：能独立写出带参数和返回值类型的最小 TypeScript 函数。
- `o04-read-basic-ts-errors`：能读懂一个基础 TypeScript 报错，并判断大概方向。

## 前置条件

- 当前仓库已拉取最新代码。
- `npm run validate` 通过。
- 当前 active track 是 `fullstack-learning-system`。
- 本机需要有 Node.js。pnpm 如果没有，可以在本轮记录为环境 blocker。

## 学习者任务

1. 检查本机环境：
   - `node -v`
   - `npm -v`
   - `pnpm -v`
2. 在 `workspace/fullstack-learning-system/projects/` 下创建 `ts-node-entry/`。
3. 在该目录初始化最小 Node/TypeScript 项目。
4. 创建最小 `src/index.ts`。
5. 写一个带类型的函数，例如把学习记录格式化成一行文本。
6. 添加至少一个脚本，让项目能运行或编译。
7. 故意制造一个小 TypeScript 类型错误，观察并记录报错。
8. 修复该错误，重新运行或编译。
9. 用自己的话解释：
   - `package.json` 在本项目里负责什么？
   - `tsconfig.json` 在本项目里负责什么？
   - `src/index.ts` 为什么是入口？
   - 这次 TS 报错的方向是什么？

## Codex 支持边界

- Codex 优先给提示、解释概念和检查命令输出。
- Codex 不直接替你一次性写完整项目。
- 如果卡住超过 15-20 分钟，Codex 可以给更具体的下一步或局部示例。
- 如果 Codex 写了关键代码，Assessment 必须标记为 `assisted` 或 `codex_written`，并追加独立变体任务。

## 检查点

- Checkpoint 1: 环境版本已记录。
- Checkpoint 2: 最小项目目录和配置文件存在。
- Checkpoint 3: `src/index.ts` 能运行或编译。
- Checkpoint 4: 至少一个 TS 类型错误被制造、理解并修复。
- Checkpoint 5: 学习者能用自己的话解释工程入口。

## 所需证据

本轮验收至少需要这些证据：

- 环境版本输出。
- 项目文件结构。
- 运行或编译命令输出。
- 关键 TypeScript 函数代码片段或 diff。
- 一条 TypeScript 报错和修复后的结果。
- 学习者自己的 4 点解释。

## Rubric

使用 `r01-foundation`。

通过要求：

- 项目能运行或编译。
- 学习者能解释工程入口。
- 学习者能写一个最小 typed function。
- 学习者能解释一个基础 TS 报错方向。
- 至少有一个小变体或修复动作由学习者完成。

## 当前进度

- Session 已规划并设为 active。
- 已完成任务 1 的环境检查。
- Node 可用：`v24.14.1`。
- npm 可用：`11.11.0`。
- pnpm 不可用：`zsh:1: command not found: pnpm`。
- 当前需要先处理包管理器环境，或明确本轮使用 npm fallback。
- 用户因 GPT 额度接近用尽，要求暂停并同步。

## 验收

- Result: unassessed
- Independence: unknown
- Evidence:
  - `node -v => v24.14.1`
  - `npm -v => 11.11.0`
  - `pnpm -v => command not found`
- Weak points:
  - 当前设备缺少 pnpm。
- Next action: continue

## 下一步

- 处理 pnpm 环境：优先启用/安装 pnpm；如果暂时不处理，则明确本轮用 npm fallback，并把这个决定记录到 session。
