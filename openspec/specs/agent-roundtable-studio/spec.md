# Agent Roundtable Studio Specification

## Purpose

Agent Roundtable Studio 是面向复杂问题的结构化审议工作台。系统必须帮助用户把问题转成任务画像，自动匹配合适 Agent，组织有观点、质疑、回应、修正、共识、分歧和证据缺口的圆桌讨论，并输出可追溯、可复用的高质量报告。

本规格聚合了根目录中的可读规格文档：

- `01-product-experience-charter.md`
- `02-roundtable-workflow-state-machine.md`
- `03-agent-data-trust-model.md`
- `04-discussion-evidence-event-model.md`
- `05-information-architecture.md`
- `06-mvp0-acceptance-criteria.md`
- `07-agent-request-and-sharing-flow.md`
- `08-cloud-ai-runtime-decision.md`
## Requirements
### Requirement: Product Identity

The system SHALL be a structured problem-review workspace, not a multi-agent chatroom.

#### Scenario: User starts a complex task

- **WHEN** a user enters a complex problem
- **THEN** the system presents the workflow as task profiling, agent selection, structured roundtable review, dispute/evidence review, and final artifact generation
- **AND** the system does not default to a plain chat stream as the primary interface

#### Scenario: Roundtable is incomplete

- **WHEN** a roundtable has not completed challenge and response stages
- **THEN** the system SHALL NOT mark the result as a complete expert consensus

### Requirement: Task Profile Generation

The system SHALL generate a structured task profile before recommending agents.

#### Scenario: Task profile is created

- **WHEN** the user submits a problem and optional background material
- **THEN** the system generates a task profile containing task type, target output, constraints, required expert perspectives, risk level, and evidence needs

#### Scenario: User edits task profile

- **WHEN** the generated task profile is incomplete or inaccurate
- **THEN** the user can edit the profile before the roundtable starts

### Requirement: Agent Recommendation

The system SHALL automatically assemble the agent panel based on the task profile and explain matching, gaps, auto-generated agents, inclusion, and exclusion decisions.

#### Scenario: Agent panel is recommended

- **WHEN** a task profile is available
- **THEN** the system automatically recommends a panel of agents without requiring the user to know which agents are needed
- **AND** each recommended agent includes role, fit reason, covered dimension, trust status, and material access level

#### Scenario: Agent assembly process is visible

- **WHEN** the system assembles a panel
- **THEN** the user sees the process steps for perspective detection, candidate search, coverage check, auto-fill, and final panel formation

#### Scenario: Coverage gap is detected

- **WHEN** existing visible agents do not cover a required perspective
- **THEN** the system creates or reuses a personal trial agent for the current user
- **AND** the generated agent is visible in the assembly trace and final panel
- **AND** the generated agent does not enter the public or shared default pool automatically

#### Scenario: Candidate is excluded

- **WHEN** a candidate agent is not recommended
- **THEN** the system records and displays the exclusion reason when relevant to user decision-making

### Requirement: Agent Classes

The system SHALL distinguish three agent classes: system public agents, personal private agents, and shared public agents.

#### Scenario: Agent is displayed

- **WHEN** an agent appears in the library, recommendation panel, or report
- **THEN** the system displays whether it is a base public agent, personal agent, or shared agent

#### Scenario: Personal agent is created

- **WHEN** the system creates an agent for a user's specific request
- **THEN** the agent defaults to personal ownership, owner-only visibility, trial status, and non-default-pool eligibility

#### Scenario: Shared agent is published

- **WHEN** a user shares a personal agent
- **THEN** the system creates a shared version with source, publisher, version, sharing scope, and reuse policy preserved

### Requirement: Request-Driven Agent Creation

The system SHALL own agent creation during task assembly, while preserving an auxiliary manual request path for advanced users.

#### Scenario: User submits only a problem

- **WHEN** the user submits a problem without naming any agents
- **THEN** the system infers required expert perspectives, searches existing visible agents, and creates personal trial agents only for uncovered perspectives

#### Scenario: Existing agent matches request

- **WHEN** a user describes the kind of expert they need
- **THEN** the system searches base public agents, the user's personal agents, and shared agents before proposing new agent creation

#### Scenario: No existing agent covers request

- **WHEN** existing agents do not sufficiently cover the request
- **THEN** the system generates a personal agent draft with identity, responsibilities, capabilities, boundaries, output style, forbidden behavior, permissions, and test cases

### Requirement: Agent Trust And Versioning

The system SHALL track stable agent identity, immutable versions, source identity, trust status, and capability verification.

#### Scenario: Agent changes

- **WHEN** an agent's prompt, role, permissions, capability tags, or source metadata changes
- **THEN** the system creates a new immutable agent version

#### Scenario: Report references agent

- **WHEN** a final report includes an agent contribution
- **THEN** the report identifies the exact agent version used

#### Scenario: New agent is unverified

- **WHEN** a new or generated agent is created
- **THEN** the system prevents it from entering the default recommendation pool until it passes required checks or explicit approval

### Requirement: Structured Roundtable State Machine

The system SHALL run roundtables through explicit stages: problem input, task profile, candidate discovery, recommendation, confirmation, independent positions, challenges, responses, revisions, consensus, evidence review, final artifact, and asset saving.

#### Scenario: Roundtable starts

- **WHEN** the user confirms the agent panel
- **THEN** the system creates a session with task profile snapshot, agent version snapshot, material access policy, discussion plan, and output plan

#### Scenario: User intervenes

