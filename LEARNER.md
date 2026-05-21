# 学习者使用说明

这份文档只写你需要关心的部分。底层状态、校验、同步和课程包维护交给 Codex。

## 你主要关注的目录

### `workspace/`

这里放你真正写代码、做练习、完成项目的产物。

当前课程包对应：

```text
workspace/fullstack-learning-system/
```

后续 TypeScript、Node、API、数据库、React 联调等练习都会放在这里。

### `sessions/`

这里记录每次学习 session 的任务、证据和验收结果。你可以打开当前 session 看“今天做什么”。

当前 session：

```text
sessions/fullstack-learning-system/session-001.md
```

### `journal/`

这里放长期笔记，例如反复错误、问题、概念理解和关键决策。你可以口述给 Codex，由 Codex 记录。

当前课程包笔记：

```text
journal/tracks/fullstack-learning-system/
```

## 你不需要主动维护的目录

```text
engine/
state/
tracks/*/source/
tracks/*/generated/
```

- `engine/`：学习系统规则、命令和校验逻辑。
- `state/`：当前学到哪里、当前 session 是什么。
- `tracks/*/source/`：课程包事实源，只有明确修订路线时才改。
- `tracks/*/generated/`：路线图等派生文档，可看但不是事实源。

## 常用说法

你可以直接对 Codex 说：

```text
继续
暂停并同步
验收
卡住了
保存这个证据：...
记录一个问题：...
```

Codex 会负责读取状态、恢复 session、运行校验、更新 handoff、记录 evidence 和按需提交同步。

## 学习时你要交付什么

每轮学习通常需要这些证据：

- 你运行过的命令和输出。
- 你写过或改过的关键文件。
- 报错、你对报错的判断、修复后的结果。
- 你自己的解释。
- 一个独立完成的小变体任务。

可以参考：

```text
engine/templates/evidence.md
```

## 当前状态

- Track: `fullstack-learning-system`
- Session: `session-001`
- Status: `paused`
- 下一步：处理 pnpm blocker，或者明确本轮使用 npm fallback。

