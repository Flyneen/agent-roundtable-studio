import {
  generateTaskProfile as simulateTaskProfile,
  recommendAgents as simulateRecommendAgents,
  runRoundtable as simulateRunRoundtable
} from "./simulatedRuntime.mjs";

export async function generateTaskProfileHybrid(input, store, openai, config) {
  const profile = simulateTaskProfile(input, store);
  if (!shouldUseOpenAI(openai, config)) {
    return profile;
  }

  try {
    const response = await openai.createStructuredResponse({
      schemaName: "task_profile_enrichment",
      instructions: "你是 Agent Roundtable Studio 的任务画像分析器。基于用户问题，输出 JSON：{task_type,risk_level,required_perspectives,evidence_needs,assumptions,constraints}。required_perspectives 必须是中文短标签。",
      input: {
        problem: input.problem,
        background: input.background || "",
        targetOutput: input.targetOutput || "评审报告",
        baselineProfile: profile
      }
    });
    const enriched = response.output_json || {};
    return store.update("task_profiles", "task_profile_id", profile.task_profile_id, {
      task_type: enriched.task_type || profile.task_type,
      risk_level: enriched.risk_level || profile.risk_level,
      required_perspectives: mergeList(profile.required_perspectives, enriched.required_perspectives),
      evidence_needs: mergeList(profile.evidence_needs, enriched.evidence_needs),
      assumptions: mergeList(profile.assumptions, enriched.assumptions),
      constraints: mergeList(profile.constraints, enriched.constraints),
      ai_enrichment: {
        provider_mode: config.openaiApiMode,
        model: config.openaiModel,
        status: response.output_json ? "applied" : "no_json_output"
      }
    }) || profile;
  } catch (error) {
    return store.update("task_profiles", "task_profile_id", profile.task_profile_id, {
      ai_enrichment: {
        provider_mode: config.openaiApiMode,
        model: config.openaiModel,
        status: "fallback_simulated",
        error: error.message
      }
    }) || profile;
  }
}

export async function recommendAgentsHybrid(taskProfile, agents, store, openai, config) {
  const recommendation = simulateRecommendAgents(taskProfile, agents, store);
  if (!shouldUseOpenAI(openai, config)) {
    return recommendation;
  }

  try {
    const response = await openai.createStructuredResponse({
      schemaName: "agent_panel_review",
      instructions: "你是圆桌阵容审查器。基于任务画像和候选阵容，输出 JSON：{panel_summary,risks,missing_expertise,selection_notes}。不要替换 agent_id，只解释为什么当前阵容合理或哪里要注意。",
      input: {
        taskProfile,
        recommendedAgents: recommendation.recommended_agents,
        coverage: recommendation.coverage
      }
    });
    const review = response.output_json || {};
    return {
      ...recommendation,
      ai_review: {
        provider_mode: config.openaiApiMode,
        model: config.openaiModel,
        status: response.output_json ? "applied" : "no_json_output",
        panel_summary: review.panel_summary || "",
        risks: Array.isArray(review.risks) ? review.risks : [],
        missing_expertise: Array.isArray(review.missing_expertise) ? review.missing_expertise : [],
        selection_notes: Array.isArray(review.selection_notes) ? review.selection_notes : []
      },
      assembly_trace: [
        ...(recommendation.assembly_trace || []),
        {
          stage: "ai_panel_review",
          title: "第三方 API 审查阵容",
          detail: review.panel_summary || "已调用第三方兼容 API 对阵容进行审查。",
          status: response.output_json ? "done" : "no_json_output"
        }
      ]
    };
  } catch (error) {
    return {
      ...recommendation,
      ai_review: {
        provider_mode: config.openaiApiMode,
        model: config.openaiModel,
        status: "fallback_simulated",
        error: error.message
      },
      assembly_trace: [
        ...(recommendation.assembly_trace || []),
        {
          stage: "ai_panel_review",
          title: "第三方 API 审查阵容",
          detail: `第三方 API 暂不可用，已保留本地模拟编排结果：${error.message}`,
          status: "fallback_simulated"
        }
      ]
    };
  }
}

export async function runRoundtableHybrid(session, store, openai, config) {
  const result = simulateRunRoundtable(session, store);
  if (!shouldUseOpenAI(openai, config) || result.partial) {
    return result;
  }

  try {
    const response = await openai.createStructuredResponse({
      schemaName: "roundtable_report_polish",
      instructions: "你是圆桌报告主笔。基于结构化事件，输出 JSON：{executive_summary,quality_score,high_risk_gaps,next_actions}。不要改写事实，不要编造事件。",
      input: {
        session: result.session,
        events: result.events,
        artifactMarkdown: result.artifact?.markdown || ""
      }
    });
    const polish = response.output_json || {};
    if (!response.output_json) return result;

    const appendix = [
      "\n## 第三方 API 复核摘要",
      "",
      polish.executive_summary || "",
      "",
      `- 质量评分：${polish.quality_score || "未评分"}`,
      ...(Array.isArray(polish.high_risk_gaps) ? polish.high_risk_gaps.map((item) => `- 高风险缺口：${item}`) : []),
      ...(Array.isArray(polish.next_actions) ? polish.next_actions.map((item) => `- 下一步：${item}`) : [])
    ].join("\n");

    const updatedArtifact = store.update("artifacts", "artifact_id", result.artifact.artifact_id, {
      markdown: `${result.artifact.markdown}${appendix}`,
      ai_review: {
        provider_mode: config.openaiApiMode,
        model: config.openaiModel,
        status: "applied"
      }
    });

    return {
      ...result,
      artifact: updatedArtifact || result.artifact
    };
  } catch (error) {
    const updatedArtifact = store.update("artifacts", "artifact_id", result.artifact.artifact_id, {
      ai_review: {
        provider_mode: config.openaiApiMode,
        model: config.openaiModel,
        status: "fallback_simulated",
        error: error.message
      }
    });
    return {
      ...result,
      artifact: updatedArtifact || result.artifact
    };
  }
}

function shouldUseOpenAI(openai, config) {
  return config.aiRuntime === "openai" && openai.isConfigured();
}

function mergeList(base = [], incoming = []) {
  if (!Array.isArray(incoming)) return base;
  return [...new Set([...base, ...incoming.map(String).filter(Boolean)])];
}
