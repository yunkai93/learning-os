#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import Ajv2020 from "ajv/dist/2020.js";

const scriptRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const root = process.env.LEARNING_OS_ROOT
  ? path.resolve(process.env.LEARNING_OS_ROOT)
  : scriptRoot;

const requiredPaths = [
  "AGENTS.md",
  "README.md",
  "LEARNER.md",
  "engine/policies/operating-principles.md",
  "engine/policies/session-flow.md",
  "engine/policies/assessment-flow.md",
  "engine/policies/handoff-flow.md",
  "engine/policies/sync-flow.md",
  "engine/prompts/create-track.md",
  "engine/prompts/plan-session.md",
  "engine/prompts/assess-session.md",
  "engine/templates/session.md",
  "engine/templates/handoff.md",
  "engine/templates/evidence.md",
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
const inProgressSessionStatuses = new Set(["planned", "active", "paused", "assessing"]);
const liveSessionStatuses = new Set(["active", "assessing"]);
const schemaByRelativePath = new Map([
  ["state/global.json", "engine/schemas/global-state.schema.json"],
  ["state/learner.json", "engine/schemas/learner-profile.schema.json"]
]);

let ajv = null;

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

function readText(relativePath) {
  return fs.readFileSync(rel(relativePath), "utf8");
}

function ensureDir(relativePath) {
  fs.mkdirSync(rel(relativePath), { recursive: true });
}

function getAjv() {
  if (ajv) return ajv;
  ajv = new Ajv2020({
    allErrors: true,
    strict: false
  });
  return ajv;
}

function compileSchema(schemaPath) {
  const schema = readJson(schemaPath);
  return getAjv().compile(schema);
}

function formatSchemaError(relativePath, error) {
  const instancePath = error.instancePath || "/";
  const params = Object.keys(error.params ?? {}).length
    ? ` ${JSON.stringify(error.params)}`
    : "";
  return `Schema violation in ${relativePath} at ${instancePath}: ${error.message}${params}`;
}

function validateJsonSchema(relativePath, schemaPath, errors) {
  let value;
  try {
    value = readJson(relativePath);
  } catch (error) {
    errors.push(error.message);
    return null;
  }

  try {
    const validate = compileSchema(schemaPath);
    if (!validate(value)) {
      for (const error of validate.errors ?? []) {
        errors.push(formatSchemaError(relativePath, error));
      }
    }
  } catch (error) {
    errors.push(`Cannot validate ${relativePath} with ${schemaPath}: ${error.message}`);
  }
  return value;
}

function validateKnownSchema(relativePath, errors) {
  if (schemaByRelativePath.has(relativePath)) {
    return validateJsonSchema(relativePath, schemaByRelativePath.get(relativePath), errors);
  }
  return readJson(relativePath);
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

function runGit(args) {
  const result = spawnSync("git", args, {
    cwd: root,
    encoding: "utf8"
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? result.error?.message ?? "").trim(),
    status: result.status
  };
}

function runCommand(command, args = []) {
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8"
  });
  return {
    ok: result.status === 0,
    stdout: (result.stdout ?? "").trim(),
    stderr: (result.stderr ?? result.error?.message ?? "").trim(),
    status: result.status
  };
}

function checkToolVersion(command, args = ["--version"]) {
  const result = runCommand(command, args);
  if (!result.ok) return { command, ok: false, version: null, error: result.stderr || result.stdout };
  return { command, ok: true, version: result.stdout || result.stderr, error: null };
}

function collectEnvironmentChecks() {
  return [
    checkToolVersion("node", ["-v"]),
    checkToolVersion("npm", ["-v"]),
    checkToolVersion("pnpm", ["-v"]),
    checkToolVersion("corepack", ["--version"]),
    checkToolVersion("git", ["--version"])
  ];
}

