# Prompt 协议：创建课程包

当用户要创建新的课程包时，使用这个协议。

## 需要收集的输入

- 学习目标
- `state/learner.json`
- 当前基础
- 目标水平
- 希望节奏
- 可投入时间
- 期望产物或项目
- 约束和排除项

## 输出契约

只能创建或更新：

- `tracks/<track-id>/source/track.json`
- `tracks/<track-id>/source/modules/*.json`
- `tracks/<track-id>/source/projects/*.json`
- `tracks/<track-id>/source/rubrics/*.json`
- `tracks/<track-id>/generated/roadmap.md`
- `tracks/<track-id>/generated/milestone-map.md`
- `state/tracks/<track-id>.json`，如果同时激活
- `state/handoff/<track-id>.md`，如果同时激活

## 规则

- 不修改 engine 文件。
- 用户没有要求开始学习时，不创建 session。
- source JSON 保持简洁、结构化。
- 人类解释放到 generated Markdown。
- outcome 必须可验收。
- rubric 必须基于证据。
- 必须包含前置条件和退出标准。

## 质量检查

- 课程包有明确目标水平。
- module 顺序符合前置关系。
- outcome 可以被观察和验收。
- project 服务 outcome。
- rubric 能区分 pass、partial、fail。
- 课程包不依赖聊天记忆，也能生成 session。

