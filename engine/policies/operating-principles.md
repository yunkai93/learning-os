# 运行原则

## 目标

Learning OS 的目标是把宽泛的学习目标变成课程包、学习 session、证据、验收、补救和可持续进度。

## 职责分离

- Engine：学习流程、状态流转、验收协议、补救协议、模板、schema 和生成提示词。
- Track：课程内容、能力 outcome、项目、rubric、里程碑和派生路线图。
- State：当前课程包、当前 session、进度、handoff 和全局限制。
- Workspace：学习者或 Codex 产出的真实代码和作品。
- Journal：长期理解、错误、问题和决策。

## 事实源

状态和课程内容以 JSON 文件为事实源。Markdown 负责解释、总结和记录学习过程。generated Markdown 可以重建，除非明确提升为 source，否则不作为事实源。

## 证据优先

完成必须有证据。可接受证据包括：

- 命令输出
- 测试结果
- 代码 diff
- 可运行产物
- 学习者自己的解释
- 调试判断
- 相邻改动题
- 空白重写题

## 独立程度

每个被验收的任务都必须记录一种独立程度：

- `solo`：学习者基本独立完成。
- `hinted`：Codex 给了提示或概念提醒。
- `assisted`：Codex 参与诊断或实现了具体部分。
- `codex_written`：Codex 写出了实现。

独立程度会影响进度。Codex 代写可以完成某个产物，但不能直接证明学习者掌握了底层能力。

## 防跑偏规则

- 正常学习中不要重新生成整条课程路线。
- 卡住时不要跳过必需 outcome。
- generated 文档不能覆盖 source JSON。
- 不同课程包的证据不要混用。
- 不要同时打开多个 active session。
- 不要静默改变学习目标或技术决策。

