import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";

const port = 8877;
const testDataDir = path.resolve("backend/data-test");
fs.rmSync(testDataDir, { recursive: true, force: true });

const child = spawn(process.execPath, ["backend/src/server.mjs"], {
  cwd: new URL("../..", import.meta.url),
  env: {
    ...process.env,
    BACKEND_PORT: String(port),
    APP_BASE_PATH: "/agent-roundtable-studio",
    DATA_DIR: "./backend/data-test",
    AI_RUNTIME: "simulated"
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", (chunk) => {
  output += chunk.toString();
});
child.stderr.on("data", (chunk) => {
  output += chunk.toString();
});

async function waitForServer() {
  const deadline = Date.now() + 8000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`Backend did not start. Output:\n${output}`);
}

async function post(route, body = {}) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    throw new Error(`${route} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function get(route) {
  const response = await fetch(`http://127.0.0.1:${port}${route}`);
  if (!response.ok) {
    throw new Error(`${route} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

async function runSample(sample) {
  const created = await post("/api/sessions", sample);
  if (!created.session?.session_id) throw new Error("Session id missing");
  if (!created.session.task_profile?.required_perspectives?.length) {
    throw new Error("Task profile perspectives missing");
  }

  const result = await post(`/api/sessions/${created.session.session_id}/run`);
  if (!result.events?.length) throw new Error("Trace events missing");
  if (!result.artifact?.markdown) throw new Error("Final report missing");
  if (result.session.status !== "complete") {
    throw new Error(`Expected complete session, got ${result.session.status}`);
  }

  const exported = await get(`/api/export/sessions/${created.session.session_id}`);
  if (!exported.events?.some((event) => event.event_type === "consensus")) {
    throw new Error("Export does not include consensus event");
  }

  return result;
}

async function main() {
  await waitForServer();

  const health = await get("/health");
  if (!health.ok) throw new Error("Health check failed");

  const appShell = await fetch(`http://127.0.0.1:${port}/`);
  if (!appShell.ok || !(await appShell.text()).includes("Agent Roundtable")) {
    throw new Error("Static app shell is not served from root");
  }

  const prefixedHealth = await fetch(`http://127.0.0.1:${port}/agent-roundtable-studio/health`);
  if (!prefixedHealth.ok) throw new Error("Prefixed health check failed");

  const prefixedAppShell = await fetch(`http://127.0.0.1:${port}/agent-roundtable-studio/`);
  if (!prefixedAppShell.ok || !(await prefixedAppShell.text()).includes("Agent Roundtable")) {
    throw new Error("Static app shell is not served from app base path");
  }

  const samples = [
    {
      problem: "首期 Web 版前后端分离开发并部署到华为云，如何保证圆桌讨论可追溯？",
      background: "需要任务画像、Agent 推荐、结构化事件和报告。",
      targetOutput: "评审报告"
    },
    {
      problem: "用户提出新员工诉求时，系统如何先匹配已有 Agent，不足时生成个人 Agent 草稿？",
      background: "Agent 分为基础公共、个人、共享三类，个人 Agent 可记录为共享 Agent。",
      targetOutput: "产品流程评审"
    },
    {
      problem: "部门同事未来在云端共用这个应用时，权限、隐私和共享边界如何控制？",
      background: "首期单用户，但要保留云端部门版扩展边界。",
      targetOutput: "安全与权限评审"
    }
  ];

  for (const sample of samples) {
    await runSample(sample);
  }

  const request = await post("/api/agents/request", {
    requestText: "我需要一个医疗合规评审 Agent，检查健康数据、授权和宣传边界。"
  });
  if (request.mode !== "created_personal_draft") {
    throw new Error(`Expected personal draft, got ${request.mode}`);
  }

  const share = await post(`/api/agents/${request.draft.agent_id}/share`, {
    sensitiveDataWarningAcknowledged: true,
    notes: "Smoke test share record"
  });
  if (share.agent.agent_class !== "shared_public") {
    throw new Error("Shared agent state was not recorded");
  }
  if (!share.shareRecord?.share_record_id) {
    throw new Error("Share record missing");
  }

  const policyAllow = await post("/api/policy/evaluate", {
    resource_type: "tool",
    action: "roundtable_runtime",
    actor_type: "system"
  });
  if (policyAllow.policyDecision.result !== "allow") {
    throw new Error("Policy allow decision failed");
  }

  const policyDeny = await post("/api/policy/evaluate", {
    resource_type: "file",
    action: "delete",
    actor_type: "agent"
  });
  if (policyDeny.policyDecision.result !== "deny") {
    throw new Error("Policy deny decision failed");
  }

  const partialCreated = await post("/api/sessions", {
    problem: "[partial] 模拟失败：验证不完整圆桌是否标记为 partial 而不是 complete。",
    background: "这是上线前失败处理验收。",
    targetOutput: "失败处理验收"
  });
  const partialResult = await post(`/api/sessions/${partialCreated.session.session_id}/run`);
  if (partialResult.session.status !== "partial") {
    throw new Error(`Expected partial session, got ${partialResult.session.status}`);
  }
  if (partialResult.session.completed_at) {
    throw new Error("Partial session must not have completed_at");
  }

  const store = JSON.parse(fs.readFileSync(path.join(testDataDir, "store.json"), "utf8"));
  if ((store.meta.schema_version || 0) < 3) {
    throw new Error("Migration did not set current schema version");
  }
  if (!store.meta.migrations_applied?.length) {
    throw new Error("Migration ledger missing");
  }

  console.log("Smoke test passed: 3 samples, shared agent, policy gateway, partial run, migrations");
}

try {
  await main();
} finally {
  child.kill();
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 1000))
  ]);
}
