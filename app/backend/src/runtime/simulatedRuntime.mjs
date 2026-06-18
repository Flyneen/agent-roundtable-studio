const perspectiveMap = [
  ["产品", ["产品定位", "MVP 范围", "用户价值"]],
  ["体验", ["用户路径", "信息架构", "可用性"]],
  ["UI", ["界面设计", "视觉层级", "组件状态"]],
  ["工作流", ["工作流", "状态机", "阶段门禁"]],
  ["多 Agent", ["多 Agent 编排", "质疑机制", "上下文治理"]],
  ["架构", ["软件架构", "API", "数据模型", "部署"]],
  ["安全", ["安全架构", "权限", "密钥管理"]],
  ["隐私", ["隐私", "数据最小化", "共享边界"]],
  ["信任", ["Agent 身份", "版本", "共享治理"]]
];

export function generateTaskProfile({ problem, background = "", targetOutput = "评审报告" }, store) {
  const text = `${problem}\n${background}`.toLowerCase();
  const requiredPerspectives = perspectiveMap
    .filter(([label, tags]) => text.includes(label.toLowerCase()) || tags.some((tag) => text.includes(tag.toLowerCase())))
    .map(([label]) => label);

  const normalizedPerspectives = requiredPerspectives.length > 0
    ? requiredPerspectives
    : ["产品", "体验", "工作流", "多 Agent", "架构", "安全", "隐私"];

  const profile = {
    task_profile_id: store.newId("task"),
    original_problem: problem,
    background,
    task_type: inferTaskType(text),
    target_output: targetOutput,
    risk_level: inferRiskLevel(text),
    constraints: [
      "首期 Web MVP",
      "前后端分离",
      "结构化事件优先于聊天记录"
    ],
    required_perspectives: normalizedPerspectives,
    evidence_needs: [
      "Agent 来源与版本",
      "关键结论的事件链",
      "部署安全前提",
      "用户材料访问边界"
    ],
    assumptions: [
      "MVP-0 以本地/单用户体验验证为主",
      "云端部门协作作为后续版本扩展"
    ],
    created_at: new Date().toISOString()
  };

  return store.insert("task_profiles", profile);
}

export function recommendAgents(taskProfile, agents, store) {
  const scored = agents.map((agent) => {
    const score = scoreAgent(agent, taskProfile);
    return { agent, score };
  }).sort((a, b) => b.score - a.score);

  const recommended = scored
    .filter((item) => item.agent.default_pool_eligible !== false)
    .slice(0, 7)
    .map(({ agent, score }) => ({
      agent_id: agent.agent_id,
      agent_version_id: agent.current_version_id,
      display_name: agent.display_name,
      agent_class: agent.agent_class,
      trust_status: agent.trust_status,
      access_level: "summary_only",
      score,
      role: inferPanelRole(agent),
      fit_reason: `覆盖 ${matchedCapabilities(agent, taskProfile).join("、") || "通用审议"} 视角。`
    }));

  const excluded = scored
    .slice(7, 14)
    .map(({ agent }) => ({
      agent_id: agent.agent_id,
      display_name: agent.display_name,
      reason: "当前阵容已覆盖主要视角，暂不加入以控制讨论复杂度。"
    }));

  return {
    recommendation_id: store.newId("rec"),
    recommended_agents: recommended,
    excluded_agents: excluded,
    coverage: taskProfile.required_perspectives.map((perspective) => ({
      perspective,
      status: recommended.some((item) => {
        const agent = agents.find((candidate) => candidate.agent_id === item.agent_id);
        return agent && matchedCapabilities(agent, { required_perspectives: [perspective] }).length > 0;
      }) ? "covered" : "weak"
    })),
    missing_perspectives: [],
    created_at: new Date().toISOString()
  };
}

