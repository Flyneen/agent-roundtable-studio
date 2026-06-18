#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1}"
export BASE_URL

curl --noproxy "*" -fsS "${BASE_URL}/health" >/tmp/ars-health.json
curl --noproxy "*" -fsS "${BASE_URL}/" >/tmp/ars-index.html

if ! grep -q "Agent Roundtable" /tmp/ars-index.html; then
  echo "Frontend smoke check failed: app shell not found." >&2
  exit 1
fi

node --input-type=module <<'NODE'
const baseUrl = process.env.BASE_URL || "http://127.0.0.1";
async function post(path, body = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

const created = await post("/api/sessions", {
  problem: "线上烟测：验证部署后的圆桌流程是否可以生成追溯报告。",
  background: "使用 simulated runtime，不依赖真实模型 Key。",
  targetOutput: "线上烟测报告"
});
const result = await post(`/api/sessions/${created.session.session_id}/run`);
if (result.session.status !== "complete") {
  throw new Error(`Expected complete, got ${result.session.status}`);
}
if (!result.artifact?.markdown?.includes("圆桌评审报告")) {
  throw new Error("Final report markdown missing.");
}
console.log("Remote smoke passed:", created.session.session_id);
NODE
