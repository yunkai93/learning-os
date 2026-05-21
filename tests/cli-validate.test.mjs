import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(testDir, "..");
const cliPath = path.join(repoRoot, "engine/cli/learn.mjs");

function makeFixture() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "learning-os-test-"));
  fs.cpSync(repoRoot, fixtureRoot, {
    recursive: true,
    filter(source) {
      const relative = path.relative(repoRoot, source);
      if (!relative) return true;
      return !relative.startsWith(".git") && !relative.startsWith("node_modules");
    }
  });
  return fixtureRoot;
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(root, relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function runCli(root, args) {
  try {
    const stdout = execFileSync(process.execPath, [cliPath, ...args], {
      cwd: repoRoot,
      encoding: "utf8",
      env: {
        ...process.env,
        LEARNING_OS_ROOT: root
      },
      stdio: ["ignore", "pipe", "pipe"]
    });
    return { ok: true, output: stdout };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`
    };
  }
}

test("validate passes on the current repository fixture", () => {
  const fixture = makeFixture();
  const result = runCli(fixture, ["validate"]);
  assert.equal(result.ok, true, result.output);
  assert.match(result.output, /Validation passed/);
});

test("validate catches global and track current session drift", () => {
  const fixture = makeFixture();
  const globalState = readJson(fixture, "state/global.json");
  globalState.activeSessionId = "session-missing";
  writeJson(fixture, "state/global.json", globalState);

  const result = runCli(fixture, ["validate"]);
  assert.equal(result.ok, false);
  assert.match(result.output, /Global activeSessionId must match active track currentSessionId/);
});

test("validate catches stale handoff next step", () => {
  const fixture = makeFixture();
  const handoffPath = path.join(fixture, "state/handoff/fullstack-learning-system.md");
  const handoff = fs.readFileSync(handoffPath, "utf8");
  fs.writeFileSync(
    handoffPath,
    handoff.replace(/^- Track nextStep: .+$/m, "- Track nextStep: 错误的下一步")
  );

  const result = runCli(fixture, ["validate"]);
  assert.equal(result.ok, false);
  assert.match(result.output, /Handoff nextStep mismatch/);
});

test("validate catches session outcome references outside the track source", () => {
  const fixture = makeFixture();
  const session = readJson(fixture, "sessions/fullstack-learning-system/session-001.json");
  session.targetOutcomeIds.push("o999-missing");
  writeJson(fixture, "sessions/fullstack-learning-system/session-001.json", session);

  const result = runCli(fixture, ["validate"]);
  assert.equal(result.ok, false);
  assert.match(result.output, /Session references missing outcome/);
});

test("validate catches closed sessions still attached to current session pointer", () => {
  const fixture = makeFixture();
  const session = readJson(fixture, "sessions/fullstack-learning-system/session-001.json");
  session.status = "completed";
  session.result = "pass";
  session.independence = "solo";
  session.nextAction = "advance";
  writeJson(fixture, "sessions/fullstack-learning-system/session-001.json", session);

  const result = runCli(fixture, ["validate"]);
  assert.equal(result.ok, false);
  assert.match(result.output, /Global activeSessionId points to closed session/);
});

test("update-handoff synchronizes track nextStep and keeps validate green", () => {
  const fixture = makeFixture();
  const nextStep = "测试下一步：保持 current session 并继续。";
  const update = runCli(fixture, ["update-handoff", nextStep]);
  assert.equal(update.ok, true, update.output);

  const handoff = fs.readFileSync(
    path.join(fixture, "state/handoff/fullstack-learning-system.md"),
    "utf8"
  );
  assert.match(handoff, new RegExp(`- Track nextStep: ${nextStep}`));
  assert.match(handoff, new RegExp(`## 下一步唯一动作\\n\\n- ${nextStep}`));

  const validate = runCli(fixture, ["validate"]);
  assert.equal(validate.ok, true, validate.output);
});

test("env-doctor reports unavailable tools without crashing", () => {
  const fixture = makeFixture();
  const result = runCli(fixture, ["env-doctor"]);
  assert.equal(result.ok, true, result.output);
  assert.match(result.output, /Learning OS environment/);
  assert.match(result.output, /node:/);
  assert.match(result.output, /pnpm:/);
});

test("save-evidence appends current session evidence and keeps validate green", () => {
  const fixture = makeFixture();
  const result = runCli(fixture, ["save-evidence", "测试证据：node -v => vX"]);
  assert.equal(result.ok, true, result.output);

  const session = readJson(fixture, "sessions/fullstack-learning-system/session-001.json");
  assert.ok(session.evidence.some((item) => item.includes("测试证据：node -v => vX")));

  const validate = runCli(fixture, ["validate"]);
  assert.equal(validate.ok, true, validate.output);
});

test("record-journal appends track journal entries", () => {
  const fixture = makeFixture();
  const result = runCli(fixture, ["record-journal", "questions", "测试问题：这里应该记录到课程包 questions"]);
  assert.equal(result.ok, true, result.output);

  const questions = fs.readFileSync(
    path.join(fixture, "journal/tracks/fullstack-learning-system/questions.md"),
    "utf8"
  );
  assert.match(questions, /测试问题：这里应该记录到课程包 questions/);
});