export function createPersonalAgentDraft(requestText, agents, store) {
  const matches = agents
    .map((agent) => ({ agent, score: requestScore(agent, requestText) }))
    .filter((item) => item.score > 1)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  if (matches.length > 0) {
    return {
      mode: "matched_existing",
      matches: matches.map(({ agent, score }) => ({
        agent_id: agent.agent_id,
        display_name: agent.display_name,
        agent_class: agent.agent_class,
        score,
        reason: "已有 Agent 能覆盖该诉求的一部分。"
      })),
      draft: null
    };
  }

  const agentId = store.newId("agent");
  const draft = {
    agent_id: agentId,
    display_name: inferAgentName(requestText),
    summary: requestText.slice(0, 120),
    agent_class: "personal_private",
    owner_user_id: "local-user",
    trust_status: "trial_only",
    visibility_scope: "owner_only",
    publish_status: "draft",
    default_pool_eligible: false,
    current_version_id: `${agentId}:v1`,
    capabilities: inferCapabilitiesFromRequest(requestText),
    boundaries: [
      "仅作为个人 Agent 草稿使用",
      "未通过试运行前不进入默认推荐池",
      "不得默认访问完整用户材料"
    ],
    permissions: ["problem_only"],
    created_by: "local-user",
    source_type: "generated_from_request",
    trigger_request: requestText
  };

  store.insert("agents", draft);
  store.insert("agent_versions", {
    agent_version_id: draft.current_version_id,
    agent_id: draft.agent_id,
    version_label: "v1",
    content_hash: `${draft.agent_id}:request`,
    source_hash: "generated",
    source_type: "generated_from_request",
    instructions_snapshot: draft.summary,
    metadata_snapshot: {
      capabilities: draft.capabilities,
      boundaries: draft.boundaries,
      trigger_request: requestText
    },
    release_status: "trial",
    created_at: new Date().toISOString()
  });

  return {
    mode: "created_personal_draft",
    matches: [],
    draft
  };
}

export function runRoundtable(session, store) {
  const agents = session.agent_panel.map((item) => store.get("agents", "agent_id", item.agent_id)).filter(Boolean);
  const taskProfile = session.task_profile;
  const events = [];

  for (const agent of agents) {
    events.push(makeEvent(store, session, agent, "position", {
      claim: createClaim(agent, taskProfile),
      rationale: `${agent.display_name} 基于 ${taskProfile.task_type} 任务画像提出首轮判断。`,
      assumptions: taskProfile.assumptions,
      risks: createRisks(agent),
      evidence_refs: ["user_problem", "task_profile"],
      confidence_level: agent.trust_status === "official_verified" ? "medium_high" : "medium",
      challenge_requested: true
    }));
  }

  const challengeTargets = events.slice(0, Math.min(4, events.length));
  for (const target of challengeTargets) {
    const challenger = agents.find((agent) => agent.agent_id !== target.agent_id) || agents[0];
    events.push(makeEvent(store, session, challenger, "challenge", {
      target_event_id: target.event_id,
      challenge_type: "missing_evidence",
      severity: "high",
      challenge_text: `该观点需要补充证据链，不能只作为 ${target.agent_name} 的专业判断直接进入强共识。`,
      required_response: true,
      evidence_refs: ["task_profile"]
    }));
  }

  const challenges = events.filter((event) => event.event_type === "challenge");
  for (const challenge of challenges) {
    const target = events.find((event) => event.event_id === challenge.target_event_id);
    const responder = agents.find((agent) => agent.agent_id === target?.agent_id) || agents[0];
    events.push(makeEvent(store, session, responder, "response", {
      challenge_id: challenge.event_id,
      response_type: "partially_accepted",
      response_text: "接受证据不足的问题，将结论降级为条件性建议，并补充待确认前提。",
      accepted_changes: ["降级为条件性共识", "加入证据缺口"],
      remaining_disagreement: "实际部署数据仍需上线后验证。"
    }));
  }

  if (events.length > 0) {
    const firstPosition = events.find((event) => event.event_type === "position");
    const reviser = agents.find((agent) => agent.agent_id === firstPosition?.agent_id) || agents[0];
    events.push(makeEvent(store, session, reviser, "revision", {
      original_position_id: firstPosition?.event_id,
      revised_claim: "首期应以模拟 Runtime 跑通结构化圆桌闭环，再接入 OpenAI API；不要先做头像聊天 UI。",
      revision_reason: "交叉质疑后明确证据链和部署安全比视觉演示更重要。",
      impact_level: "high"
    }));
  }

  events.push(makeEvent(store, session, agents[0], "consensus", {
    consensus_type: "conditional_consensus",
    statement: "首期 Web MVP 应先完成可部署的前后端分离闭环：任务画像、Agent 推荐、结构化圆桌、追溯报告、个人 Agent 草稿和部署安全基线。",
    supporting_event_ids: events.filter((event) => ["position", "revision", "response"].includes(event.event_type)).map((event) => event.event_id),
    confidence_level: "medium_high",
    remaining_risks: ["真实 OpenAI API 输出稳定性", "部门云端权限和审计尚未实现", "共享 Agent 需要敏感信息检查"]
  }));

  events.push(makeEvent(store, session, agents[0], "evidence_gap", {
    missing_evidence: "真实用户完成一次圆桌所需时间和报告采纳率。",
    why_needed: "用于判断产品是否真的提升复杂问题决策质量。",
    risk_if_missing: "可能只做成演示系统，不能形成真实工作台。",
    priority: "high",
    suggested_source: "3 个样例任务端到端试用记录"
  }));

  const savedEvents = events.map((event) => store.insert("trace_events", event));
  const artifact = makeFinalReport(session, savedEvents, store);
  store.insert("artifacts", artifact);

  const updatedSession = store.update("sessions", "session_id", session.session_id, {
    status: "complete",
    current_stage: "final_artifact_generated",
    trace_event_ids: savedEvents.map((event) => event.event_id),
    artifact_ids: [artifact.artifact_id],
    completed_at: new Date().toISOString()
  });

  return {
    session: updatedSession,
    events: savedEvents,
    artifact
  };
}

