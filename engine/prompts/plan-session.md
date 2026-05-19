# Prompt 协议：规划 session

用这个协议创建下一次学习 session。

## 必需输入

- `state/global.json`
- `state/learner.json`
- `state/tracks/<track-id>.json`
- `state/handoff/<track-id>.md`
- 课程包 source 文件
- 相关 rubric 文件
- 最近的 session 记录

## 输出契约

创建或更新：

- `sessions/<track-id>/<session-id>.md`
- `state/tracks/<track-id>.json`
- `state/global.json`
- `state/handoff/<track-id>.md`

## 规划规则

- 如果已有 active session，继续它，不创建新 session。
- 如果有待补救任务，先规划补救。
- 每次只选一个清晰目标。
- session 必须绑定明确 outcome 和 rubric 条目。
- 先定义证据，再定义任务。
- session 大小要适合一个真实学习块。

