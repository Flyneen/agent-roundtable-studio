import { spawn } from "node:child_process";
import { once } from "node:events";

const port = 8877;
const child = spawn(process.execPath, ["backend/src/server.mjs"], {
  cwd: new URL("../..", import.meta.url),
  env: {
    ...process.env,
    BACKEND_PORT: String(port),
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

async function main() {
  await waitForServer();

  const create = await fetch(`http://127.0.0.1:${port}/api/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      problem: "首期 Web 版前后端分离开发并部署到华为云，如何保证圆桌讨论可追溯？",
      background: "需要任务画像、Agent 推荐、结构化事件和报告。",
      targetOutput: "评审报告"
    })
  });

  if (!create.ok) throw new Error(`Create session failed: ${create.status}`);
  const created = await create.json();
  if (!created.session?.session_id) throw new Error("Session id missing");

  const run = await fetch(`http://127.0.0.1:${port}/api/sessions/${created.session.session_id}/run`, {
    method: "POST"
  });
  if (!run.ok) throw new Error(`Run session failed: ${run.status}`);
  const result = await run.json();
  if (!result.events?.length) throw new Error("Trace events missing");
  if (!result.artifact?.markdown) throw new Error("Final report missing");

  const request = await fetch(`http://127.0.0.1:${port}/api/agents/request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requestText: "我需要一个医疗合规评审 Agent，检查健康数据、授权和宣传边界。"
    })
  });
  if (!request.ok) throw new Error(`Agent request failed: ${request.status}`);

  console.log("Smoke test passed");
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
