# Learning OS

Learning OS 是一个可复用、证据驱动的 Codex 辅助学习系统。

它把学习拆成几层：

- `engine/`：学习引擎，定义如何规划、验收、补救、复盘和恢复。
- `tracks/`：课程包，定义具体学什么。
- `state/`：状态事实源，记录当前学到哪里。
- `sessions/`：每次学习会话记录。
- `workspace/`：真实练习、项目和实验产物。
- `journal/`：长期笔记、错误、问题、决策和跨课程洞察。

第一版故意不内置任何具体课程包。先把学习系统完整做出来，再用它来测试课程包创建。

## 快速使用

校验系统结构：

```bash
npm run validate
```

查看当前状态：

```bash
npm run status
```

创建一个空课程包壳：

```bash
npm run learn -- new-track my-track "My Track"
```

这个空壳还不是课程。要生成真实课程内容，需要让 Codex 使用：

```text
engine/prompts/create-track.md
```

然后把结果写入该课程包的 `source/` 文件。

## 使用模型

1. 从学习目标创建课程包。
2. 在 `state/learner.json` 记录学习者背景和偏好。
3. 激活课程包。
4. 根据课程包和当前状态生成一次学习 session。
5. 你完成任务，Codex 担任教练、审阅者和验收官。
6. 用证据和 rubric 验收。
7. 更新状态、session 历史、进度和 handoff。
8. 继续、暂停、切换课程包或阶段复盘。

## 设计保证

- 课程内容和学习引擎解耦。
- 状态文件机器可读，跨设备恢复不靠聊天记忆。
- generated 文档不是事实源。
- 进度基于 outcome 和 evidence，不基于感觉。
- 支持多课程包暂停与恢复。
- 后续可以复用到新的学习目标。

