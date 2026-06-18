const supportedResourceTypes = new Set(["file", "network", "database", "tool"]);

const defaultPolicy = {
  file: {
    allowedActions: ["read_summary", "read_metadata"],
    deniedActions: ["read_full", "write", "delete"]
  },
  network: {
    allowedActions: ["openai_api"],
    deniedActions: ["arbitrary_fetch", "crawl", "download"]
  },
  database: {
    allowedActions: ["read_session", "write_trace_event", "write_artifact", "write_share_record"],
    deniedActions: ["export_all_users", "delete_without_confirmation"]
  },
  tool: {
    allowedActions: ["roundtable_runtime", "agent_matcher", "report_generator"],
    deniedActions: ["shell", "server_admin", "external_publish"]
  }
};

export function evaluatePolicyRequest(request = {}) {
  const resourceType = String(request.resource_type || "").trim();
  const action = String(request.action || "").trim();
  const actorType = String(request.actor_type || "system").trim();
  const sessionId = request.session_id || null;

  if (!supportedResourceTypes.has(resourceType)) {
    return decision("deny", "unsupported_resource_type", {
      resource_type: resourceType,
      action,
      actor_type: actorType,
      session_id: sessionId
    });
  }

  if (!action) {
    return decision("deny", "missing_action", {
      resource_type: resourceType,
      actor_type: actorType,
      session_id: sessionId
    });
  }

  const policy = defaultPolicy[resourceType];
  if (policy.deniedActions.includes(action)) {
    return decision("deny", "action_requires_explicit_approval_or_future_policy", {
      resource_type: resourceType,
      action,
      actor_type: actorType,
      session_id: sessionId
    });
  }

  if (policy.allowedActions.includes(action)) {
    return decision("allow", "allowed_by_mvp_stub_policy", {
      resource_type: resourceType,
      action,
      actor_type: actorType,
      session_id: sessionId
    });
  }

  return decision("review", "unknown_action_requires_policy_extension", {
    resource_type: resourceType,
    action,
    actor_type: actorType,
    session_id: sessionId
  });
}

function decision(result, reason, context) {
  return {
    decision_id: `policy_${randomUUID()}`,
    result,
    reason,
    context,
    created_at: new Date().toISOString()
  };
}
import { randomUUID } from "node:crypto";
