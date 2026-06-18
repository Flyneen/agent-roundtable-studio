export const runtimeSchemas = {
  taskProfile: {
    required: ["task_profile_id", "task_type", "target_output", "risk_level", "required_perspectives"]
  },
  recommendation: {
    required: ["recommended_agents", "excluded_agents", "coverage"]
  },
  positionEvent: {
    required: ["event_type", "claim", "rationale", "risks", "confidence_level"]
  },
  challengeEvent: {
    required: ["event_type", "target_event_id", "challenge_type", "severity", "challenge_text"]
  },
  finalReport: {
    required: ["artifact_id", "session_id", "markdown", "trace_event_ids"]
  }
};

export function assertFields(object, fields, label) {
  const missing = fields.filter((field) => !(field in object));
  if (missing.length > 0) {
    const error = new Error(`${label} missing fields: ${missing.join(", ")}`);
    error.status = 422;
    throw error;
  }
}