function printEnvironmentChecks(checks = collectEnvironmentChecks()) {
  console.log("- Environment:");
  for (const check of checks) {
    if (check.ok) {
      console.log(`  - ${check.command}: ${check.version}`);
    } else {
      console.log(`  - ${check.command}: unavailable${check.error ? ` (${check.error})` : ""}`);
    }
  }
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

function replaceMarkdownField(markdown, label, value) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^-\\s+${escaped}:\\s*.*$`, "im");
  if (!pattern.test(markdown)) return markdown;
  return markdown.replace(pattern, `- ${label}: ${value}`);
}

function replaceFirstBulletInSection(markdown, heading, value) {
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`(${escapedHeading}\\n\\n)- .*`, "m");
  if (!pattern.test(markdown)) return markdown;
  return markdown.replace(pattern, `$1- ${value}`);
}

function saveSessionMarkdownSummary(session) {
  const markdownPath = sessionPath(session.trackId, session.id, "md");
  if (!exists(markdownPath)) return;

  let markdown = readText(markdownPath);
  markdown = replaceMarkdownField(markdown, "Status", session.status);
  markdown = replaceMarkdownField(markdown, "Updated", session.updatedAt);
  markdown = replaceMarkdownField(markdown, "Result", session.result);
  markdown = replaceMarkdownField(markdown, "Independence", session.independence);
  markdown = replaceMarkdownField(markdown, "Next action", session.nextAction);
  writeText(markdownPath, markdown);
}

function loadCurrentSessionIfPresent(trackId, trackState) {
  if (!trackState.currentSessionId) return null;
  const currentSessionPath = sessionPath(trackId, trackState.currentSessionId, "json");
  if (!exists(currentSessionPath)) return null;
  return readJson(currentSessionPath);
}

function saveHandoffSummary(trackId, trackState) {
  const handoffPath = `state/handoff/${trackId}.md`;
  if (!exists(handoffPath)) return;

  const session = loadCurrentSessionIfPresent(trackId, trackState);
  let markdown = readText(handoffPath);
  markdown = replaceMarkdownField(markdown, "Track status", trackState.status);
  markdown = replaceMarkdownField(markdown, "Active session", trackState.currentSessionId ?? "none");
  markdown = replaceMarkdownField(markdown, "Session status", session?.status ?? "none");
  markdown = replaceMarkdownField(markdown, "Module", trackState.currentModuleId ?? "none");
  markdown = replaceMarkdownField(markdown, "Track nextStep", trackState.nextStep ?? "");
  if (trackState.nextStep) {
    markdown = replaceFirstBulletInSection(markdown, "## 下一步唯一动作", trackState.nextStep);
  }
  writeText(handoffPath, markdown);
}

function saveTrackState(trackStatePath, trackState) {
  trackState.updatedAt = now();
  writeJson(trackStatePath, trackState);
  saveHandoffSummary(trackState.trackId, trackState);
}

function saveSessionState(session) {
  session.updatedAt = now();
  writeJson(sessionPath(session.trackId, session.id, "json"), session);
  saveSessionMarkdownSummary(session);
  const trackStatePath = `state/tracks/${session.trackId}.json`;
  if (exists(trackStatePath)) {
    const trackState = readJson(trackStatePath);
    if (trackState.currentSessionId === session.id) saveHandoffSummary(session.trackId, trackState);
  }
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
- Session status: none
- Module: none
- Outcome: none
- Track nextStep: 先使用 engine/prompts/create-track.md 生成课程包 source 内容，再规划 session。

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
  console.log(`- Current session pointer: ${globalState.activeSessionId ?? "none"}`);
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
          if (session.status === "paused") {
            console.log("- Session note: 当前 session 已暂停，但仍是唯一可恢复的 current session");
          }
        }
      }
    } else {
      console.log("- Warning: active track state file is missing");
    }
  }
}

function cmdNext() {
  const globalState = loadGlobalState();
  if (!globalState.activeTrackId) {
    console.log("当前没有 active track。下一步：切换或创建课程包。");
    return;
  }

  const trackStatePath = `state/tracks/${globalState.activeTrackId}.json`;
  if (!exists(trackStatePath)) {
    throw new Error(`Missing active track state: ${trackStatePath}`);
  }
  const trackState = readJson(trackStatePath);

  console.log(`当前唯一下一步：${trackState.nextStep || "继续读取 handoff 并恢复当前状态。"}`);
  if (trackState.currentSessionId) {
    const session = loadCurrentSessionIfPresent(globalState.activeTrackId, trackState);
    console.log(`- Current session: ${trackState.currentSessionId}`);
    console.log(`- Session status: ${session?.status ?? "missing"}`);
    if (session?.status === "paused") {
      console.log("- 建议命令：npm run learn -- resume-session");
    } else if (session?.status === "active") {
      console.log("- 建议动作：继续当前 session 的学习者任务，收集证据。");
    } else if (session?.status === "assessing") {
      console.log("- 建议动作：根据 rubric 验收并运行 finish-session。");
    }
  }
}

function readJsonFilesInDir(relativeDir) {
  const fullDir = rel(relativeDir);
  if (!fs.existsSync(fullDir)) return [];
  return fs
    .readdirSync(fullDir)
    .filter((file) => file.endsWith(".json"))
    .sort()
    .map((file) => {
      const relativePath = `${relativeDir}/${file}`;
      return {
        relativePath,
        value: readJson(relativePath)
      };
    });
}

function pushDuplicateErrors(errors, label, ids) {
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) errors.push(`Duplicate ${label} id: ${id}`);
    seen.add(id);
  }
}

function validateTrackPackage(trackId, errors) {
  const trackPath = `tracks/${trackId}/source/track.json`;
  let track = null;
  track = validateJsonSchema(trackPath, "engine/schemas/track.schema.json", errors);
  if (!track) {
    return;
  }

  if (track.id !== trackId) {
    errors.push(`Track ${trackId} source id mismatch: ${track.id}`);
  }

  let moduleFiles = [];
  let projectFiles = [];
  let rubricFiles = [];
  try {
    moduleFiles = readJsonFilesInDir(`tracks/${trackId}/source/modules`);
    projectFiles = readJsonFilesInDir(`tracks/${trackId}/source/projects`);
    rubricFiles = readJsonFilesInDir(`tracks/${trackId}/source/rubrics`);
  } catch (error) {
    errors.push(error.message);
    return;
  }
  for (const { relativePath } of moduleFiles) {
    validateJsonSchema(relativePath, "engine/schemas/module.schema.json", errors);
  }
  for (const { relativePath } of projectFiles) {
    validateJsonSchema(relativePath, "engine/schemas/project.schema.json", errors);
  }
  for (const { relativePath } of rubricFiles) {
    validateJsonSchema(relativePath, "engine/schemas/rubric.schema.json", errors);
  }
  const moduleIds = moduleFiles.map(({ value }) => value.id);
  const projectIds = projectFiles.map(({ value }) => value.id);
  const rubricIds = rubricFiles.map(({ value }) => value.id);
  const outcomeIds = [];

  pushDuplicateErrors(errors, "module", moduleIds);
  pushDuplicateErrors(errors, "project", projectIds);
  pushDuplicateErrors(errors, "rubric", rubricIds);

  for (const moduleId of track.moduleIds ?? []) {
    if (!moduleIds.includes(moduleId)) {
      errors.push(`Track ${trackId} references missing module: ${moduleId}`);
    }
  }
  for (const projectId of track.projectIds ?? []) {
    if (!projectIds.includes(projectId)) {
      errors.push(`Track ${trackId} references missing project: ${projectId}`);
    }
  }
  for (const rubricId of track.rubricIds ?? []) {
    if (!rubricIds.includes(rubricId)) {
      errors.push(`Track ${trackId} references missing rubric: ${rubricId}`);
    }
  }
  if (track.capstoneProjectId && !projectIds.includes(track.capstoneProjectId)) {
    errors.push(`Track ${trackId} references missing capstone project: ${track.capstoneProjectId}`);
  }

  for (const { relativePath, value: module } of moduleFiles) {
    if (!track.moduleIds?.includes(module.id)) {
      errors.push(`Module not listed in track.moduleIds: ${module.id}`);
    }
    if (!Array.isArray(module.outcomes) || module.outcomes.length === 0) {
      errors.push(`Module has no outcomes: ${relativePath}`);
    }
    for (const outcome of module.outcomes ?? []) {
      outcomeIds.push(outcome.id);
      if (!["concept", "skill", "artifact", "diagnostic"].includes(outcome.type)) {
        errors.push(`Invalid outcome type in ${relativePath}: ${outcome.id}`);
      }
    }
    const range = module.estimatedSessionRange;
    if (range && Number.isInteger(range.min) && Number.isInteger(range.max) && range.min > range.max) {
      errors.push(`Invalid estimatedSessionRange in ${relativePath}: min > max`);
    }
  }

  pushDuplicateErrors(errors, "outcome", outcomeIds);

  for (const { relativePath, value: module } of moduleFiles) {
    for (const prerequisiteOutcomeId of module.prerequisiteOutcomeIds ?? []) {
      if (!outcomeIds.includes(prerequisiteOutcomeId)) {
        errors.push(`Missing prerequisite outcome in ${relativePath}: ${prerequisiteOutcomeId}`);
      }
    }
    for (const projectId of module.projectIds ?? []) {
      if (!projectIds.includes(projectId)) {
        errors.push(`Missing module project reference in ${relativePath}: ${projectId}`);
      }
    }
  }

  for (const { relativePath, value: project } of projectFiles) {
    if (!track.projectIds?.includes(project.id)) {
      errors.push(`Project not listed in track.projectIds: ${project.id}`);
    }
    if (project.workspacePath && !project.workspacePath.startsWith(`workspace/${trackId}/`)) {
      errors.push(`Project workspacePath must stay inside workspace/${trackId}/ in ${relativePath}`);
    }
    for (const outcomeId of project.outcomeIds ?? []) {
      if (!outcomeIds.includes(outcomeId)) {
        errors.push(`Missing project outcome reference in ${relativePath}: ${outcomeId}`);
      }
    }
  }

  for (const { relativePath, value: rubric } of rubricFiles) {
    if (!track.rubricIds?.includes(rubric.id)) {
      errors.push(`Rubric not listed in track.rubricIds: ${rubric.id}`);
    }
    for (const outcomeId of rubric.appliesToOutcomeIds ?? []) {
      if (!outcomeIds.includes(outcomeId)) {
        errors.push(`Missing rubric outcome reference in ${relativePath}: ${outcomeId}`);
      }
    }
    const rubricResults = new Set((rubric.criteria ?? []).map((criterion) => criterion.result));
    for (const requiredResult of assessmentResults) {
      if (!rubricResults.has(requiredResult)) {
        errors.push(`Rubric missing ${requiredResult} criterion in ${relativePath}`);
      }
    }
  }
}

function collectTrackGraph(trackId, errors) {
  const trackPath = `tracks/${trackId}/source/track.json`;
  if (!exists(trackPath)) return null;

  let track;
  let modules;
  try {
    track = readJson(trackPath);
    modules = readJsonFilesInDir(`tracks/${trackId}/source/modules`).map(({ value }) => value);
  } catch (error) {
    errors.push(error.message);
    return null;
  }
  const outcomeToModule = new Map();
  const moduleIds = new Set(modules.map((module) => module.id));
  const outcomeIds = new Set();

  for (const module of modules) {
    for (const outcome of module.outcomes ?? []) {
      outcomeIds.add(outcome.id);
      outcomeToModule.set(outcome.id, module.id);
    }
  }

  return {
    track,
    moduleIds,
    outcomeIds,
    outcomeToModule
  };
}

function readMarkdownField(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = markdown.match(new RegExp(`^-\\s+${escaped}:\\s*(.+)$`, "im"));
  return match?.[1]?.trim() ?? null;
}

function appendToSection(markdown, heading, lines) {
  const index = markdown.indexOf(`\n${heading}\n`);
  if (index === -1) return `${markdown.trimEnd()}\n\n${heading}\n\n${lines.join("\n")}\n`;

  const start = index + heading.length + 2;
  const nextHeading = markdown.indexOf("\n## ", start);
  const insertAt = nextHeading === -1 ? markdown.length : nextHeading;
  const before = markdown.slice(0, insertAt).trimEnd();
  const after = markdown.slice(insertAt);
  return `${before}\n${lines.join("\n")}\n${after}`;
}

function appendDatedBullet(markdown, heading, text) {
  return appendToSection(markdown, heading, [`- ${now()} - ${text}`]);
}

function validateSessionMarkdown(trackId, session, errors) {
  const markdownPath = sessionPath(trackId, session.id, "md");
  if (!exists(markdownPath)) {
    errors.push(`Missing session markdown: ${markdownPath}`);
    return;
  }

  const markdown = readText(markdownPath);
  const status = readMarkdownField(markdown, "Status");
  const result = readMarkdownField(markdown, "Result");
  const independence = readMarkdownField(markdown, "Independence");
  const nextAction = readMarkdownField(markdown, "Next action");

  if (status && status !== session.status) {
    errors.push(`Session markdown status mismatch in ${markdownPath}: ${status} !== ${session.status}`);
  }
  if (result && result !== session.result) {
    errors.push(`Session markdown result mismatch in ${markdownPath}: ${result} !== ${session.result}`);
  }
  if (independence && independence !== session.independence) {
    errors.push(
      `Session markdown independence mismatch in ${markdownPath}: ${independence} !== ${session.independence}`
    );
  }
  if (nextAction && nextAction !== session.nextAction) {
    errors.push(`Session markdown nextAction mismatch in ${markdownPath}: ${nextAction} !== ${session.nextAction}`);
  }
}

function validateSessionState(trackId, sessionFile, graph, errors) {
  const session = validateJsonSchema(sessionFile.relativePath, "engine/schemas/session.schema.json", errors);
  if (!session) return null;

  if (session.trackId !== trackId) {
    errors.push(`Session track mismatch in ${sessionFile.relativePath}: ${session.trackId} !== ${trackId}`);
  }
  if (session.moduleId && !graph.moduleIds.has(session.moduleId)) {
    errors.push(`Session references missing module in ${sessionFile.relativePath}: ${session.moduleId}`);
  }
  for (const outcomeId of session.targetOutcomeIds ?? []) {
    if (!graph.outcomeIds.has(outcomeId)) {
      errors.push(`Session references missing outcome in ${sessionFile.relativePath}: ${outcomeId}`);
      continue;
    }
    const moduleId = graph.outcomeToModule.get(outcomeId);
    if (session.moduleId && moduleId !== session.moduleId) {
      errors.push(
        `Session outcome/module mismatch in ${sessionFile.relativePath}: ${outcomeId} belongs to ${moduleId}, not ${session.moduleId}`
      );
    }
  }
  if (session.status === "completed" && !["pass", "partial"].includes(session.result)) {
    errors.push(`Completed session must have pass or partial result: ${sessionFile.relativePath}`);
  }
  if (session.status === "failed" && session.result !== "fail") {
    errors.push(`Failed session must have fail result: ${sessionFile.relativePath}`);
  }
  if (["completed", "failed"].includes(session.status) && session.independence === "unknown") {
    errors.push(`Closed session must record independence: ${sessionFile.relativePath}`);
  }
  if (["completed", "failed"].includes(session.status) && session.nextAction === "continue") {
    errors.push(`Closed session cannot keep nextAction=continue: ${sessionFile.relativePath}`);
  }
  if (inProgressSessionStatuses.has(session.status) && ["pass", "partial", "fail"].includes(session.result)) {
    errors.push(`In-progress session cannot already have assessment result: ${sessionFile.relativePath}`);
  }

  validateSessionMarkdown(trackId, session, errors);
  return session;
}

function validateHandoff(trackId, trackState, currentSession, errors) {
  const handoffPath = `state/handoff/${trackId}.md`;
  if (!exists(handoffPath)) {
    errors.push(`Missing track handoff: ${handoffPath}`);
    return;
  }

  const handoff = readText(handoffPath);
  const activeSession = readMarkdownField(handoff, "Active session");
  const sessionStatus = readMarkdownField(handoff, "Session status");
  const moduleId = readMarkdownField(handoff, "Module");
  const trackNextStep = readMarkdownField(handoff, "Track nextStep");
  const expectedSession = trackState.currentSessionId ?? "none";
  const expectedModule = trackState.currentModuleId ?? "none";

  if (!activeSession) {
    errors.push(`Handoff missing Active session field: ${handoffPath}`);
  }
  if (activeSession && activeSession !== expectedSession) {
    errors.push(`Handoff active session mismatch in ${handoffPath}: ${activeSession} !== ${expectedSession}`);
  }
  if (currentSession && !sessionStatus) {
    errors.push(`Handoff missing Session status field: ${handoffPath}`);
  }
  if (moduleId && moduleId !== expectedModule) {
    errors.push(`Handoff module mismatch in ${handoffPath}: ${moduleId} !== ${expectedModule}`);
  }
  if (currentSession && sessionStatus && sessionStatus !== currentSession.status) {
    errors.push(`Handoff session status mismatch in ${handoffPath}: ${sessionStatus} !== ${currentSession.status}`);
  }
  for (const blocker of trackState.blockedBy ?? []) {
    if (!handoff.includes(blocker)) {
      errors.push(`Handoff missing blocker from track state in ${handoffPath}: ${blocker}`);
    }
  }
  if (!handoff.includes("## 下一步唯一动作")) {
    errors.push(`Handoff missing next-step section: ${handoffPath}`);
  }
  if (!trackNextStep) {
    errors.push(`Handoff missing Track nextStep field: ${handoffPath}`);
  } else if (trackNextStep !== trackState.nextStep) {
    errors.push(`Handoff nextStep mismatch in ${handoffPath}: ${trackNextStep} !== ${trackState.nextStep}`);
  }
}

function validateLearningState(errors) {
  const globalState = validateKnownSchema("state/global.json", errors);
  validateKnownSchema("state/learner.json", errors);
  if (!globalState) return;

  if (!globalState.activeTrackId && globalState.activeSessionId) {
    errors.push("Global state cannot have activeSessionId when activeTrackId is null");
  }

  let activeTrackState = null;
  let activeSession = null;
  const liveSessions = [];
  const inProgressTracks = [];

  for (const trackId of listTrackIds()) {
    const trackStatePath = `state/tracks/${trackId}.json`;
    const handoffPath = `state/handoff/${trackId}.md`;

    if (!exists(trackStatePath)) errors.push(`Missing track state: ${trackStatePath}`);
    if (!exists(handoffPath)) errors.push(`Missing track handoff: ${handoffPath}`);
    if (!exists(`sessions/${trackId}`)) errors.push(`Missing sessions directory: sessions/${trackId}`);
    if (!exists(`workspace/${trackId}`)) errors.push(`Missing workspace directory: workspace/${trackId}`);
    if (!exists(`journal/tracks/${trackId}`)) errors.push(`Missing journal directory: journal/tracks/${trackId}`);

    const graph = collectTrackGraph(trackId, errors);
    if (!graph) continue;

    const trackState = exists(trackStatePath)
      ? validateJsonSchema(trackStatePath, "engine/schemas/track-state.schema.json", errors)
      : null;
    if (trackState) {
      if (trackState.trackId !== trackId) {
        errors.push(`Track state id mismatch in ${trackStatePath}: ${trackState.trackId} !== ${trackId}`);
      }
      if (trackState.currentModuleId && !graph.moduleIds.has(trackState.currentModuleId)) {
        errors.push(`Track state references missing module in ${trackStatePath}: ${trackState.currentModuleId}`);
      }
      for (const outcomeId of Object.keys(trackState.outcomes ?? {})) {
        if (!graph.outcomeIds.has(outcomeId)) {
          errors.push(`Track state records unknown outcome in ${trackStatePath}: ${outcomeId}`);
        }
      }
      if (["active", "paused", "planned"].includes(trackState.status)) {
        inProgressTracks.push(trackId);
      }
      if (globalState.activeTrackId === trackId) {
        activeTrackState = trackState;
      }
    }

    let sessionFiles = [];
    try {
      sessionFiles = readJsonFilesInDir(`sessions/${trackId}`);
    } catch (error) {
      errors.push(error.message);
    }
    let currentSession = null;
    for (const sessionFile of sessionFiles) {
      const session = validateSessionState(trackId, sessionFile, graph, errors);
      if (!session) continue;
      if (liveSessionStatuses.has(session.status)) liveSessions.push(`${trackId}/${session.id}`);
      if (trackState?.currentSessionId === session.id) currentSession = session;
      if (globalState.activeTrackId === trackId && globalState.activeSessionId === session.id) {
        activeSession = session;
      }
    }

    if (trackState?.currentSessionId && !currentSession) {
      errors.push(`Track state currentSessionId has no session file in ${trackStatePath}: ${trackState.currentSessionId}`);
    }
    if (trackState) validateHandoff(trackId, trackState, currentSession, errors);
  }

  if (globalState.activeTrackId) {
    if (!listTrackIds().includes(globalState.activeTrackId)) {
      errors.push(`Global activeTrackId does not exist: ${globalState.activeTrackId}`);
    }
    if (!activeTrackState) {
      errors.push(`Global activeTrackId has no readable track state: ${globalState.activeTrackId}`);
    } else {
      if (activeTrackState.status !== "active") {
        errors.push(`Active track state must be active: ${globalState.activeTrackId} is ${activeTrackState.status}`);
      }
      if ((globalState.activeSessionId ?? null) !== (activeTrackState.currentSessionId ?? null)) {
        errors.push(
          `Global activeSessionId must match active track currentSessionId: ${globalState.activeSessionId ?? "null"} !== ${
            activeTrackState.currentSessionId ?? "null"
          }`
        );
      }
      if (globalState.activeSessionId && !activeSession) {
        errors.push(`Global activeSessionId has no matching session: ${globalState.activeSessionId}`);
      }
      if (activeSession && !inProgressSessionStatuses.has(activeSession.status)) {
        errors.push(`Global activeSessionId points to closed session: ${globalState.activeSessionId}`);
      }
    }
  }

  if (liveSessions.length > 1) {
    errors.push(`Only one live active/assessing session is allowed, found: ${liveSessions.join(", ")}`);
  }
  if (inProgressTracks.length > globalState.maxInProgressTracks) {
    errors.push(
      `Too many in-progress tracks: ${inProgressTracks.length} > maxInProgressTracks ${globalState.maxInProgressTracks}`
    );
  }
}

function cmdValidate() {
  const errors = [];

  for (const relativePath of requiredPaths) {
    if (!exists(relativePath)) errors.push(`Missing ${relativePath}`);
  }

  const schemaFiles = fs
    .readdirSync(rel("engine/schemas"))
    .filter((file) => file.endsWith(".json"))
    .map((file) => `engine/schemas/${file}`);

  for (const file of schemaFiles) {
    try {
      readJson(file);
    } catch (error) {
      errors.push(error.message);
    }
  }

  for (const trackId of listTrackIds()) {
    const sourcePath = `tracks/${trackId}/source/track.json`;
    if (!exists(sourcePath)) {
      errors.push(`Track ${trackId} has no source/track.json`);
      continue;
    }
    validateTrackPackage(trackId, errors);
  }
  validateLearningState(errors);

  if (errors.length) {
    console.error("Validation failed");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  console.log("Validation passed");
}

function collectValidationErrors() {
  const errors = [];

  for (const relativePath of requiredPaths) {
    if (!exists(relativePath)) errors.push(`Missing ${relativePath}`);
  }

  for (const trackId of listTrackIds()) {
    if (!exists(`tracks/${trackId}/source/track.json`)) {
      errors.push(`Track ${trackId} has no source/track.json`);
      continue;
    }
    validateTrackPackage(trackId, errors);
  }
  validateLearningState(errors);

  return errors;
}

function cmdDoctor() {
  const errors = collectValidationErrors();
  const globalState = loadGlobalState();
  console.log("Learning OS doctor");
  console.log(`- Validation: ${errors.length ? "failed" : "passed"}`);
  for (const error of errors) console.log(`  - ${error}`);
  printEnvironmentChecks();

  const insideGit = runGit(["rev-parse", "--is-inside-work-tree"]);
  if (!insideGit.ok) {
    console.log("- Git: not a repository");
    return;
  }

  const branch = runGit(["branch", "--show-current"]);
  const upstream = runGit(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"]);
  const status = runGit(["status", "--short", "--branch"]);
  console.log(`- Branch: ${branch.stdout || "unknown"}`);
  console.log(`- Upstream: ${upstream.ok ? upstream.stdout : "none"}`);
  console.log("- Git status:");
  console.log(status.stdout || "  clean");

  if (globalState.activeTrackId) {
    const trackStatePath = `state/tracks/${globalState.activeTrackId}.json`;
    if (exists(trackStatePath)) {
      const trackState = readJson(trackStatePath);
      const sessionId = globalState.activeSessionId ?? trackState.currentSessionId;
      console.log(`- Active track: ${globalState.activeTrackId}`);
      console.log(`- Track status: ${trackState.status}`);
      console.log(`- Current module: ${trackState.currentModuleId ?? "none"}`);
      console.log(`- Current session: ${sessionId ?? "none"}`);
      console.log(`- Next step: ${trackState.nextStep || "none"}`);
      if (sessionId) {
        const sessionStatePath = sessionPath(globalState.activeTrackId, sessionId, "json");
        if (exists(sessionStatePath)) {
          const session = readJson(sessionStatePath);
          console.log(`- Session status: ${session.status}`);
          if (session.status === "paused") {
            console.log("- Session note: paused current session; resume it before learning work");
          }
        } else {
          console.log(`- Session status: missing file ${sessionStatePath}`);
        }
      }
    }
  } else {
    console.log("- Active track: none");
  }
}

function cmdEnvDoctor() {
  console.log("Learning OS environment");
  const checks = collectEnvironmentChecks();
  printEnvironmentChecks(checks);

  const pnpm = checks.find((check) => check.command === "pnpm");
  if (!pnpm?.ok) {
    console.log("- pnpm note: 当前不可用。session-001 可先使用 npm fallback，或使用 corepack enable 后再启用 pnpm。");
  }
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
  writeText(`workspace/${trackId}/.gitkeep`, "");
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
        saveTrackState(previousStatePath, previousState);
      }
    }
  }

  const trackStatePath = `state/tracks/${trackId}.json`;
  const trackState = exists(trackStatePath) ? readJson(trackStatePath) : makeTrackState(trackId);
  trackState.status = "active";
  trackState.updatedAt = now();
  saveTrackState(trackStatePath, trackState);

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
  saveTrackState(trackStatePath, trackState);

  globalState.activeTrackId = null;
  globalState.activeSessionId = null;
  saveGlobalState(globalState);

  console.log(`已暂停 track：${trackState.trackId}`);
}

function cmdPauseSession() {
  const { globalState, trackId, trackStatePath, trackState } = requireActiveTrack();
  const sessionId = globalState.activeSessionId ?? trackState.currentSessionId;
  if (!sessionId) {
    console.log("当前没有 current session 可暂停");
    return;
  }

  const session = loadSessionState(trackId, sessionId);
  if (!["planned", "active", "assessing"].includes(session.status)) {
    throw new Error(`只有 planned、active 或 assessing session 可以暂停。当前状态：${session.status}`);
  }

  setSessionStatus(session, "paused");
  session.nextAction = "continue";
  saveSessionState(session);

  trackState.status = "active";
  trackState.currentSessionId = sessionId;
  trackState.nextStep = "恢复并继续当前 paused session；不要创建新 session。";
  trackState.updatedAt = now();
  saveTrackState(trackStatePath, trackState);

  globalState.activeSessionId = sessionId;
  saveGlobalState(globalState);

  console.log(`已暂停 current session：${sessionId}`);
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
  saveTrackState(trackStatePath, trackState);

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
  saveTrackState(trackStatePath, trackState);

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
  saveTrackState(trackStatePath, trackState);

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
  saveTrackState(trackStatePath, trackState);

  globalState.activeSessionId = null;
  saveGlobalState(globalState);

  console.log(`session 已结束：${sessionId} (${result}, ${independence}, ${nextAction})`);
}

function requireCurrentSession() {
  const context = requireActiveTrack();
  const sessionId = context.globalState.activeSessionId ?? context.trackState.currentSessionId;
  if (!sessionId) throw new Error("当前没有 current session。");
  return {
    ...context,
    sessionId,
    session: loadSessionState(context.trackId, sessionId)
  };
}

function cmdSaveEvidence(args) {
  const evidence = args.join(" ").trim();
  if (!evidence) throw new Error('Usage: learn save-evidence "<evidence>"');

  const { session } = requireCurrentSession();
  const line = `${now()} - ${evidence}`;
  session.evidence = [...(session.evidence ?? []), line];
  saveSessionState(session);

  const markdownPath = sessionPath(session.trackId, session.id, "md");
  if (exists(markdownPath)) {
    let markdown = readText(markdownPath);
    markdown = appendToSection(markdown, "## 当前进度", [`- 证据：${line}`]);
    markdown = appendToSection(markdown, "## 验收", [`  - ${line}`]);
    writeText(markdownPath, markdown);
  }

  console.log(`已记录 evidence：${evidence}`);
}

function cmdUpdateHandoff(args) {
  const { trackId, trackStatePath, trackState } = requireActiveTrack();
  const nextStep = args.join(" ").trim();
  if (nextStep) trackState.nextStep = nextStep;
  saveTrackState(trackStatePath, trackState);
  console.log(`已同步 handoff：${trackId}`);
}

function journalPathForTarget(trackId, target) {
  const map = new Map([
    ["concepts", `journal/tracks/${trackId}/concepts.md`],
    ["mistakes", `journal/tracks/${trackId}/mistakes.md`],
    ["questions", `journal/tracks/${trackId}/questions.md`],
    ["decisions", `journal/tracks/${trackId}/decisions.md`],
    ["global-decisions", "journal/global/decisions.md"],
    ["global-mistakes", "journal/global/mistakes.md"],
    ["cross-track-insights", "journal/global/cross-track-insights.md"]
  ]);
  return map.get(target);
}

function cmdRecordJournal(args) {
  const [target, ...textParts] = args;
  const text = textParts.join(" ").trim();
  if (!target || !text) {
    throw new Error(
      'Usage: learn record-journal <concepts|mistakes|questions|decisions|global-decisions|global-mistakes|cross-track-insights> "<text>"'
    );
  }

  const { trackId } = requireActiveTrack();
  const relativePath = journalPathForTarget(trackId, target);
  if (!relativePath) throw new Error(`Unknown journal target: ${target}`);
  if (!exists(relativePath)) throw new Error(`Missing journal file: ${relativePath}`);

  const updated = `${readText(relativePath).trimEnd()}\n\n- ${now()} - ${text}\n`;
  writeText(relativePath, updated);
  console.log(`已记录 journal：${relativePath}`);
}

function usage() {
  console.log(`Usage: npm run learn -- <command>

Commands:
  status                         查看当前学习状态
  next                           输出当前唯一下一步
  validate                       校验系统结构和 JSON 文件
  doctor                         检查跨设备同步安全状态
  env-doctor                     检查 Node/npm/pnpm/corepack/git 环境
  setup                          env-doctor 的别名
  new-track <id> "<title>"       创建一个空课程包壳
  switch <id>                    激活一个课程包
  pause                          暂停当前 active track
  pause-session                  暂停当前 session，但保持 track 为 active
  start-session <id> "<title>"   开始一个 session 状态记录
  resume-session                 恢复 paused session
  begin-assessment               将 active session 切到 assessing
  save-evidence "<text>"         给 current session 追加证据
  update-handoff ["next step"]   同步 handoff，可选更新 nextStep
  record-journal <target> "<text>"
                                  记录长期笔记
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
      case "next":
        cmdNext();
        break;
      case "validate":
        cmdValidate();
        break;
      case "doctor":
        cmdDoctor();
        break;
      case "env-doctor":
      case "setup":
        cmdEnvDoctor();
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
      case "pause-session":
        cmdPauseSession();
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
      case "save-evidence":
        cmdSaveEvidence(args);
        break;
      case "update-handoff":
        cmdUpdateHandoff(args);
        break;
      case "record-journal":
        cmdRecordJournal(args);
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
