const APP_BASE_PATH = inferAppBasePath();
const API_BASE = localStorage.getItem("ars_api_base") || inferApiBase();

const state = {
  currentSession: null,
  events: [],
  artifacts: [],
  agents: []
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.remove("hidden");
  setTimeout(() => el.classList.add("hidden"), 2600);
}

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!response.ok) {
    let message = `${response.status} ${response.statusText}`;
    try {
      const data = await response.json();
      message = data.message || message;
    } catch {
      // keep default
    }
    throw new Error(message);
  }
  return response.json();
}

function inferAppBasePath() {
  const marker = "/agent-roundtable-studio";
  return window.location.pathname.startsWith(marker) ? marker : "";
}

function inferApiBase() {
  const isLocalDev = ["127.0.0.1", "localhost"].includes(window.location.hostname)
    && ["5173", "5174", ""].includes(window.location.port);
  if (isLocalDev && !APP_BASE_PATH) {
    return "http://127.0.0.1:8787";
  }
  return `${window.location.origin}${APP_BASE_PATH}`;
}

function setView(viewId) {
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === viewId));
  $$(".view").forEach((view) => view.classList.toggle("active", view.id === viewId));
}

function renderTaskProfile(profile) {
  $("#taskProfile").classList.remove("empty");
  $("#taskProfile").innerHTML = `
    <div class="profile-card">
      <strong>${escapeHtml(profile.task_type)} / ${escapeHtml(profile.risk_level)}</strong>
      <p>${escapeHtml(profile.original_problem)}</p>
      <div class="meta">
        ${profile.required_perspectives.map((item) => `<span class="tag">${escapeHtml(item)}</span>`).join("")}
      </div>
      <p><strong>证据需求：</strong>${profile.evidence_needs.map(escapeHtml).join("、")}</p>
    </div>
  `;
}

function renderRecommendations(recommendation) {
  const container = $("#recommendations");
  const trace = recommendation.assembly_trace || [];
  const generated = recommendation.generated_agents || [];
  const coverage = recommendation.coverage || [];
  container.innerHTML = `
    <div class="assembly-grid">
      <section class="assembly-timeline">
        ${trace.map((step, index) => `
          <article class="assembly-step" data-status="${escapeHtml(step.status)}">
            <span>${String(index + 1).padStart(2, "0")}</span>
            <div>
              <strong>${escapeHtml(step.title)}</strong>
              <p>${escapeHtml(step.detail)}</p>
            </div>
          </article>
        `).join("")}
      </section>
      <section class="coverage-board">
        <strong>覆盖检查</strong>
        <div class="meta">
          ${coverage.map((item) => `<span class="tag coverage-${escapeHtml(item.status)}">${escapeHtml(item.perspective)}：${escapeHtml(coverageLabel(item.status))}</span>`).join("")}
        </div>
        ${generated.length > 0 ? `
          <div class="autofill-note">
            <strong>系统自动补位</strong>
            <p>${generated.map((agent) => `${agent.display_name}（${agent.perspective}）`).map(escapeHtml).join("、")}</p>
          </div>
        ` : ""}
        ${recommendation.ai_review ? `
          <div class="autofill-note">
            <strong>第三方 API 阵容复核</strong>
            <p>${escapeHtml(recommendation.ai_review.panel_summary || recommendation.ai_review.status)}</p>
          </div>
        ` : ""}
      </section>
    </div>
    <div class="agent-grid">
      ${recommendation.recommended_agents.map((agent) => `
        <article class="agent-card ${agent.generated_for_task ? "generated-agent" : ""}">
          <strong>${escapeHtml(agent.display_name)}</strong>
          <p>${escapeHtml(agent.fit_reason)}</p>
          <div class="meta">
            <span class="tag">${escapeHtml(agent.role)}</span>
            <span class="tag">${escapeHtml(agent.agent_class)}</span>
            <span class="tag">${escapeHtml(agent.access_level)}</span>
            <span class="tag">${escapeHtml(selectionLabel(agent.selection_source))}</span>
          </div>
          ${agent.covered_perspectives?.length ? `<p><strong>覆盖：</strong>${agent.covered_perspectives.map(escapeHtml).join("、")}</p>` : ""}
        </article>
      `).join("")}
    </div>
  `;
  $("#runButton").classList.remove("hidden");
}

function coverageLabel(status) {
  if (status === "auto_filled") return "系统补位";
  if (status === "covered") return "已覆盖";
  return "较弱";
}

function selectionLabel(source) {
  if (source === "auto_generated_personal") return "系统生成";
  if (source === "auto_reused_personal") return "系统复用";
  return "匹配已有";
}

function renderAgents(agents = state.agents) {
  const container = $("#agentList");
  container.innerHTML = agents.map((agent) => `
    <article class="agent-card">
      <strong>${escapeHtml(agent.display_name)}</strong>
      <p>${escapeHtml(agent.summary)}</p>
      <div class="meta">
        <span class="tag">${escapeHtml(agent.agent_class)}</span>
        <span class="tag">${escapeHtml(agent.trust_status)}</span>
        <span class="tag">${escapeHtml(agent.visibility_scope)}</span>
        <span class="tag">${escapeHtml(agent.publish_status || "draft")}</span>
      </div>
      <p><strong>能力：</strong>${agent.capabilities.map(escapeHtml).join("、")}</p>
      ${agent.agent_class === "personal_private" ? `<button class="ghost-button mini" data-share-agent="${escapeHtml(agent.agent_id)}">记录为共享 Agent</button>` : ""}
    </article>
  `).join("");
  $$("[data-share-agent]").forEach((button) => {
    button.addEventListener("click", async () => {
      try {
        const data = await api(`/api/agents/${button.dataset.shareAgent}/share`, {
          method: "POST",
          body: JSON.stringify({
            sensitiveDataWarningAcknowledged: true,
            notes: "MVP-0 记录共享状态，后续部门版再加入审核。"
          })
        });
        toast(`已记录共享：${data.agent.display_name}`);
        await loadAgents();
      } catch (error) {
        toast(error.message);
      }
    });
  });
}

