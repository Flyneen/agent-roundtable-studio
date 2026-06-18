# 08. 云端 AI 运行时决策

## 1. 结论

云端版本的产品运行时应使用 OpenAI API，不应把 Codex 作为用户侧圆桌讨论运行时。

分工如下：

```text
Codex
  -> 产品开发工具
  -> 代码维护工具
  -> 代码审查工具
  -> 自动化工程任务工具

OpenAI API
  -> 产品 AI 运行时
  -> 任务画像分析
  -> Agent 匹配
  -> 多 Agent 圆桌推理
  -> 结构化事件生成
  -> 证据缺口分析
  -> 最终报告生成
```

如果接入阿里或其他第三方模型服务，应按 OpenAI-compatible API 方式接入：

```text
OPENAI_BASE_URL=<第三方 OpenAI-compatible base url>
OPENAI_API_MODE=chat_completions
OPENAI_API_KEY=<只写在服务器环境或 secret 中>
OPENAI_MODEL=<第三方模型名称>
```

第三方 Key 不得写入仓库、前端、日志或 OpenSpec 示例。已经暴露在对话、截图或日志中的 Key 应立即在供应商侧作废并重新生成。

## 2. 为什么不是 Codex 作为运行时

Codex 是面向软件工程任务的 coding agent。它适合：

- 理解代码库。
- 修改代码。
- 执行测试。
- 做代码审查。
- 在云端或本地处理工程任务。

但本产品的用户侧运行时需要：

- 多用户请求处理。
- 可控的 Agent 编排。
- 结构化输出。
- 工具权限网关。
- 证据链和审计事件。
- 业务数据隔离。
- 部门级权限和共享边界。

这些能力应该由产品自己的后端编排层承载，并通过 OpenAI API 调用模型能力。

## 3. 推荐运行时架构

```text
前端应用
  -> BFF / 业务 API
  -> 圆桌编排服务
  -> Agent Runtime
  -> OpenAI API
     - Responses API
     - Structured Outputs
     - Tool / Function Calling
     - Agents SDK（需要更复杂编排时）
  -> Tool Gateway
  -> Policy Gateway
  -> Evidence Gateway
  -> Event Store
  -> Artifact Generator
```

## 4. API 能力使用建议

### 4.1 Responses API

用于：

- 单次或少轮模型调用。
- 任务画像生成。
- Agent 推荐理由生成。
- 结构化事件生成。
- 报告段落生成。

### 4.2 Structured Outputs

必须用于：

- `TaskProfile`
- `AgentRecommendation`
- `PositionEvent`
- `ChallengeEvent`
- `ResponseEvent`
- `RevisionEvent`
- `ConsensusEvent`
- `EvidenceGapEvent`
- `FinalReportOutline`

原则：

- 关键事件不能只存自然语言。
- 模型输出必须符合 JSON Schema。
- 无法满足 schema 时应重试或降级为待人工确认。

### 4.3 Tool / Function Calling

用于：

- 检索 Agent 库。
- 读取允许范围内的材料摘要。
- 查询证据台账。
- 触发联网核验。
- 写入结构化事件。
- 生成导出产物。

工具调用必须经过权限网关，不允许 Agent 直接访问文件、网络或数据库。

### 4.4 Agents SDK

当产品需要更复杂的运行模式时使用：

- 多 Agent handoff。
- 工具审批。
- 会话状态管理。
- 运行追踪。
- 更复杂的多步工作流。

MVP-0 可以先用自研编排层 + Responses API。云端部门版再评估是否引入 Agents SDK。

## 5. Codex 在本项目中的职责

Codex 用于开发阶段：

- 生成前端页面。
- 实现后端服务。
- 维护 OpenSpec。
- 编写测试。
- 做代码审查。
- 修复 bug。
- 生成迁移脚本。
- 维护部署配置。

Codex 不直接承担：

- 部门同事的用户请求。
- 圆桌 Agent 的运行时身份。
- 用户上传材料的直接处理。
- 跨用户共享 Agent 的权限判断。

## 6. 云端部门版必须补齐的运行时能力

- 用户账号。
- 部门空间。
- Agent 归属和可见性。
- 共享 Agent 审核与撤回。
- API Key 和模型调用隔离。
- 用量控制。
- 成本统计。
- 数据脱敏。
- 审计日志。
- 权限审批。
- 删除与导出机制。

## 7. MVP-0 决策

MVP-0：

- 可以本地运行。
- 可以先不接真实 OpenAI API，使用模拟执行器验证状态机。
- 如果接真实模型，优先使用 OpenAI API。
- 不需要 Codex 作为运行时。
- Codex 仅作为开发工具。

云端版本：

- 必须使用 OpenAI API 作为 AI 运行时。
- 优先以 Responses API + Structured Outputs 实现核心流程。
- 复杂编排再引入 Agents SDK。
- 所有工具和数据访问必须走产品自己的权限网关。

## 8. 验收标准

- 技术方案不能把 Codex 设计为用户侧圆桌运行时。
- 技术方案必须包含 OpenAI API 调用层。
- 技术方案必须包含结构化输出 schema。
- 技术方案必须包含工具权限网关。
- 技术方案必须说明 Codex 仅用于开发、维护和代码任务。
- 云端部门版必须包含账号、部门空间、权限、审计和数据隔离。
