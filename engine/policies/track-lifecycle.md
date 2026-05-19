# 课程包生命周期

## 状态

允许的课程包状态：

- `planned`
- `active`
- `paused`
- `completed`
- `archived`

## 创建

课程包从学习目标和学习者上下文生成。课程包生成器负责创建 source 文件、rubric 和 generated 文档。

## 激活

激活课程包时创建或更新：

- `state/tracks/<track-id>.json`
- `state/handoff/<track-id>.md`
- `sessions/<track-id>/`
- `workspace/<track-id>/`
- `journal/tracks/<track-id>/`

## 修订

以下情况允许修订课程包：

- 学习目标变化
- 学习者画像发生明显变化
- 验收暴露重大前置缺口
- 路线过大、过小或顺序明显不合理

修订必须记录在 `journal/global/decisions.md` 或对应课程包 journal 中。

