#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1}"
export BASE_URL
CURL_TLS_ARGS=()
if [[ "${BASE_URL}" == https://* ]]; then
  CURL_TLS_ARGS=(-k)
  export NODE_TLS_REJECT_UNAUTHORIZED=0
fi

curl --noproxy "*" "${CURL_TLS_ARGS[@]}" -fsS "${BASE_URL}/health" >/tmp/ars-health.json
curl --noproxy "*" "${CURL_TLS_ARGS[@]}" -fsS "${BASE_URL}/" >/tmp/ars-index.html

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

async function get(path) {
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) throw new Error(`${path} failed: ${response.status} ${await response.text()}`);
  return response.json();
}

const created = await post("/api/sessions", {
  problem: "线上烟测：医疗健康产品上线评审，使用者不知道需要哪些智能体，系统必须自动组建圆桌并补齐合规和行业专家。",
  background: "使用 simulated runtime，不依赖真实模型 Key；验收自动组建过程、结构化事件和最终报告。",
  targetOutput: "线上真实流程烟测报告"
});
if (!created.session?.recommendation?.assembly_trace?.length) {
  throw new Error("Assembly trace missing from recommendation.");
}
if (!created.session?.agent_panel?.every((agent) => agent.selection_source)) {
  throw new Error("Agent selection source missing.");
}
if (!created.session?.task_profile?.required_perspectives?.includes("合规")) {
  throw new Error("Compliance perspective was not detected.");
}
if (!created.session?.task_profile?.required_perspectives?.includes("行业专家")) {
  throw new Error("Industry expert perspective was not detected.");
}

const result = await post(`/api/sessions/${created.session.session_id}/run`);
if (result.session.status !== "complete") {
  throw new Error(`Expected complete, got ${result.session.status}`);
}
if (!result.events?.some((event) => event.event_type === "challenge")) {
  throw new Error("Challenge event missing.");
}
if (!result.events?.some((event) => event.event_type === "consensus")) {
  throw new Error("Consensus event missing.");
}
if (!result.artifact?.markdown?.includes("圆桌评审报告")) {
  throw new Error("Final report markdown missing.");
}
if (!result.artifact.markdown.includes("主要质疑")) {
  throw new Error("Final report does not include challenge section.");
}

const detail = await get(`/api/sessions/${created.session.session_id}`);
if (!detail.events?.length || !detail.artifacts?.length) {
  throw new Error("Stored session detail missing events or artifacts.");
}

console.log("Remote smoke passed:", created.session.session_id, `${result.events.length} events`);
NODE
