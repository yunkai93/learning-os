# 全栈学习系统路线

Track id: `fullstack-learning-system`

这是当前激活的第一条课程包，用于从前端背景出发，补齐 TypeScript、Node 后端、数据库、鉴权、测试、部署与项目讲述能力，最终完成一个以 Learning OS 为主题的全栈项目。

## 当前状态

- Track status: active
- Current module: `m01-ts-node-foundation`
- Current session: none
- 下一步：规划试运行 `session-001`

## 文件结构

- `source/track.json`：课程包事实源入口。
- `source/modules/*.json`：阶段与 outcome。
- `source/projects/*.json`：项目产物。
- `source/rubrics/*.json`：证据驱动验收标准。
- `generated/roadmap.md`：面向人阅读的路线图。
- `generated/milestone-map.md`：里程碑图。

## 使用边界

正常学习时，不要重新生成整条课程包。后续 session 应该基于 `source/` 生成；只有当试运行发现路线颗粒度、顺序或验收标准存在问题时，才修订 source。
