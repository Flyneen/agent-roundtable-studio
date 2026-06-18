import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import path from "node:path";

const gatewayPort = 8891;
const orchestratorPort = 8890;
const dataDir = path.resolve("backend-java/test-data/microservice-smoke");
fs.rmSync(dataDir, { recursive: true, force: true });
fs.mkdirSync(dataDir, { recursive: true });

const orchestrator = spawn("python", ["ai-orchestrator-python/src/orchestrator.py"], {
  cwd: new URL("../..", import.meta.url),
  env: {
    ...process.env,
    APP_ENV: "test",
    AI_RUNTIME: "dev",
    ORCHESTRATOR_HOST: "127.0.0.1",
    ORCHESTRATOR_PORT: String(orchestratorPort),
    DATA_DIR: dataDir
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let orchestratorOutput = "";
orchestrator.stdout.on("data", (chunk) => { orchestratorOutput += chunk.toString(); });
orchestrator.stderr.on("data", (chunk) => { orchestratorOutput += chunk.toString(); });

await waitForUrl(`http://127.0.0.1:${orchestratorPort}/health`, "orchestrator", () => orchestratorOutput);
console.log("orchestrator ready");

await compileJava();
console.log("java compiled");

const gateway = spawn("java", ["-cp", "backend-java/build/classes", "com.ars.AgentRoundtableGateway"], {
  cwd: new URL("../..", import.meta.url),
  env: {
    ...process.env,
    BACKEND_HOST: "127.0.0.1",
    BACKEND_PORT: String(gatewayPort),
    APP_BASE_PATH: "",
    STATIC_ROOT: "./frontend/dist",
    AI_ORCHESTRATOR_URL: `http://127.0.0.1:${orchestratorPort}`
  },
  stdio: ["ignore", "pipe", "pipe"]
});

let gatewayOutput = "";
gateway.stdout.on("data", (chunk) => { gatewayOutput += chunk.toString(); });
gateway.stderr.on("data", (chunk) => { gatewayOutput += chunk.toString(); });

try {
  await waitForUrl(`http://127.0.0.1:${gatewayPort}/health`, "java gateway", () => gatewayOutput);
  console.log("java gateway ready");

  const health = await get("/health");
  if (!health.ok || health.architecture !== "java-api-gateway-python-ai-orchestrator") {
    throw new Error(`Unexpected gateway health: ${JSON.stringify(health)}`);
  }

  const settings = await get("/api/settings");
  if (settings.architecture !== "java-api-gateway-python-ai-orchestrator") {
    throw new Error("Settings did not report microservice architecture.");
  }

  console.log("creating education session");
  const created = await post("/api/sessions", {
    problem: "如何将 AI 赋能到英语教学当中，尤其是硬件条件比较弱的初中学校？",
    background: "初中、英语、论文；系统必须自动判断需要哪些智能体，不能靠用户手选。",
    targetOutput: "教育场景落地方案"
  });

  const perspectives = created.session.task_profile.required_perspectives || [];
  for (const expected of ["教学设计", "学习评估", "学校落地"]) {
    if (!perspectives.includes(expected)) {
      throw new Error(`Expected perspective missing: ${expected}. Got ${perspectives.join(", ")}`);
    }
  }
  if (!created.session.recommendation.assembly_trace?.some((step) => step.stage === "agent_selector_agent")) {
    throw new Error("Agent selector trace missing.");
  }
  if (!created.session.agent_panel?.some((agent) => agent.display_name.includes("Instructional"))) {
    throw new Error("Instructional design agent was not selected.");
  }

  console.log("running roundtable");
  const result = await post(`/api/sessions/${created.session.session_id}/run`);
  const eventTypes = new Set((result.events || []).map((event) => event.event_type));
  for (const expected of ["position", "challenge", "response", "revision", "consensus", "evidence_gap"]) {
    if (!eventTypes.has(expected)) throw new Error(`Roundtable event missing: ${expected}`);
  }
  if (!result.artifact?.markdown?.includes("圆桌评审报告")) {
    throw new Error("Final report markdown missing.");
  }

  console.log("Microservice smoke passed:", created.session.session_id, `${result.events.length} events`);
} finally {
  await terminateProcess(gateway);
  await terminateProcess(orchestrator);
}

async function compileJava() {
  fs.mkdirSync("backend-java/build/classes", { recursive: true });
  const sources = collectJavaSources("backend-java/src/main/java");
  const child = spawn("javac", ["-encoding", "UTF-8", "-d", "backend-java/build/classes", ...sources], {
    cwd: new URL("../..", import.meta.url),
    stdio: ["ignore", "pipe", "pipe"]
  });
  let output = "";
  child.stdout.on("data", (chunk) => { output += chunk.toString(); });
  child.stderr.on("data", (chunk) => { output += chunk.toString(); });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error(`javac failed:\n${output}`);
}

function collectJavaSources(dir) {
  const result = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...collectJavaSources(full));
    if (entry.isFile() && entry.name.endsWith(".java")) result.push(full);
  }
  return result;
}

async function waitForUrl(url, label, output) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  throw new Error(`${label} did not start. Output:\n${output()}`);
}

async function post(route, body = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`http://127.0.0.1:${gatewayPort}${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal
    });
    if (!response.ok) throw new Error(`${route} failed: ${response.status} ${await response.text()}`);
    return response.json();
  } finally {
    clearTimeout(timer);
  }
}

async function get(route) {
  const response = await fetch(`http://127.0.0.1:${gatewayPort}${route}`);
  if (!response.ok) throw new Error(`${route} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

async function terminateProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
  await Promise.race([
    once(child, "exit"),
    new Promise((resolve) => setTimeout(resolve, 2000))
  ]);
}
