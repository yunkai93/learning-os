#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");

const requiredPaths = [
  "AGENTS.md",
  "README.md",
  "engine/policies/operating-principles.md",
  "engine/policies/session-flow.md",
  "engine/policies/assessment-flow.md",
  "engine/policies/handoff-flow.md",
  "engine/prompts/create-track.md",
  "engine/prompts/plan-session.md",
  "engine/prompts/assess-session.md",
  "engine/templates/session.md",
  "engine/templates/handoff.md",
  "engine/schemas/track.schema.json",
  "engine/schemas/module.schema.json",
  "engine/schemas/project.schema.json",
  "engine/schemas/rubric.schema.json",
  "engine/schemas/session.schema.json",
  "engine/schemas/global-state.schema.json",
  "engine/schemas/learner-profile.schema.json",
  "engine/schemas/track-state.schema.json",
  "state/global.json",
  "state/learner.json",
  "tracks",
  "state/tracks",
  "state/handoff",
  "sessions",
  "workspace",
  "journal/global",
  "journal/tracks"
];

const sessionStatuses = new Set([
  "planned",
  "active",
  "paused",
  "assessing",
  "completed",
  "failed"
]);

const assessmentResults = new Set(["pass", "partial", "fail"]);
const independenceLevels = new Set(["solo", "hinted", "assisted", "codex_written"]);
const nextActions = new Set([
  "advance",
  "remediate",
  "repeat_smaller",
  "review_later",
  "revise_track"
]);

function now() {
  return new Date().toISOString();
}

function rel(...parts) {
  return path.join(root, ...parts);
}

function exists(relativePath) {
  return fs.existsSync(rel(relativePath));
}

