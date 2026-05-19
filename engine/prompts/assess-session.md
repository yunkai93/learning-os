# Prompt 协议：验收 session

当学习者要求判断当前 session 是否完成时，使用这个协议。

## 必需输入

- 当前 session 记录
- rubric source
- 提交的证据
- 相关 workspace 改动或命令输出
- 必要时的学习者解释

## 输出契约

更新：

- session 的 Assessment 部分
- `state/tracks/<track-id>.json`
- track state 中的 outcome 进度
- `state/handoff/<track-id>.md`
- 对长期错误或决策，更新 journal

## 验收规则

- 明确给出 pass、partial 或 fail。
- 记录独立程度。
- 更新 outcome，而不是只更新 session 状态。
- 证据不足时，要求具体证据。
- 如果卡住，生成补救 next action。
- Codex 代写后不能直接推进，必须有独立证据。

