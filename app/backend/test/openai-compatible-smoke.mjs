import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const backendPort = 8878;
const testDataDir = path.resolve("backend/data-test/openai-compatible");
fs.rmSync(testDataDir, { recursive: true, force: true });

const providerCalls = [];
const fakeProvider = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/chat/completions") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not_found" }));
    return;
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const systemPrompt = body.messages?.find((message) => message.role === "system")?.content || "";
  const schemaName = systemPrompt.match(/schema_name=([^,，\s]+)/)?.[1] || "unknown";
  providerCalls.push({
    schemaName,
    authorization: req.headers.authorization || "",
    responseFormat: body.response_format?.type,
    model: body.model
  });

  const payload = responseForSchema(schemaName);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({
    id: `fake-${schemaName}`,
    object: "chat.completion",
    choices: [
      {
        index: 0,
        message: {
          role: "assistant",
          content: JSON.stringify(payload)
        },
        finish_reason: "stop"
      }
    ]
  }));
});

await new Promise((resolve) => fakeProvider.listen(0, "127.0.0.1", resolve));
const providerPort = fakeProvider.address().port;

const child = spawn(process.execPath, ["backend/src/server.mjs"], {
  cwd: new URL("../..", import.meta.url),
  env: {
    ...process.env,
    BACKEND_PORT: String(backendPort),
    APP_BASE_PATH: "/agent-roundtable-studio",
    DATA_DIR: "./backend/data-test/openai-compatible",
    AI_RUNTIME: "openai",
    OPENAI_BASE_URL: `http://127.0.0.1:${providerPort}`,
    OPENAI_API_MODE: "chat_completions",
    OPENAI_API_KEY: "test-compatible-token",
    OPENAI_MODEL: "qwen-compatible-test",
    OPENAI_TIMEOUT_MS: "5000",
    OPENAI_MAX_RETRIES: "0"
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
      const response = await fetch(`http://127.0.0.1:${backendPort}/health`);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }
  throw new Error(`Backend did not start. Output:\n${output}`);
}

async function post(route, body = {}) {
  const response = await fetch(`http://127.0.0.1:${backendPort}${route}`, {
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
  const response = await fetch(`http://127.0.0.1:${backendPort}${route}`);
  if (!response.ok) {
    throw new Error(`${route} failed: ${response.status} ${await response.text()}`);
  }
  return response.json();
}

function responseForSchema(schemaName) {
  if (schemaName === "task_profile_enrichment") {
    return {
      task_type: "第三方兼容 API 增强任务画像",
      risk_level: "high",
      required_perspectives: ["产品", "财务审计", "医疗合规"],
      evidence_needs: ["模型兼容调用记录", "自动补位 Agent 记录"],
      assumptions: ["第三方兼容服务返回 JSON object"],
      constraints: ["不得将真实 API Key 写入仓库"]
    };
  }

  if (schemaName === "agent_panel_review") {
    return {
      panel_summary: "第三方兼容 API 已复核阵容，建议保留自动补位 Agent 并标记为个人试用。",
      risks: ["财务审计和医疗合规需要明确证据边界"],
      missing_expertise: [],
      selection_notes: ["自动补位 Agent 只能用于当前用户任务"]
    };
  }

  if (schemaName === "roundtable_report_polish") {
    return {
      executive_summary: "第三方兼容 API 已复核报告，当前结论可作为条件性评审输出。",
      quality_score: "7/10",
      high_risk_gaps: ["真实供应商模型稳定性仍需上线前压测"],
      next_actions: ["用真实供应商 Key 在服务器环境变量中完成一次受控验证"]
    };
  }

  return {};
}

try {
  await waitForServer();

  const health = await get("/health");
  if (!health.openaiConfigured || health.runtime !== "openai") {
    throw new Error("Backend did not start in configured openai runtime mode.");
  }

  const created = await post("/api/sessions", {
    problem: "验证阿里云百炼 OpenAI-compatible API 接入：系统应自动组建圆桌，不足时生成个人 Agent，并展示第三方 API 阵容复核。",
    background: "本测试使用本地假兼容服务，不访问真实供应商，不包含真实 Key。",
    targetOutput: "兼容 API 集成验收报告"
  });

  if (created.session.task_profile.ai_enrichment?.status !== "applied") {
    throw new Error("Task profile AI enrichment was not applied.");
  }
  if (!created.session.recommendation?.ai_review || created.session.recommendation.ai_review.status !== "applied") {
    throw new Error("Agent panel AI review was not applied.");
  }
  if (!created.session.recommendation.assembly_trace.some((item) => item.stage === "ai_panel_review")) {
    throw new Error("AI panel review stage missing from assembly trace.");
  }
  if (!created.session.recommendation.generated_agents?.length) {
    throw new Error("Expected generated personal agents for third-party enriched perspectives.");
  }

  const result = await post(`/api/sessions/${created.session.session_id}/run`);
  if (result.session.status !== "complete") {
    throw new Error(`Expected complete session, got ${result.session.status}`);
  }
  if (result.artifact.ai_review?.status !== "applied") {
    throw new Error("Roundtable report AI review was not applied.");
  }
  if (!result.artifact.markdown.includes("第三方 API 复核摘要")) {
    throw new Error("Final report does not include third-party API appendix.");
  }

  const schemas = providerCalls.map((call) => call.schemaName);
  for (const expected of ["task_profile_enrichment", "agent_panel_review", "roundtable_report_polish"]) {
    if (!schemas.includes(expected)) throw new Error(`Provider call missing: ${expected}`);
  }
  if (!providerCalls.every((call) => call.responseFormat === "json_object")) {
    throw new Error("Chat completions requests did not require JSON object responses.");
  }
  if (!providerCalls.every((call) => call.authorization === "Bearer test-compatible-token")) {
    throw new Error("Authorization header was not sent to compatible provider.");
  }

  console.log("OpenAI-compatible smoke passed:", created.session.session_id, `${providerCalls.length} provider calls`);
} finally {
  child.kill();
  fakeProvider.close();
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 1000))
  ]);
}
