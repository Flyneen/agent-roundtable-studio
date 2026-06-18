# 04. 讨论事件与证据结构

## 1. 目标

定义圆桌讨论的结构化事件模型，让产品不依赖“聊天记录总结”，而是能追踪观点、质疑、回应、修正、共识、分歧、证据和最终采纳理由。

## 2. 核心原则

- 聊天消息只是表现层，结构化事件才是事实层。
- 任何重要结论都必须有来源类型。
- 任何被采纳观点都必须经过质疑状态标记。
- 任何缺证据结论都必须进入证据缺口。
- 任何最终报告都必须能反查事件链。

## 3. 事件基类 `TraceEvent`

字段：

- `event_id`
- `session_id`
- `run_id`
- `turn_id`
- `event_type`
- `created_at`
- `actor_type`
- `actor_id`
- `agent_version_id`
- `visible_to_user`
- `payload`
- `parent_event_ids`
- `linked_artifact_ids`

`actor_type`：

- `user`
- `agent`
- `system`
- `synthesizer`
- `policy_engine`

## 4. 讨论事件类型

### 4.1 `PositionEvent`

Agent 的首轮观点。

字段：

- `position_id`
- `claim`
- `rationale`
- `assumptions`
- `risks`
- `evidence_refs`
- `confidence_level`
- `challenge_requested`

质量要求：

- 必须有明确判断。
- 必须有至少一个理由。
- 必须暴露至少一个风险或假设。

### 4.2 `ChallengeEvent`

Agent 对观点的质疑。

字段：

- `challenge_id`
- `target_position_id`
- `challenge_type`
- `challenge_text`
- `severity`
- `required_response`
- `evidence_refs`

质疑类型：

- `weak_assumption`
- `missing_evidence`
- `cost_underestimated`
- `implementation_risk`
- `ux_risk`
- `security_risk`
- `privacy_risk`
- `trust_risk`
- `scope_conflict`
- `logic_gap`

质量要求：

- 必须指向具体观点。
- 不能只说“我不同意”。
- 必须说明不修正会带来什么后果。

### 4.3 `ResponseEvent`

被质疑者的回应。

字段：

- `response_id`
- `challenge_id`
- `response_type`
- `response_text`
- `accepted_changes`
- `remaining_disagreement`
- `new_evidence_refs`

回应类型：

- `accepted`
- `partially_accepted`
- `rejected`
- `needs_evidence`
- `converted_to_assumption`

### 4.4 `RevisionEvent`

观点修正。

字段：

- `revision_id`
- `original_position_id`
- `revised_claim`
- `revision_reason`
- `trigger_challenge_ids`
- `impact_level`

必须保留：

- 修正前观点。
- 修正后观点。
- 修正原因。
- 由谁触发。

### 4.5 `ConsensusEvent`

共识生成。

字段：

- `consensus_id`
- `consensus_type`
- `statement`
- `supporting_position_ids`
- `resolved_challenge_ids`
- `remaining_risks`
- `confidence_level`

共识类型：

- `strong_consensus`
- `weak_consensus`
- `conditional_consensus`

### 4.6 `DisagreementEvent`

未解决分歧。

字段：

- `disagreement_id`
- `topic`
- `positions`
- `why_unresolved`
- `decision_impact`
- `recommended_resolution`

质量要求：

- 分歧不能被综合器吞掉。
- 如果影响结论，必须在最终报告中展示。

### 4.7 `EvidenceGapEvent`

证据缺口。

字段：

- `gap_id`
- `related_claim_id`
- `missing_evidence`
- `why_needed`
- `risk_if_missing`
- `suggested_source`
- `priority`

优先级：

- `critical`
- `high`
- `medium`
- `low`

### 4.8 `AdoptionDecisionEvent`

最终采纳或不采纳决策。

字段：

- `decision_id`
- `claim_id`
- `decision`
- `reason`
- `supporting_events`
- `opposing_events`
- `evidence_status`

决策：

- `adopted`
- `adopted_with_conditions`
- `rejected`
- `deferred`

## 5. 证据模型

### 5.1 `EvidenceItem`

字段：

- `evidence_id`
- `session_id`
- `source_type`
- `source_ref`
- `title`
- `excerpt`
- `hash`
- `created_at`
- `sensitivity_level`
- `access_scope`

来源类型：

- `user_input`
- `uploaded_file`
- `local_file`
- `agent_inference`
- `web_source`
- `system_generated_summary`
- `prior_session`

### 5.2 `EvidenceLink`

字段：

- `evidence_link_id`
- `evidence_id`
- `target_event_id`
- `link_type`
- `quote_or_summary`
- `confidence`

链接类型：

- `supports`
- `contradicts`
- `requires_verification`
- `background`

## 6. 争议地图模型

### 6.1 `DisputeNode`

节点类型：

- `claim`
- `challenge`
- `response`
- `revision`
- `consensus`
- `disagreement`
- `evidence_gap`

字段：

- `node_id`
- `node_type`
- `label`
- `severity`
- `status`
- `owner_agent_id`

### 6.2 `DisputeEdge`

边类型：

- `challenges`
- `responds_to`
- `revises`
- `supports`
- `contradicts`
- `resolved_by`
- `depends_on`

字段：

- `edge_id`
- `from_node_id`
- `to_node_id`
- `edge_type`
- `label`

## 7. 最终报告结构

最终报告不能只输出自然语言总结，必须包含：

1. 任务画像摘要。
2. 参与 Agent 与版本。
3. 核心结论。
4. 主要争议点。
5. 被修正的重要观点。
6. 强共识与弱共识。
7. 未解决分歧。
8. 证据缺口。
9. 风险清单。
10. 下一步行动。
11. 可追溯事件索引。

## 8. 事件质量门禁

一次圆桌被标记为“完整”，必须满足：

- 至少 3 个 `PositionEvent`。
- 至少 3 个 `ChallengeEvent`。
- 每条高优先级 `ChallengeEvent` 有 `ResponseEvent`。
- 至少 1 个 `RevisionEvent`。
- 至少 1 个 `ConsensusEvent`。
- 至少 1 个 `EvidenceGapEvent`。
- 最终报告至少引用 5 个结构化事件。

如果不满足，只能标记为：

- `partial`
- `insufficient_challenge`
- `insufficient_evidence`
- `agent_failure`

## 9. MVP-0 存储要求

MVP-0 至少保存：

- Session 元数据。
- Agent 版本快照。
- 任务画像。
- 结构化事件 JSON。
- Markdown 最终报告。
- 证据缺口清单。
- 争议地图数据。

MVP-0 可以不保存：

- 完整上传材料原文。
- 全部中间 Prompt。
- 大规模向量索引。
- 长期跨项目知识库。

## 10. 验收标准

- 用户点击最终报告中的结论，能看到支撑观点和质疑链。
- 用户能看出哪些结论只是 Agent 推理。
- 用户能看出哪些结论缺证据。
- 用户能看出哪些观点被修正过。
- 用户能导出结构化事件包。
- 系统不会把未被质疑的观点显示为强共识。
