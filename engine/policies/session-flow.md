# Session 流程

## 状态

允许的 session 状态：

- `planned`
- `active`
- `paused`
- `assessing`
- `completed`
- `failed`

## 开始或继续

开始或继续学习时：

1. 读取全局状态。
2. 确认 active track。
3. 读取 track state 和 handoff。
4. 读取课程包 source 文件。
5. 如果已有 active session，就继续它。
6. 如果没有 active session，就从下一个可学习 outcome 或补救需求生成 session。

## session 大小

一次 session 应该对应一个聚焦学习块。默认目标：

- 正常学习：90 到 180 分钟。
- 补救任务：30 到 60 分钟。
- 复习或回忆：15 到 30 分钟。

## session 必须包含

- 目标
- 为什么要做这一轮
- 目标 outcomes
- 前置条件
- 学习者任务
- Codex 支持边界
- 检查点
- 所需证据
- rubric 引用
- 当前进度
- 下一步
- 验收后的结果

## 结束

session 只有经过验收才能完成。如果证据不完整，应标记为 `paused` 或 `failed`，不能标记为 `completed`。

