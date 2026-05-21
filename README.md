# Learning OS

Learning OS 是一个可复用、证据驱动的 Codex 辅助学习系统。

它把学习拆成几层：

- `engine/`：学习引擎，定义如何规划、验收、补救、复盘和恢复。
- `tracks/`：课程包，定义具体学什么。
- `state/`：状态事实源，记录当前学到哪里。
- `sessions/`：每次学习会话记录。
- `workspace/`：真实练习、项目和实验产物。
- `journal/`：长期笔记、错误、问题、决策和跨课程洞察。

当前已创建并激活第一条课程包：`fullstack-learning-system`。它是第一条试运行路线，用来验证 Learning OS 的课程包生成、session 规划、证据验收和跨设备协作流程。

当前下一步由状态文件决定，不靠 README 手写判断。README 只说明项目结构；恢复学习时必须以 `state/`、`sessions/` 和 `state/handoff/` 为事实源。可以运行：

```bash
npm run learn -- doctor
```

当前仓库状态是：

- Active track: `fullstack-learning-system`
- Current module: `m01-ts-node-foundation`
- Current session pointer: `session-001`
- Session status: `paused`
- Next step: 处理 `session-001` 环境 blocker：pnpm 当前不可用，优先启用/安装 pnpm，或明确本轮使用 npm fallback。

## 快速使用

学习者只需要看：

```text
LEARNER.md
```

校验系统结构：

```bash
npm run validate
```

`validate` 会同时检查：

- 必需目录和文件是否存在。
- state、session、track source 是否通过 JSON Schema。
- active track、current session、handoff、session Markdown 是否一致。
- session 引用的 module/outcome 是否存在且属于对应课程包。
- workspace、sessions、journal 等课程包工作目录是否齐全。

查看当前状态：

```bash
npm run status
```

查看唯一下一步：

```bash
npm run learn -- next
```

检查本机 Node/npm/pnpm/corepack/git 环境：

```bash
npm run learn -- env-doctor
```

运行自动化测试：

```bash
npm test
```

新增第二条课程包时，先创建课程包壳：

```bash
npm run learn -- new-track my-track "My Track"
```

这个空壳还不是课程。要生成真实课程内容，需要让 Codex 使用：

```text
engine/prompts/create-track.md
```

然后把结果写入该课程包的 `source/` 文件。

当前第一条课程包已生成，不需要重复创建。除非要新增第二条学习路线，否则不要运行 `new-track`。

## 使用模型

1. 从学习目标创建课程包。
2. 在 `state/learner.json` 记录学习者背景和偏好。
3. 激活课程包。
4. 根据课程包和当前状态生成一次学习 session。
5. 你完成任务，Codex 担任教练、审阅者和验收官。
6. 用证据和 rubric 验收。
7. 更新状态、session 历史、进度和 handoff。
8. 继续、暂停、切换课程包或阶段复盘。

## 跨设备协作

用户不需要手动记忆同步命令。正常使用时只需要告诉 Codex：

```text
今天继续
暂停并同步
换电脑恢复
验收并保存
```

Codex 负责按照 `engine/policies/sync-flow.md` 执行：

- 读取 state 和 handoff
- 检查 git 状态
- 拉取或提醒远端变化
- 运行 `npm run status`
- 运行 `npm run validate`
- 更新 session、track state、handoff 和 journal
- commit 和 push

跨设备恢复只信任仓库事实源，不依赖上一台电脑的聊天记录。

## 设计保证

- 课程内容和学习引擎解耦。
- 状态文件机器可读，跨设备恢复不靠聊天记忆。
- generated 文档不是事实源。
- 进度基于 outcome 和 evidence，不基于感觉。
- 支持多课程包暂停与恢复。
- 后续可以复用到新的学习目标。
