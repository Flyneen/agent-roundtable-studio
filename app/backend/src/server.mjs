import http from "node:http";
import { URL } from "node:url";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadConfig } from "./config.mjs";
import { JsonStore } from "./store.mjs";
import {
  createPersonalAgentDraft,
  generateTaskProfile,
  recommendAgents,
  runRoundtable
} from "./runtime/simulatedRuntime.mjs";
import { OpenAIAdapter } from "./runtime/openaiAdapter.mjs";
import { evaluatePolicyRequest } from "./policyGateway.mjs";

const config = loadConfig();
const store = new JsonStore(config);
store.init();
const openai = new OpenAIAdapter(config);

function sendJson(res, status, payload, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, status, text, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    ...headers
  });
  res.end(text);
}

function corsHeaders(req) {
  const origin = req.headers.origin;
  const allowed = origin && config.allowedOrigins.includes(origin) ? origin : config.allowedOrigins[0] || "*";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Request-Id",
    "Access-Control-Max-Age": "86400"
  };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

function requireText(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    const error = new Error(`${field} is required`);
    error.status = 422;
    throw error;
  }
  return value.trim();
}

function createSession(body) {
  const problem = requireText(body.problem, "problem");
  const targetOutput = body.targetOutput || "评审报告";
  const taskProfile = generateTaskProfile({
    problem,
    background: body.background || "",
    targetOutput
  }, store);

  const agents = store.list("agents");
  const recommendation = recommendAgents(taskProfile, agents, store);
  const session = {
    session_id: store.newId("session"),
    run_id: store.newId("run"),
    status: "draft",
    current_stage: "agent_panel_recommended",
    problem,
    background: body.background || "",
    task_profile: taskProfile,
    agent_panel: recommendation.recommended_agents,
    recommendation,
    trace_event_ids: [],
    artifact_ids: [],
    runtime_mode: config.aiRuntime,
    created_at: new Date().toISOString()
  };

  return store.insert("sessions", session);
}

