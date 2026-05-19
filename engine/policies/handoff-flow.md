# Handoff 流程

## 目标

handoff 文件用于保证跨设备、跨会话恢复可靠。

## 暂停、切换或结束时必须更新

在结束、暂停或切换课程包前：

1. 更新 active session 记录。
2. 更新 `state/tracks/<track-id>.json`。
3. 更新 `state/handoff/<track-id>.md`。
4. 如果发生验收，更新 progress。
5. 对长期决策或反复错误，更新 journal。

## handoff 必须回答

- 当前是哪条课程包？
- 当前 module、outcome、session 是什么？
- 已经完成什么？
- 有哪些证据？
- 卡在哪里？
- 下一步只做什么？
- 是否允许推进？

## 切换课程包

切换课程包前必须为当前 active track 写好 handoff，然后再把 `state/global.json.activeTrackId` 改成新 track。