function makeEvent(store, session, agent, eventType, payload) {
  return {
    event_id: store.newId("evt"),
    session_id: session.session_id,
    run_id: session.run_id,
    turn_id: `${eventType}_${Date.now()}`,
    event_type: eventType,
    actor_type: "agent",
    actor_id: agent.agent_id,
    agent_id: agent.agent_id,
    agent_name: agent.display_name,
    agent_version_id: agent.current_version_id,
    visible_to_user: true,
    payload,
    created_at: new Date().toISOString()
  };
}

function makeFinalReport(session, events, store) {
  const positions = events.filter((event) => event.event_type === "position");
  const challenges = events.filter((event) => event.event_type === "challenge");
  const revisions = events.filter((event) => event.event_type === "revision");
  const consensus = events.find((event) => event.event_type === "consensus");
  const gaps = events.filter((event) => event.event_type === "evidence_gap");

  const markdown = `# 圆桌评审报告

## 一句话结论

${consensus?.payload.statement || "本次圆桌形成了条件性结论。"}

## 任务画像

- 任务类型：${session.task_profile.task_type}
- 输出目标：${session.task_profile.target_output}
- 风险等级：${session.task_profile.risk_level}
- 所需视角：${session.task_profile.required_perspectives.join("、")}

## 参与 Agent

${session.agent_panel.map((agent) => `- ${agent.display_name}（${agent.agent_version_id}）：${agent.role}`).join("\n")}

## 首轮观点

${positions.map((event) => `- **${event.agent_name}**：${event.payload.claim}`).join("\n")}

## 主要质疑

${challenges.map((event) => `- **${event.agent_name}**：${event.payload.challenge_text}`).join("\n")}

## 已修正观点

${revisions.map((event) => `- ${event.payload.revised_claim}`).join("\n") || "- 暂无修正。"}

## 证据缺口

${gaps.map((event) => `- ${event.payload.missing_evidence}：${event.payload.risk_if_missing}`).join("\n")}

## 下一步行动

1. 先用模拟 Runtime 完成本地端到端验证。
2. 接入 OpenAI API Adapter，并强制结构化输出。
3. 部署前完成服务器安全基线处理。
4. 用 3 个样例任务验证报告质量和追溯链。

## 事件索引

${events.map((event) => `- ${event.event_id}：${event.event_type} / ${event.agent_name}`).join("\n")}
`;

  return {
    artifact_id: store.newId("art"),
    session_id: session.session_id,
    artifact_type: "markdown_report",
    title: "圆桌评审报告",
    markdown,
    trace_event_ids: events.map((event) => event.event_id),
    created_at: new Date().toISOString()
  };
}