- **WHEN** the roundtable is in progress
- **THEN** the user can pause, supplement material, request stronger challenge, ask for elaboration, or trigger early synthesis without losing completed structured events

### Requirement: Structured Discussion Events

The system SHALL store structured events for positions, challenges, responses, revisions, consensus, disagreements, evidence gaps, and adoption decisions.

#### Scenario: Agent submits position

- **WHEN** an agent submits an initial view
- **THEN** the system stores a position event with claim, rationale, assumptions, risks, evidence references, confidence level, and challenge request

#### Scenario: Agent challenges a claim

- **WHEN** an agent challenges another agent's view
- **THEN** the system links the challenge to the target position and records challenge type, severity, text, required response, and evidence references

#### Scenario: View is revised

- **WHEN** a challenge causes a view to change
- **THEN** the system stores the original position, revised claim, reason, triggering challenge, and impact level

### Requirement: Evidence And Traceability

The system SHALL distinguish supported claims, inferred claims, missing evidence, and claims requiring external verification.

#### Scenario: Final report contains important conclusion

- **WHEN** the final report contains a key conclusion
- **THEN** the user can trace it to supporting events, opposing events, evidence status, agent version, and adoption reason

#### Scenario: Evidence is missing

- **WHEN** a claim lacks sufficient evidence
- **THEN** the system records an evidence gap with missing evidence, why it is needed, risk if missing, suggested source, and priority

### Requirement: Information Architecture

The system SHALL provide interfaces for the problem workspace, agent recommendation, roundtable live view, dispute map, evidence ledger, output center, agent library, template center, and settings.

#### Scenario: User reviews roundtable live view

- **WHEN** the roundtable is running
- **THEN** the user sees stage progress, participating agents, agent status, position cards, challenge cards, response cards, revision cards, disputes, and evidence gaps

#### Scenario: User manages agents

- **WHEN** the user opens the agent library
- **THEN** the system shows agent class, ownership, source, version, trust status, capability tags, boundaries, permissions, test cases, and sharing state

### Requirement: MVP-0 Scope

The MVP-0 SHALL prioritize a local, personal-workbench experience and SHALL NOT require commercial, team, marketplace, or full cloud collaboration capabilities.

#### Scenario: MVP-0 release is evaluated

- **WHEN** MVP-0 is evaluated
- **THEN** it passes only if end-to-end task profile, agent recommendation, structured roundtable, traceable report, request-driven personal agent creation, and local sharing-state recording work

#### Scenario: Cloud collaboration is requested

- **WHEN** department cloud usage is discussed during MVP-0
- **THEN** the system records account, department space, permission, audit, isolation, and shared-agent governance needs as future-version requirements rather than MVP-0 blockers

### Requirement: Cloud AI Runtime

The cloud product runtime SHALL use OpenAI API for model execution and SHALL NOT use Codex as the user-facing roundtable runtime.

#### Scenario: Cloud runtime is designed

- **WHEN** the cloud architecture is designed
- **THEN** it uses OpenAI API, with Responses API, Structured Outputs, Tool or Function Calling, and optionally Agents SDK for complex orchestration

#### Scenario: Codex is used

- **WHEN** Codex is used in this project
- **THEN** it is used for development, code maintenance, code review, automated engineering tasks, tests, and deployment work
- **AND** it is not responsible for serving department users' roundtable sessions

#### Scenario: Tools access data

- **WHEN** an agent requests file, network, database, or tool access
- **THEN** the request goes through the product's policy gateway, tool gateway, and evidence gateway rather than direct model access

### Requirement: First Web Release Scope
The system SHALL deliver the first release as a Web application with a separated frontend, Java API Gateway, and Python AI Orchestrator.

#### Scenario: Release scope is evaluated
- **WHEN** the first release is evaluated
- **THEN** browser-based access, Java API Gateway, Python AI Orchestrator, structured roundtable orchestration, and deployability are required

#### Scenario: Non-Web platform is requested
- **WHEN** desktop or mobile app support is requested during the first release
- **THEN** it is recorded as a future option and does not block the Web MVP

### Requirement: Containerized Huawei Cloud Deployment
The system SHALL deploy the first Web release as containerized Java and Python microservices behind the existing `8181` gateway.

#### Scenario: Application is deployed on Huawei Cloud
- **WHEN** the first Web release is deployed
- **THEN** `agent-roundtable-studio` runs as the Java API Gateway serving frontend static files, `/api/*`, and `/health`
- **AND** `ai-orchestrator-python` runs as the internal Python AI Orchestrator for task profiling, agent assembly, roundtable execution, and report synthesis
- **AND** persistent workflow data is stored through a mounted server-side volume

#### Scenario: Existing gateway is reused
- **WHEN** public access is configured
- **THEN** the existing `gateway-nginx-8181` routes `/agent-roundtable-studio/` to the Java API Gateway container
- **AND** the deployment does not require a new public port whitelist

#### Scenario: Application container is isolated
- **WHEN** the service is running
- **THEN** the Java API Gateway is reachable by the gateway over the internal Docker network
- **AND** the Python AI Orchestrator is reachable only from internal services
- **AND** neither service exposes backend ports directly to the public internet

### Requirement: Codex Development Role
The system SHALL treat Codex as a development tool rather than product runtime.

#### Scenario: Development work is performed
- **WHEN** code needs to be generated, reviewed, tested, or deployed
- **THEN** Codex can be used as the engineering assistant

#### Scenario: User roundtable is executed
- **WHEN** an end user starts a roundtable in the Web application
- **THEN** the system uses the backend runtime and OpenAI API adapter rather than Codex as the serving runtime
