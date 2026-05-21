# Learning OS Codex 执行契约

这个仓库是一个可复用的个人学习操作系统，不是某一门具体课程。除非用户明确要求创建课程包，否则不要假设已有课程内容。

## 必读顺序

在规划、生成、验收、切换或恢复学习任务前，必须按顺序读取：

1. `README.md`
2. `engine/policies/operating-principles.md`
3. `engine/policies/session-flow.md`
4. `engine/policies/assessment-flow.md`
5. `engine/policies/handoff-flow.md`
6. `engine/policies/sync-flow.md`
7. `state/global.json`
8. `state/learner.json`
9. `state/tracks/<active-track>.json`，如果 `activeTrackId` 不为空
10. `state/handoff/<active-track>.md`，如果存在

## 核心规则

- engine 只定义“怎么学”，tracks 只定义“学什么”。
- 不要在用户没有要求时凭空生成课程内容。
- 不要根据鼓励、感觉或聊天印象推进进度，只能根据证据和 rubric 推进。
- 面向用户和 Codex 阅读的约束、流程、handoff、roadmap、journal 默认使用中文；机器字段、JSON key、命令名和枚举值保持英文。
- 每次任务都要诚实记录独立程度：`solo`、`hinted`、`assisted`、`codex_written`。
- 全局同一时间只能有一个 active session。
- `activeSessionId` 表示当前未闭环 session 指针；它可以指向 `paused` session，恢复时必须读取 session 文件状态。
- 可以有多个课程包，也可以暂停多个课程包；切换课程包前必须保存当前课程包 handoff。
- 卡住时进入补救流程，不允许直接跳过必需 outcome。
- 每次学习结束必须更新 state、session 记录和 handoff。
- 跨设备同步、状态保存、提交和推送是 Codex 的职责；用户只需要表达“继续”“暂停并同步”等意图。

## 跨设备协作

当用户说“继续”“恢复”“换电脑恢复”时，按 `engine/policies/sync-flow.md` 读取状态、检查 git、运行 validate，然后只给出当前唯一下一步。

当用户说“暂停并同步”“保存进度”“今天到这里”时，Codex 必须更新 session/state/handoff，运行 validate，并按需 commit/push。不要把底层 git 流程转嫁给用户。

## 课程包边界

课程包事实源在 `tracks/<track-id>/source/`。`tracks/<track-id>/generated/` 只是派生文档，可以重建。

课程包存在后，后续 session 只能在它的 source 边界内生成。除非用户明确同意修订课程包，否则不要临时改路线。

## workspace 规则

真实练习、项目和代码产物放在 `workspace/<track-id>/`。Codex 可以在用户要求时协助修改代码，但 session 记录必须标明这次是用户独立完成、提示完成、协助完成，还是 Codex 代写完成。
