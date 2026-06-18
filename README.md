# Agent Roundtable Studio Open Spec

> 产品定位：结构化问题审议工作台 / Agent 工作流 Studio  
> 当前阶段：MVP-0 产品规格基线  
> 优先级：体验优先，不为商业化、实现难度或演示效果牺牲核心可用性  
> 创建日期：2026-06-17

## 规格文件

1. [01-product-experience-charter.md](01-product-experience-charter.md)  
   产品体验总纲，定义产品不是什么、核心体验原则、目标用户、关键场景和体验红线。

2. [02-roundtable-workflow-state-machine.md](02-roundtable-workflow-state-machine.md)  
   圆桌工作流状态机，定义从问题输入到最终报告的阶段、状态、门禁、用户介入点和失败处理。

3. [03-agent-data-trust-model.md](03-agent-data-trust-model.md)  
   Agent 数据模型与信任模型，定义新增员工、版本、能力声明、验收、信任状态和默认权限。

4. [04-discussion-evidence-event-model.md](04-discussion-evidence-event-model.md)  
   讨论事件与证据结构，定义观点、质疑、回应、修正、共识、分歧、证据缺口和可追溯报告。

5. [05-information-architecture.md](05-information-architecture.md)  
   核心页面信息架构，定义问题工作台、Agent 库、圆桌现场、争议地图、证据台账、输出中心和模板中心。

6. [06-mvp0-acceptance-criteria.md](06-mvp0-acceptance-criteria.md)  
   MVP-0 验收标准，定义首版必须做到什么、不做什么、如何判断体验过关。

7. [07-agent-request-and-sharing-flow.md](07-agent-request-and-sharing-flow.md)  
   诉求驱动的 Agent 匹配、生成与共享流程，定义基础公共、个人、共享三类 Agent 资产。

8. [08-cloud-ai-runtime-decision.md](08-cloud-ai-runtime-decision.md)  
   云端 AI 运行时决策，定义 OpenAI API、Responses API、Agents SDK、Codex 的职责边界。

9. [checklists/spec-quality-checklist.md](checklists/spec-quality-checklist.md)  
   规格质量检查清单，作为进入技术方案和开发前的自检门禁。

## 核心判断

这个产品不能做成“多 Agent 聊天室”。它必须把一次高质量思考拆成可观察、可质疑、可修正、可追溯、可复用的工作流。

MVP-0 允许不做商业化、团队协作、Agent 市场和复杂权限系统，但不能牺牲以下能力：

- 自动分析问题并生成任务画像。
- 推荐合适 Agent，并解释选用和未选用理由。
- 支持用户先提诉求，系统先匹配已有 Agent；不足时生成个人 Agent。
- 支持个人 Agent 转为共享 Agent，并保留来源与版本链。
- 组织固定结构的圆桌讨论，而不是自由群聊。
- 保存结构化讨论事件，而不是只保存聊天文本。
- 明确证据、前提、争议、修正和采纳理由。
- 支持按现有 Agent 设计模式新增员工，并经过测试后进入推荐池。
- 最终报告可追溯到 Agent、版本、输入、质疑和证据。
- 云端产品运行时使用 OpenAI API；Codex 作为开发、维护和代码任务工具，不作为用户侧圆桌运行时。

## 推荐下一步

1. 基于本规格生成技术方案：数据模型、服务边界、Worker 编排、前端页面结构。
2. 输出低保真页面原型：问题工作台、圆桌现场、争议地图、Agent 新增页。
3. 建立第一批真实任务样例，用于验收 Agent 推荐和圆桌质量。
4. 为后续部门云协作预留组织空间、权限和共享机制。
5. 进入技术方案时以 OpenAI API / Responses API / Agents SDK 设计运行时。
6. 再进入代码实现，不要先做“头像聊天 UI”。
