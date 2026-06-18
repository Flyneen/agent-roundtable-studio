## Why

Agent Roundtable Studio 已完成产品级 OpenSpec 基线，现在需要进入首期 Web 版开发。首期目标不是做完整云协作平台，而是先交付一个可部署、可验证、前后端分离的 Web MVP，让用户能完成从问题输入、Agent 匹配、结构化圆桌到可追溯报告的核心闭环。

## What Changes

- 建设首期 Web 应用，采用前后端分离架构。
- 前端提供问题工作台、Agent 推荐确认、圆桌现场、Agent 库、输出中心等核心页面。
- 后端提供任务画像、Agent 检索/匹配、圆桌编排、结构化事件、报告生成和 Agent 管理 API。
- AI 运行时按 OpenAI API 设计，Codex 仅用于开发、维护和代码任务。
- 部署目标为华为云服务器，首期采用单机部署，保留未来部门云协作扩展点。
- 不在首期实现真实多人协作、复杂组织权限、商业化、Agent 市场或全量云端共享治理。

## Capabilities

### New Capabilities

- `web-mvp-frontend-backend`: 首期 Web 版前后端分离应用、API、运行时和部署能力。

### Modified Capabilities

- `agent-roundtable-studio`: 补充首期 Web MVP 的交付范围、前后端分离约束、部署要求和华为云单机上线要求。

## Impact

- 新增前端 Web 应用。
- 新增后端 API 服务。
- 新增 Agent Runtime / Roundtable Orchestrator。
- 新增本地或服务器端数据存储。
- 新增部署配置、进程管理、反向代理、环境变量和日志策略。
- 更新 OpenSpec 正式规格和任务清单，作为开发验收门禁。
