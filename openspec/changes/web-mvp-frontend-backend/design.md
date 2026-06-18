## Context

当前已经有 `agent-roundtable-studio` 主规格，明确产品不是多 Agent 聊天室，而是结构化问题审议工作台。首期只上线 Web 版本，采用前后端分离架构，并部署到华为云服务器。

约束：

- 首期以 Web MVP 为目标，不做桌面版和移动 App。
- 首期先做单机部署，但代码结构必须保留前后端分离和后续云端部门版扩展能力。
- AI 运行时使用 OpenAI API 设计；Codex 只作为开发、维护和代码任务工具。
- 不在文档或配置中保存服务器明文密码、API Key 或其他敏感凭据。

## Goals / Non-Goals

**Goals:**

- 交付一个可访问的 Web 应用。
- 前端实现问题工作台、Agent 推荐确认、圆桌现场、Agent 库和输出中心。
- 后端实现 REST API，支撑任务画像、Agent 匹配、圆桌编排、结构化事件、报告生成和 Agent 管理。
- 首期部署到华为云单机服务器。
- 通过 OpenSpec 管理需求、设计、任务和验收。
- 保留未来部门云协作的账号、权限、共享和审计扩展点。

**Non-Goals:**

- 不做 Agent 市场。
- 不做商业化计费。
- 不做完整多人实时协作。
- 不做复杂组织权限。
- 不做全自动联网事实核验。
- 不把 Codex 设计成用户侧 AI 运行时。
- 不在仓库中保存生产密钥或服务器密码。

## Decisions

### Decision 1: 前后端分离 Web 架构

选择：

```text
Frontend Web App
  -> Backend API
  -> Roundtable Orchestrator
  -> Agent Runtime
  -> OpenAI API Adapter
  -> Data Store
```

理由：

- 前端可独立迭代体验。
- 后端可以统一控制 Agent、权限、事件、证据和模型调用。
- 后续云端部门版可以扩展账号、部门空间、审计和配额。

替代方案：

- 前后端一体式服务：上线快，但后续扩展和权限治理更差。
- 纯静态前端直连模型 API：安全风险高，无法保护 API Key，也无法做审计和工具权限网关。

### Decision 2: 首期单机部署，保留服务边界

选择：

```text
Huawei Cloud ECS
  Nginx
    /          -> Frontend static assets
    /api       -> Backend API service
  Backend process manager
  Data storage
```

理由：

- 单机部署足够支撑首期体验验证。
- 运维成本低。
- 保留 `/api` 边界，后续可迁移到容器、负载均衡或多服务部署。

替代方案：

- Kubernetes：首期过重。
- 全 Serverless：对本地文件、Agent 库、长流程调试不够直接。

### Decision 3: OpenAI API 作为 AI 运行时

选择：

- 任务画像、Agent 推荐、圆桌事件、报告生成使用 OpenAI API。
- 关键输出必须使用结构化 schema。
- 工具调用必须经过后端权限网关。
- Codex 仅用于开发和代码任务。

理由：

- 产品运行时需要稳定 API、权限控制、数据隔离和审计。
- Codex 的定位是 coding agent，不适合作为用户请求运行时。

### Decision 4: MVP 数据存储先简单，但模型不随意

首期可以使用 SQLite 或 PostgreSQL。建议：

- 本地开发：SQLite。
- 华为云首期：PostgreSQL 优先；如果部署成本要最低，可以 SQLite 起步但要封装 Repository 层。

核心数据必须结构化：

- `users`
- `agent_profiles`
- `agent_versions`
- `roundtable_sessions`
- `task_profiles`
- `trace_events`
- `evidence_items`
- `artifacts`
- `agent_share_records`

### Decision 5: Agent 源先接本地/服务器文件，后续接共享库

首期：

- 读取服务器上的基础公共 Agent。
- 支持用户创建个人 Agent。
- 支持共享状态记录。

后续云端部门版：

- 增加部门空间。
- 增加共享审核。
- 增加跨用户可见性。
- 增加审计和撤回。

### Decision 6: 部署安全默认收紧

部署前必须：

- 更换服务器 root 密码或禁用 root 密码登录。
- 创建非 root 部署用户。
- 使用 SSH Key 登录。
- 防火墙仅开放必要端口。
- API Key 存环境变量或服务器密钥管理，不写入仓库。
- Nginx 配置 HTTPS。

## Risks / Trade-offs

- Root 密码已在对话中出现 → 立即更换密码、使用 SSH Key、禁用 root 密码登录。
- 单机部署后续扩展有限 → 先通过清晰服务边界和数据模型降低迁移成本。
- SQLite 上线简单但并发和备份弱 → 如果部门多人试用，优先 PostgreSQL。
- AI 输出不稳定 → 强制结构化 schema、重试、失败状态和人工确认。
- 圆桌可能退化为聊天流 → 前端必须以阶段、事件卡、争议地图和证据缺口为主体。
- Agent 共享可能泄露个人信息 → 共享前做敏感信息检查和发布确认。

## Migration Plan

1. 在 OpenSpec 中完成首期 Web MVP change。
2. 根据 tasks 创建项目代码结构。
3. 本地完成前后端开发和接口联调。
4. 使用模拟 AI 执行器先验证状态机。
5. 接入 OpenAI API 并启用结构化输出。
6. 在华为云服务器创建部署用户、配置 SSH Key、防火墙、Nginx。
7. 部署前端静态资源和后端服务。
8. 配置 HTTPS、环境变量、日志和备份。
9. 使用 3 个验收任务跑通端到端流程。
10. 通过后归档 OpenSpec change，合并主规格。

Rollback:

- 前端保留上一个构建包。
- 后端使用进程管理器保留上一版本启动命令。
- 数据库迁移必须先备份。
- OpenAI API 切换失败时回退到模拟执行器，保证 UI 可演示。

## Open Questions

- 前端技术栈最终是否采用 React + Vite。
- 后端技术栈最终采用 Node.js 还是 Python。
- 华为云首期数据库使用 PostgreSQL 还是 SQLite。
- 是否首期就启用登录，还是先做单用户管理员模式。
- OpenAI API Key 由个人配置还是部门统一配置。