function inferTaskType(text) {
  if (text.includes("部署") || text.includes("架构") || text.includes("api")) return "技术方案评审";
  if (text.includes("产品") || text.includes("mvp")) return "产品规划";
  if (text.includes("页面") || text.includes("界面")) return "体验设计";
  return "复杂问题审议";
}

function inferRiskLevel(text) {
  if (text.includes("云") || text.includes("部署") || text.includes("密码") || text.includes("权限")) return "high";
  return "medium";
}

function matchedCapabilities(agent, taskProfile) {
  const perspectives = taskProfile.required_perspectives || [];
  return agent.capabilities.filter((capability) =>
    perspectives.some((perspective) => capability.includes(perspective) || perspective.includes(capability.slice(0, 2)))
  );
}

function scoreAgent(agent, taskProfile) {
  let score = 0;
  score += matchedCapabilities(agent, taskProfile).length * 5;
  if (agent.default_pool_eligible) score += 2;
  if (agent.trust_status === "official_verified") score += 2;
  if (agent.agent_class === "system_public") score += 1;
  return score;
}

function requestScore(agent, requestText) {
  const text = requestText.toLowerCase();
  return agent.capabilities.reduce((score, capability) => {
    return score + (text.includes(capability.toLowerCase()) ? 2 : 0);
  }, agent.summary && text.includes(agent.summary.toLowerCase()) ? 1 : 0);
}

function inferPanelRole(agent) {
  if (agent.display_name.includes("Security") || agent.display_name.includes("Privacy")) return "风险与边界审查";
  if (agent.display_name.includes("Architect")) return "结构与可落地性审查";
  if (agent.display_name.includes("Designer")) return "体验与表达审查";
  if (agent.display_name.includes("Product")) return "产品价值与范围判断";
  return "专业审议";
}

function createClaim(agent, taskProfile) {
  if (agent.display_name.includes("Security")) return "部署和模型调用必须先经过密钥、权限、网络暴露和审计基线检查。";
  if (agent.display_name.includes("Privacy")) return "个人 Agent 和共享 Agent 必须默认最小可见，上传材料不能默认长期保存。";
  if (agent.display_name.includes("Software")) return "首期应采用前后端分离和单机部署，保留后续云端部门版扩展边界。";
  if (agent.display_name.includes("Multi-Agent")) return "圆桌必须用结构化事件驱动，不能退化为多个 Agent 顺序发言。";
  if (agent.display_name.includes("Workflow")) return "状态机和阶段门禁应优先于动画效果。";
  if (agent.display_name.includes("UX")) return "用户必须始终知道当前阶段、Agent 选择理由、争议和证据缺口。";
  if (agent.display_name.includes("UI")) return "界面主体应是工作台、事件卡和争议地图，不应是聊天气泡。";
  return `围绕 ${taskProfile.target_output}，首期应优先保证可用闭环而不是功能堆叠。`;
}

function createRisks(agent) {
  if (agent.display_name.includes("Security")) return ["root 密码暴露", "API Key 泄露", "后端端口直连公网"];
  if (agent.display_name.includes("Privacy")) return ["个人 Agent 共享时泄露敏感上下文", "用户材料默认保存"];
  if (agent.display_name.includes("Software")) return ["过早复杂化", "没有 Repository 层导致迁移困难"];
  return ["证据不足", "用户无法判断结论可信度"];
}

function inferAgentName(requestText) {
  if (requestText.includes("医疗")) return "医疗合规评审 Agent";
  if (requestText.includes("部署")) return "云部署评审 Agent";
  if (requestText.includes("成本")) return "成本评审 Agent";
  return "个人专项评审 Agent";
}

function inferCapabilitiesFromRequest(requestText) {
  const caps = [];
  if (requestText.includes("医疗")) caps.push("医疗合规", "健康数据", "宣传边界");
  if (requestText.includes("部署")) caps.push("部署安全", "服务器运维", "网络暴露");
  if (requestText.includes("隐私")) caps.push("隐私", "数据最小化");
  if (requestText.includes("成本")) caps.push("成本", "投入产出");
  return caps.length > 0 ? caps : ["专项评审", "风险识别", "输出建议"];
}
