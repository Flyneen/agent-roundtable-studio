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
  problem: "线上烟测：如何让 AI 赋能英语教学真正落地到学校场景，而不是停留在演示页？",
  background: "需要系统自动判断所需智能体，补齐教学设计、学习评估、学校落地和隐私边界视角，并展示真实质疑过程。",
  targetOutput: "教育场景圆桌报告"
});
if (!created.session?.recommendation?.assembly_trace?.length) {
  throw new Error("Assembly trace missing from recommendation.");
}
if (!created.session?.agent_panel?.every((agent) => agent.selection_source)) {
  throw new Error("Agent selection source missing.");
}
if (!created.session?.task_profile?.required_perspectives?.some((item) => item.includes("教育"))) {
  throw new Error("Education perspective was not detected.");
}
if (!created.session?.task_profile?.required_perspectives?.includes("教学设计")) {
  throw new Error("Instructional design perspective was not detected.");
}
if (!created.session?.task_profile?.required_perspectives?.includes("学习评估")) {
  throw new Error("Learning assessment perspective was not detected.");
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
if (!/主要质疑|关键质疑/.test(result.artifact.markdown)) {
  throw new Error("Final report does not include challenge section.");
}

const detail = await get(`/api/sessions/${created.session.session_id}`);
if (!detail.events?.length || !detail.artifacts?.length) {
  throw new Error("Stored session detail missing events or artifacts.");
}

console.log("Remote smoke passed:", created.session.session_id, `${result.events.length} events`);
NODE