async function route(req, res) {
  const requestId = req.headers["x-request-id"] || randomUUID();
  const headers = {
    ...corsHeaders(req),
    "X-Request-Id": requestId
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, headers);
    res.end();
    return;
  }

  const url = new URL(req.url || "/", `http://${req.headers.host}`);
  const pathname = url.pathname;

  try {
    if (req.method === "GET" && pathname === "/health") {
      return sendJson(res, 200, {
        ok: true,
        service: "agent-roundtable-studio-backend",
        runtime: config.aiRuntime,
        openaiConfigured: openai.isConfigured(),
        timestamp: new Date().toISOString()
      }, headers);
    }

    if (pathname === "/api/settings" && req.method === "GET") {
      return sendJson(res, 200, {
        appEnv: config.appEnv,
        aiRuntime: config.aiRuntime,
        openaiConfigured: openai.isConfigured(),
        dataStore: "json"
      }, headers);
    }

    if (pathname === "/api/agents" && req.method === "GET") {
      const agentClass = url.searchParams.get("class");
      const agents = store.list("agents")
        .filter((agent) => !agentClass || agent.agent_class === agentClass);
      return sendJson(res, 200, { agents }, headers);
    }

    const shareMatch = pathname.match(/^\/api\/agents\/([^/]+)\/share$/);
    if (shareMatch && req.method === "POST") {
      const body = await readJson(req);
      const agent = store.get("agents", "agent_id", shareMatch[1]);
      if (!agent) return sendJson(res, 404, { error: "agent_not_found" }, headers);
      if (agent.agent_class === "system_public") {
        const error = new Error("System public agents are already shared.");
        error.status = 409;
        throw error;
      }

      const shareRecord = store.insert("share_records", {
        share_record_id: store.newId("share"),
        agent_id: agent.agent_id,
        requested_by: body.requestedBy || agent.owner_user_id || "local-user",
        from_visibility_scope: agent.visibility_scope,
        to_visibility_scope: "all_users",
        review_status: "recorded_for_mvp",
        sensitive_data_warning_acknowledged: Boolean(body.sensitiveDataWarningAcknowledged),
        notes: body.notes || "",
        created_at: new Date().toISOString()
      });

      const updatedAgent = store.update("agents", "agent_id", agent.agent_id, {
        agent_class: "shared_public",
        visibility_scope: "all_users",
        publish_status: "shared_recorded",
        share_state: "shared",
        default_pool_eligible: agent.trust_status === "official_verified"
      });

      return sendJson(res, 200, { agent: updatedAgent, shareRecord }, headers);
    }

    if (pathname === "/api/agents/request" && req.method === "POST") {
      const body = await readJson(req);
      const requestText = requireText(body.requestText, "requestText");
      const result = createPersonalAgentDraft(requestText, store.list("agents"), store);
      return sendJson(res, result.mode === "created_personal_draft" ? 201 : 200, result, headers);
    }

    if (pathname === "/api/task-profiles" && req.method === "POST") {
      const body = await readJson(req);
      const problem = requireText(body.problem, "problem");
      const taskProfile = generateTaskProfile({
        problem,
        background: body.background || "",
        targetOutput: body.targetOutput || "评审报告"
      }, store);
      return sendJson(res, 201, { taskProfile }, headers);
    }

    if (pathname === "/api/policy/evaluate" && req.method === "POST") {
      const body = await readJson(req);
      const policyDecision = evaluatePolicyRequest(body);
      store.insert("policy_decisions", policyDecision);
      return sendJson(res, 200, { policyDecision }, headers);
    }

    if (pathname === "/api/sessions" && req.method === "GET") {
      const sessions = store.list("sessions").map((session) => ({
        session_id: session.session_id,
        status: session.status,
        current_stage: session.current_stage,
        problem: session.problem,
        created_at: session.created_at,
        completed_at: session.completed_at
      }));
      return sendJson(res, 200, { sessions }, headers);
    }

    if (pathname === "/api/sessions" && req.method === "POST") {
      const body = await readJson(req);
      const session = createSession(body);
      return sendJson(res, 201, { session }, headers);
    }

    const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/);
    if (sessionMatch && req.method === "GET") {
      const session = store.get("sessions", "session_id", sessionMatch[1]);
      if (!session) return sendJson(res, 404, { error: "session_not_found" }, headers);
      const events = store.list("trace_events").filter((event) => event.session_id === session.session_id);
      const artifacts = store.list("artifacts").filter((artifact) => artifact.session_id === session.session_id);
      return sendJson(res, 200, { session, events, artifacts }, headers);
    }

    const runMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/run$/);
    if (runMatch && req.method === "POST") {
      const session = store.get("sessions", "session_id", runMatch[1]);
      if (!session) return sendJson(res, 404, { error: "session_not_found" }, headers);
      if (session.status === "complete") {
        const events = store.list("trace_events").filter((event) => event.session_id === session.session_id);
        const artifacts = store.list("artifacts").filter((artifact) => artifact.session_id === session.session_id);
        return sendJson(res, 200, { session, events, artifacts, alreadyComplete: true }, headers);
      }
      const result = runRoundtable(session, store);
      return sendJson(res, 200, result, headers);
    }

    const exportMatch = pathname.match(/^\/api\/export\/sessions\/([^/]+)$/);
    if (exportMatch && req.method === "GET") {
      const session = store.get("sessions", "session_id", exportMatch[1]);
      if (!session) return sendJson(res, 404, { error: "session_not_found" }, headers);
      const events = store.list("trace_events").filter((event) => event.session_id === session.session_id);
      const artifacts = store.list("artifacts").filter((artifact) => artifact.session_id === session.session_id);
      return sendJson(res, 200, { session, events, artifacts }, {
        ...headers,
        "Content-Disposition": `attachment; filename="${session.session_id}.json"`
      });
    }

    return sendText(res, 404, "Not found", headers);
  } catch (error) {
    const status = error.status || 500;
    console.error(JSON.stringify({
      level: "error",
      requestId,
      method: req.method,
      path: pathname,
      message: error.message
    }));
    return sendJson(res, status, {
      error: status >= 500 ? "internal_error" : "request_error",
      message: error.message,
      requestId
    }, headers);
  }
}

export function createServer() {
  return http.createServer(route);
}

const isMainModule = process.argv[1]
  ? path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
  : false;

if (isMainModule) {
  const server = createServer();
  server.listen(config.port, config.host, () => {
    console.log(`Agent Roundtable Studio backend listening on http://${config.host}:${config.port}`);
  });
}
