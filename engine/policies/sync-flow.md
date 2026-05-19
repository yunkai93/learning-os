# 跨设备同步流程

## 目标

跨设备同步的目标是：任意一台电脑上的 Codex 都能根据仓库事实源恢复学习状态，而不依赖上一台电脑的聊天记录。

用户不需要记忆 git、validate、handoff 的细节。用户只表达意图，例如：

- 今天继续
- 暂停并同步
- 换电脑恢复
- 验收并保存

Codex 负责执行底层检查、状态维护、提交和推送。

## 事实源

跨设备同步只信任仓库中的事实源：

- `AGENTS.md`
- `state/global.json`
- `state/learner.json`
- `state/tracks/*.json`
- `state/handoff/*.md`
- `sessions/<track-id>/*`
- `tracks/<track-id>/source/*`
- `journal/**/*`
- `workspace/<track-id>/**/*`

聊天记录、口头记忆、未提交本地改动都不能作为跨设备事实源。

## 开始学习前

当用户说“继续”“今天继续”“恢复”“换电脑恢复”时，Codex 必须：

1. 检查当前目录是否是 Learning OS 仓库。
2. 读取 `AGENTS.md`、`state/global.json`、`state/learner.json`。
3. 如果有 active track，读取对应 track state 和 handoff。
4. 检查 git 状态。
5. 如果工作区有未提交改动，先判断是否是学习系统状态改动：
   - 如果是当前任务相关改动，继续工作前先理解它们。
   - 如果是不相关改动，不要覆盖或回滚。
   - 如果改动会影响恢复判断，先向用户说明。
6. 如果仓库有远端并且网络可用，优先检查是否落后于远端。
7. 运行 `npm run status` 和 `npm run validate`。
8. 根据 `state/tracks/<track-id>.json.nextStep` 和 handoff 给出下一步。

## 结束学习时

当用户说“暂停”“暂停并同步”“今天到这里”“保存进度”时，Codex 必须：

1. 更新当前 session：
   - 状态为 `paused`、`assessing`、`completed` 或 `failed`
   - 当前进度
   - evidence
   - next step
2. 更新 `state/tracks/<track-id>.json`：
   - `currentModuleId`
   - `currentSessionId`
   - `nextStep`
   - `blockedBy`
   - outcome 进度
3. 更新 `state/handoff/<track-id>.md`，写清下一台电脑唯一下一步。
4. 必要时更新 `journal/`：
   - 决策
   - 反复错误
   - 尚未解决的问题
5. 运行 `npm run validate`。
6. 检查 `git status`。
7. 如果用户要求同步，执行 commit 和 push。

## 提交规则

Codex 负责选择清晰的提交信息。

推荐提交类型：

- `chore: update learning state`
- `feat: add <track-id> track`
- `feat: plan <session-id>`
- `chore: pause <track-id>`
- `docs: update learning journal`
- `fix: repair learning state`

提交前必须确认：

- `npm run validate` 通过。
- 没有意外的大文件。
- 没有明显私密信息，例如 token、密码、真实密钥。
- 未提交改动都属于本次学习系统状态或用户明确要求提交的内容。

## 推送规则

推送前检查：

- 当前分支是否有 upstream。
- 本地是否落后远端。
- 是否需要先 pull。

如果远端有新提交：

- 不要直接强推。
- 先拉取并处理冲突。
- 如果冲突涉及 `state/`、`sessions/` 或 `handoff/`，必须谨慎合并，保留最新真实进度。

只有在用户明确要求改写历史，或刚修正本地最近提交作者等明确场景，才允许 `--force-with-lease`。

## 冲突处理

冲突优先级：

1. 不丢失任何 session evidence。
2. 不丢失 handoff 的下一步。
3. 保持 `state/global.json.activeTrackId` 与真实恢复目标一致。
4. 保持 `state/tracks/<track-id>.currentSessionId` 与 session 文件一致。
5. 保留所有 journal 决策，重复内容可以合并。

如果 Codex 无法判断哪个状态更新，必须停下来问用户，不要猜。

## 多设备环境差异

不同设备可能有不同：

- Node 版本
- pnpm/npm 可用性
- 数据库安装状态
- 环境变量
- SSH key
- GitHub 登录状态
- 操作系统路径

因此 workspace 项目必须逐步补充：

- `.env.example`
- README 运行步骤
- package scripts
- 数据库启动说明
- 依赖安装说明

如果环境问题阻止学习，不要把它当作学习失败。记录到 handoff 的 blockers，并给出环境修复下一步。

## 未完成 session 规则

如果 `state/global.json.activeSessionId` 或 track state 中存在 `currentSessionId`：

- 不允许创建新 session。
- 只能继续、暂停、验收或失败该 session。
- 如果 session 文件缺失，先修复状态或恢复文件，不能直接推进。

## 同步完成标准

一次跨设备安全交接完成必须满足：

- `npm run validate` 通过。
- `git status` 干净，或只剩用户明确不提交的改动。
- 最新提交已推送到远端。
- handoff 写明下一步唯一动作。
- active session 和 track state 一致。