function renderRoundtable(events) {
  const stages = ["agent_panel_recommended", "independent_positions", "challenges", "responses", "revisions", "consensus", "evidence_review", "final_artifact_generated"];
  $("#stageRail").innerHTML = stages.map((stage) => `<span class="stage">${stage}</span>`).join("");

  const container = $("#events");
  container.classList.remove("empty");
  container.innerHTML = events.map((event) => `
    <article class="event-card" data-type="${escapeHtml(event.event_type)}">
      <strong>${escapeHtml(event.event_type)} / ${escapeHtml(event.agent_name || "system")}</strong>
      <p>${escapeHtml(eventSummary(event))}</p>
      <div class="meta">
        <span class="tag">${escapeHtml(event.event_id)}</span>
        <span class="tag">${escapeHtml(event.agent_version_id || "n/a")}</span>
      </div>
    </article>
  `).join("");
}

function renderReport(artifacts) {
  const report = artifacts.find((item) => item.artifact_type === "markdown_report") || artifacts[0];
  if (!report) return;
  $("#report").classList.remove("empty");
  $("#report").textContent = report.markdown;
  $("#exportButton").classList.remove("hidden");
}

function eventSummary(event) {
  const p = event.payload || {};
  return p.claim || p.challenge_text || p.response_text || p.revised_claim || p.statement || p.missing_evidence || JSON.stringify(p);
}

async function loadSettings() {
  try {
    const settings = await api("/api/settings");
    $("#runtimeLabel").textContent = `Runtime: ${settings.aiRuntime}`;
    $("#apiBaseLabel").textContent = API_BASE;
    const policy = await api("/api/policy/evaluate", {
      method: "POST",
      body: JSON.stringify({
        resource_type: "tool",
        action: "roundtable_runtime",
        actor_type: "system"
      })
    });
    $("#policyLabel").textContent = `Policy: ${policy.policyDecision.result}`;
  } catch (error) {
    $("#runtimeLabel").textContent = "后端未连接";
    $("#apiBaseLabel").textContent = API_BASE;
    $("#policyLabel").textContent = "Policy: unavailable";
  }
}

async function loadAgents(agentClass = "") {
  const data = await api(`/api/agents${agentClass ? `?class=${encodeURIComponent(agentClass)}` : ""}`);
  state.agents = data.agents;
  renderAgents(data.agents);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

$("#taskForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    toast("系统正在分析问题、匹配并补齐智能体...");
    const data = await api("/api/sessions", {
      method: "POST",
      body: JSON.stringify({
        problem: form.get("problem"),
        background: form.get("background"),
        targetOutput: form.get("targetOutput")
      })
    });
    state.currentSession = data.session;
    renderTaskProfile(data.session.task_profile);
    renderRecommendations(data.session.recommendation);
    setView("workspace");
    toast("系统已完成智能体组建");
  } catch (error) {
    toast(error.message);
  }
});

$("#runButton").addEventListener("click", async () => {
  if (!state.currentSession) return;
  try {
    toast("圆桌运行中...");
    const data = await api(`/api/sessions/${state.currentSession.session_id}/run`, { method: "POST" });
    state.currentSession = data.session;
    state.events = data.events;
    state.artifacts = [data.artifact].filter(Boolean);
    renderRoundtable(state.events);
    renderReport(state.artifacts);
    setView("roundtable");
    toast("圆桌已完成");
  } catch (error) {
    toast(error.message);
  }
});

$("#agentRequestForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  try {
    const data = await api("/api/agents/request", {
      method: "POST",
      body: JSON.stringify({ requestText: form.get("requestText") })
    });
    $("#agentRequestResult").innerHTML = data.mode === "created_personal_draft"
      ? `<strong>已生成个人 Agent 草稿：</strong><p>${escapeHtml(data.draft.display_name)}</p>`
      : `<strong>找到可复用 Agent：</strong><p>${data.matches.map((item) => escapeHtml(item.display_name)).join("、")}</p>`;
    await loadAgents();
  } catch (error) {
    toast(error.message);
  }
});

$("#healthButton").addEventListener("click", async () => {
  try {
    const health = await api("/health");
    toast(`后端正常：${health.runtime}`);
  } catch (error) {
    toast(`后端不可用：${error.message}`);
  }
});

$("#exportButton").addEventListener("click", () => {
  if (!state.currentSession) return;
  window.open(`${API_BASE}/api/export/sessions/${state.currentSession.session_id}`, "_blank");
});

$$(".nav-item").forEach((button) => {
  button.addEventListener("click", () => setView(button.dataset.view));
});

$$("[data-agent-filter]").forEach((button) => {
  button.addEventListener("click", async () => {
    $$("[data-agent-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    await loadAgents(button.dataset.agentFilter);
  });
});

await loadSettings();
await loadAgents();