function readJson(relativePath) {
  const fullPath = rel(relativePath);
  try {
    return JSON.parse(fs.readFileSync(fullPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read JSON ${relativePath}: ${error.message}`);
  }
}

function writeJson(relativePath, value) {
  const fullPath = rel(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(relativePath, value) {
  const fullPath = rel(relativePath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, value);
}

function ensureDir(relativePath) {
  fs.mkdirSync(rel(relativePath), { recursive: true });
}

function assertTrackId(trackId) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(trackId)) {
    throw new Error("Track id must match /^[a-z0-9][a-z0-9-]*$/");
  }
}

function listTrackIds() {
  const tracksDir = rel("tracks");
  if (!fs.existsSync(tracksDir)) return [];
  return fs
    .readdirSync(tracksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function loadGlobalState() {
  return readJson("state/global.json");
}

function saveGlobalState(state) {
  state.updatedAt = now();
  if (!state.createdAt) state.createdAt = state.updatedAt;
  writeJson("state/global.json", state);
}

function makeTrackSource(trackId, title) {
  const timestamp = now();
  return {
    id: trackId,
    title,
    version: "0.1.0",
    status: "draft",
    goal: "",
    targetLevel: "",
    learnerAssumptions: [],
    moduleIds: [],
    projectIds: [],
    rubricIds: [],
    capstoneProjectId: null,
    constraints: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function makeTrackState(trackId) {
  return {
    trackId,
    status: "planned",
    currentModuleId: null,
    currentSessionId: null,
    nextStep: "先使用 engine/prompts/create-track.md 生成课程包 source 内容，再规划 session。",
    blockedBy: [],
    outcomes: {},
    updatedAt: now()
  };
}

function sessionPath(trackId, sessionId, extension) {
  return `sessions/${trackId}/${sessionId}.${extension}`;
}

function makeSessionState({ sessionId, trackId, title, moduleId = null }) {
  const timestamp = now();
  return {
    id: sessionId,
    trackId,
    title,
    moduleId,
    status: "active",
    targetOutcomeIds: [],
    result: "unassessed",
    independence: "unknown",
    nextAction: "continue",
    evidence: [],
    weakPoints: [],
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

function makeSessionMarkdown({ sessionId, trackId, title, moduleId = null }) {
  const timestamp = now();
  return `# Session ${sessionId} - ${title}

## 元数据

- Track: ${trackId}
- Module: ${moduleId ?? "none"}
- Status: active
- Created: ${timestamp}
- Updated: ${timestamp}
- Planned duration:
- Independence target:

## 目标

-

## 为什么做这一轮

-

## 目标 Outcomes

-

## 前置条件

-

## 学习者任务

1.

## Codex 支持边界

-

## 检查点

-

## 所需证据

-

## Rubric

-

## 当前进度

- 已创建 session，等待填充具体学习内容。

## 验收

- Result: unassessed
- Independence: unknown
- Evidence:
- Weak points:
- Next action: continue

## 下一步

- 按 engine/prompts/plan-session.md 补全 session 内容，或继续当前 session。
`;
}

function requireActiveTrack() {
  const globalState = loadGlobalState();
  if (!globalState.activeTrackId) {
    throw new Error("当前没有 active track。先运行：learn switch <track-id>");
  }
  const trackId = globalState.activeTrackId;
  const trackStatePath = `state/tracks/${trackId}.json`;
  if (!exists(trackStatePath)) {
    throw new Error(`Missing active track state: ${trackStatePath}`);
  }
  return {
    globalState,
    trackId,
    trackStatePath,
    trackState: readJson(trackStatePath)
  };
}

function loadSessionState(trackId, sessionId) {
  return readJson(sessionPath(trackId, sessionId, "json"));
}

function saveSessionState(session) {
  session.updatedAt = now();
  writeJson(sessionPath(session.trackId, session.id, "json"), session);
}

function setSessionStatus(session, status) {
  if (!sessionStatuses.has(status)) throw new Error(`Invalid session status: ${status}`);
  session.status = status;
  session.updatedAt = now();
}

function makeHandoff(trackId, title) {
  return `# Handoff - ${trackId}

## 当前位置

- Track: ${title}
- Track status: planned
- Active session: none
- Module: none
- Outcome: none

## 上次 handoff 之后完成了什么

- 已创建空课程包壳。

## 证据

- 还没有学习证据。

## 阻塞点

- 课程包 source 内容尚未生成。

## 下一步唯一动作

- 使用 engine/prompts/create-track.md 生成课程包 source 内容。

## 是否允许推进

- No
`;
}

function makeTrackReadme(trackId, title) {
  return `# ${title}

Track id: \`${trackId}\`

这是一个空课程包壳，还不是可用课程。

要生成真实课程内容，让 Codex 使用：

\`engine/prompts/create-track.md\`

课程事实源放在 \`source/\`。面向人类阅读的派生文档放在 \`generated/\`。
`;
}

function cmdStatus() {
  const globalState = loadGlobalState();
  const trackIds = listTrackIds();
  console.log("Learning OS 状态");
  console.log(`- Active track: ${globalState.activeTrackId ?? "none"}`);
  console.log(`- Active session: ${globalState.activeSessionId ?? "none"}`);
  console.log(`- Max in-progress tracks: ${globalState.maxInProgressTracks}`);
  console.log(`- Tracks: ${trackIds.length ? trackIds.join(", ") : "none"}`);

  if (globalState.activeTrackId) {
    const trackStatePath = `state/tracks/${globalState.activeTrackId}.json`;
    if (exists(trackStatePath)) {
      const trackState = readJson(trackStatePath);
      console.log(`- Track status: ${trackState.status}`);
      console.log(`- Current module: ${trackState.currentModuleId ?? "none"}`);
      console.log(`- Current session: ${trackState.currentSessionId ?? "none"}`);
      console.log(`- Next step: ${trackState.nextStep || "none"}`);
      if (trackState.currentSessionId) {
        const currentSessionPath = sessionPath(
          globalState.activeTrackId,
          trackState.currentSessionId,
          "json"
        );
        if (exists(currentSessionPath)) {
          const session = readJson(currentSessionPath);
          console.log(`- Session status: ${session.status}`);
          console.log(`- Session result: ${session.result}`);
        }
      }
    } else {
      console.log("- Warning: active track state file is missing");
    }
  }
}

function cmdValidate() {
  const errors = [];

  for (const relativePath of requiredPaths) {
    if (!exists(relativePath)) errors.push(`Missing ${relativePath}`);
  }

  const jsonFiles = [
    "state/global.json",
    ...fs
      .readdirSync(rel("engine/schemas"))
      .filter((file) => file.endsWith(".json"))
      .map((file) => `engine/schemas/${file}`)
  ];

  for (const file of jsonFiles) {
    try {
      readJson(file);
    } catch (error) {
      errors.push(error.message);
    }
  }

  let globalState = null;
  try {
    globalState = loadGlobalState();
  } catch (error) {
    errors.push(error.message);
  }

  if (globalState?.activeTrackId) {
    const trackId = globalState.activeTrackId;
    if (!exists(`tracks/${trackId}/source/track.json`)) {
      errors.push(`Active track source is missing: tracks/${trackId}/source/track.json`);
    }
    if (!exists(`state/tracks/${trackId}.json`)) {
      errors.push(`Active track state is missing: state/tracks/${trackId}.json`);
    }
    if (!exists(`state/handoff/${trackId}.md`)) {
      errors.push(`Active track handoff is missing: state/handoff/${trackId}.md`);
    }
    if (globalState.activeSessionId) {
      const activeSessionPath = sessionPath(trackId, globalState.activeSessionId, "json");
      if (!exists(activeSessionPath)) {
        errors.push(`Active session state is missing: ${activeSessionPath}`);
      } else {
        try {
          const session = readJson(activeSessionPath);
          if (session.trackId !== trackId) {
            errors.push(`Active session track mismatch: ${session.trackId} !== ${trackId}`);
          }
          if (!sessionStatuses.has(session.status)) {
            errors.push(`Invalid active session status: ${session.status}`);
          }
        } catch (error) {
          errors.push(error.message);
        }
      }
    }
  }

  for (const trackId of listTrackIds()) {
    const sourcePath = `tracks/${trackId}/source/track.json`;
    if (!exists(sourcePath)) {
      errors.push(`Track ${trackId} has no source/track.json`);
      continue;
    }
    try {
      const source = readJson(sourcePath);
      if (source.id !== trackId) {
        errors.push(`Track ${trackId} source id mismatch: ${source.id}`);
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  if (errors.length) {
    console.error("Validation failed");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed");
}

function cmdNewTrack(args) {
  const [trackId, ...titleParts] = args;
  const title = titleParts.join(" ").trim();
  if (!trackId || !title) {
    throw new Error('Usage: learn new-track <track-id> "<title>"');
  }

  assertTrackId(trackId);

  if (exists(`tracks/${trackId}`)) {
    throw new Error(`Track already exists: ${trackId}`);
  }

  ensureDir(`tracks/${trackId}/source/modules`);
  ensureDir(`tracks/${trackId}/source/projects`);
  ensureDir(`tracks/${trackId}/source/rubrics`);
  ensureDir(`tracks/${trackId}/generated`);
  ensureDir(`sessions/${trackId}`);
  ensureDir(`workspace/${trackId}`);
  ensureDir(`journal/tracks/${trackId}`);
  ensureDir(`journal/tracks/${trackId}/reviews`);

  writeJson(`tracks/${trackId}/source/track.json`, makeTrackSource(trackId, title));
  writeText(`tracks/${trackId}/README.md`, makeTrackReadme(trackId, title));
  writeText(
    `tracks/${trackId}/generated/roadmap.md`,
    `# Roadmap - ${title}\n\n尚未生成。\n`
  );
  writeText(
    `tracks/${trackId}/generated/milestone-map.md`,
    `# Milestone Map - ${title}\n\n尚未生成。\n`
  );
  writeJson(`state/tracks/${trackId}.json`, makeTrackState(trackId));
  writeText(`state/handoff/${trackId}.md`, makeHandoff(trackId, title));
  writeText(`journal/tracks/${trackId}/concepts.md`, "# Concepts\n\n");
  writeText(`journal/tracks/${trackId}/mistakes.md`, "# Mistakes\n\n");
  writeText(`journal/tracks/${trackId}/questions.md`, "# Questions\n\n");
  writeText(`journal/tracks/${trackId}/decisions.md`, "# Decisions\n\n");

  console.log(`已创建空课程包壳：${trackId}`);
  console.log("下一步：使用 engine/prompts/create-track.md 生成课程包 source 内容");
}

function cmdSwitch(args) {
  const [trackId] = args;
  if (!trackId) throw new Error("Usage: learn switch <track-id>");
  assertTrackId(trackId);
  if (!exists(`tracks/${trackId}/source/track.json`)) {
    throw new Error(`Track does not exist or has no source: ${trackId}`);
  }

  const globalState = loadGlobalState();
  const previousTrackId = globalState.activeTrackId;
  if (previousTrackId && previousTrackId !== trackId) {
    if (!exists(`state/handoff/${previousTrackId}.md`)) {
      throw new Error(`Cannot switch: missing handoff for ${previousTrackId}`);
    }
    const previousStatePath = `state/tracks/${previousTrackId}.json`;
    if (exists(previousStatePath)) {
      const previousState = readJson(previousStatePath);
      if (previousState.currentSessionId) {
        const previousSession = loadSessionState(previousTrackId, previousState.currentSessionId);
        if (previousSession.status === "active" || previousSession.status === "assessing") {
          setSessionStatus(previousSession, "paused");
          saveSessionState(previousSession);
        }
      }
      if (previousState.status === "active") {
        previousState.status = "paused";
        previousState.updatedAt = now();
        writeJson(previousStatePath, previousState);
      }
    }
  }

  const trackStatePath = `state/tracks/${trackId}.json`;
  const trackState = exists(trackStatePath) ? readJson(trackStatePath) : makeTrackState(trackId);
  trackState.status = "active";
  trackState.updatedAt = now();
  writeJson(trackStatePath, trackState);

  globalState.activeTrackId = trackId;
  globalState.activeSessionId = trackState.currentSessionId;
  globalState.recentTrackIds = [
    trackId,
    ...globalState.recentTrackIds.filter((id) => id !== trackId)
  ].slice(0, 10);
  saveGlobalState(globalState);

  console.log(`已切换 active track：${trackId}`);
}

function cmdPause() {
  const globalState = loadGlobalState();
  if (!globalState.activeTrackId) {
    console.log("当前没有 active track 可暂停");
    return;
  }

  const trackStatePath = `state/tracks/${globalState.activeTrackId}.json`;
  if (!exists(trackStatePath)) {
    throw new Error(`Missing active track state: ${trackStatePath}`);
  }
  const trackState = readJson(trackStatePath);
  if (trackState.currentSessionId) {
    const session = loadSessionState(globalState.activeTrackId, trackState.currentSessionId);
    if (session.status === "active" || session.status === "assessing") {
      setSessionStatus(session, "paused");
      saveSessionState(session);
    }
  }
  trackState.status = "paused";
  trackState.updatedAt = now();
  writeJson(trackStatePath, trackState);

  globalState.activeTrackId = null;
  globalState.activeSessionId = null;
  saveGlobalState(globalState);

  console.log(`已暂停 track：${trackState.trackId}`);
}

function cmdStartSession(args) {
  const [sessionId, ...titleParts] = args;
  const title = titleParts.join(" ").trim();
  if (!sessionId || !title) {
    throw new Error('Usage: learn start-session <session-id> "<title>"');
  }
  if (!/^[a-z0-9][a-z0-9-]*$/.test(sessionId)) {
    throw new Error("Session id must match /^[a-z0-9][a-z0-9-]*$/");
  }

  const { globalState, trackId, trackStatePath, trackState } = requireActiveTrack();
  if (globalState.activeSessionId || trackState.currentSessionId) {
    throw new Error("已有当前 session。请先完成、暂停或恢复它。");
  }
  if (exists(sessionPath(trackId, sessionId, "json"))) {
    throw new Error(`Session already exists: ${sessionId}`);
  }

  const session = makeSessionState({
    sessionId,
    trackId,
    title,
    moduleId: trackState.currentModuleId
  });
  writeJson(sessionPath(trackId, sessionId, "json"), session);
  writeText(sessionPath(trackId, sessionId, "md"), makeSessionMarkdown(session));

  trackState.status = "active";
  trackState.currentSessionId = sessionId;
  trackState.nextStep = "继续当前 session，收集所需证据。";
  trackState.updatedAt = now();
  writeJson(trackStatePath, trackState);

  globalState.activeSessionId = sessionId;
  saveGlobalState(globalState);

  console.log(`已开始 session：${sessionId}`);
}

function cmdResumeSession() {
  const { globalState, trackId, trackStatePath, trackState } = requireActiveTrack();
  const sessionId = trackState.currentSessionId;
  if (!sessionId) throw new Error("当前 track 没有可恢复 session。");

  const session = loadSessionState(trackId, sessionId);
  if (session.status !== "paused") {
    throw new Error(`只有 paused session 可以恢复。当前状态：${session.status}`);
  }
  setSessionStatus(session, "active");
  saveSessionState(session);

  trackState.status = "active";
  trackState.nextStep = "继续当前 session。";
  trackState.updatedAt = now();
  writeJson(trackStatePath, trackState);

  globalState.activeSessionId = sessionId;
  saveGlobalState(globalState);

  console.log(`已恢复 session：${sessionId}`);
}

function cmdBeginAssessment() {
  const { globalState, trackId, trackStatePath, trackState } = requireActiveTrack();
  const sessionId = globalState.activeSessionId ?? trackState.currentSessionId;
  if (!sessionId) throw new Error("当前没有 session 可进入验收。");

  const session = loadSessionState(trackId, sessionId);
  if (session.status !== "active") {
    throw new Error(`只有 active session 可以进入验收。当前状态：${session.status}`);
  }
  setSessionStatus(session, "assessing");
  session.nextAction = "continue";
  saveSessionState(session);

  trackState.currentSessionId = sessionId;
  trackState.nextStep = "根据 rubric 审查证据，并运行 finish-session。";
  trackState.updatedAt = now();
  writeJson(trackStatePath, trackState);

  globalState.activeSessionId = sessionId;
  saveGlobalState(globalState);

  console.log(`session 已进入验收：${sessionId}`);
}

function cmdFinishSession(args) {
  const [result, independence, nextAction] = args;
  if (!assessmentResults.has(result)) {
    throw new Error("Usage: learn finish-session <pass|partial|fail> <independence> <nextAction>");
  }
  if (!independenceLevels.has(independence)) {
    throw new Error("Invalid independence. Use solo, hinted, assisted, or codex_written.");
  }
  if (!nextActions.has(nextAction)) {
    throw new Error(
      "Invalid nextAction. Use advance, remediate, repeat_smaller, review_later, or revise_track."
    );
  }

  const { globalState, trackId, trackStatePath, trackState } = requireActiveTrack();
  const sessionId = globalState.activeSessionId ?? trackState.currentSessionId;
  if (!sessionId) throw new Error("当前没有 session 可结束。");

  const session = loadSessionState(trackId, sessionId);
  if (session.status !== "assessing") {
    throw new Error(`只有 assessing session 可以结束。当前状态：${session.status}`);
  }

  session.result = result;
  session.independence = independence;
  session.nextAction = nextAction;
  setSessionStatus(session, result === "fail" ? "failed" : "completed");
  saveSessionState(session);

  trackState.status = "active";
  trackState.currentSessionId = null;
  trackState.nextStep =
    result === "pass" && nextAction === "advance"
      ? "规划下一次 session。"
      : "根据验收结果规划补救、复习或路线修订。";
  trackState.updatedAt = now();
  writeJson(trackStatePath, trackState);

  globalState.activeSessionId = null;
  saveGlobalState(globalState);

  console.log(`session 已结束：${sessionId} (${result}, ${independence}, ${nextAction})`);
}

function usage() {
  console.log(`Usage: npm run learn -- <command>

Commands:
  status                         查看当前学习状态
  validate                       校验系统结构和 JSON 文件
  new-track <id> "<title>"       创建一个空课程包壳
  switch <id>                    激活一个课程包
  pause                          暂停当前 active track
  start-session <id> "<title>"   开始一个 session 状态记录
  resume-session                 恢复 paused session
  begin-assessment               将 active session 切到 assessing
  finish-session <result> <independence> <nextAction>
                                  结束 assessing session
`);
}

function main() {
  const [command = "status", ...args] = process.argv.slice(2);

  try {
    switch (command) {
      case "status":
        cmdStatus();
        break;
      case "validate":
        cmdValidate();
        break;
      case "new-track":
        cmdNewTrack(args);
        break;
      case "switch":
        cmdSwitch(args);
        break;
      case "pause":
        cmdPause();
        break;
      case "start-session":
        cmdStartSession(args);
        break;
      case "resume-session":
        cmdResumeSession();
        break;
      case "begin-assessment":
        cmdBeginAssessment();
        break;
      case "finish-session":
        cmdFinishSession(args);
        break;
      case "help":
      case "--help":
      case "-h":
        usage();
        break;
      default:
        usage();
        process.exitCode = 1;
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

main();
