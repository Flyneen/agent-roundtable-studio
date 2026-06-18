# web-mvp-frontend-backend Specification

## Purpose
This specification defines the first Web release of Agent Roundtable Studio: a browser frontend, Java API Gateway, Python AI Orchestrator, structured roundtable runtime, deployment model, and minimum security controls for the Huawei Cloud preview.
## Requirements
### Requirement: Web MVP Frontend
The system SHALL provide a browser-based frontend for the first release.

#### Scenario: User opens the web app
- **WHEN** the user visits the application URL
- **THEN** the system displays a web interface with entry points for problem workspace, agent library, roundtable sessions, output center, and settings

#### Scenario: User creates a roundtable task
- **WHEN** the user enters a problem and optional background material
- **THEN** the frontend guides the user through task profiling, automatic agent panel assembly, roundtable execution, and final report review

#### Scenario: User reviews automatic agent assembly
- **WHEN** the backend returns the recommended panel
- **THEN** the frontend displays perspective detection, candidate search, coverage status, auto-generated personal agents, and final panel reasons

### Requirement: Separated Backend API
The system SHALL provide a Java API Gateway separated from the frontend and from the Python AI Orchestrator.

#### Scenario: Frontend requests task profile
- **WHEN** the frontend submits a problem to the backend
- **THEN** the Java API Gateway delegates AI work to the Python AI Orchestrator
- **AND** the response returns a structured task profile rather than free-form text only

#### Scenario: Frontend requests roundtable state
- **WHEN** the frontend queries a roundtable session
- **THEN** the backend returns session state, stage, participating agents, trace events, evidence gaps, and artifacts

### Requirement: Roundtable Orchestrator
The system SHALL implement a Python AI Orchestrator for staged execution.

#### Scenario: User starts a session
- **WHEN** the user confirms the agent panel
- **THEN** the orchestrator creates a roundtable session with task profile snapshot, agent version snapshot, material access policy, and execution plan

#### Scenario: Roundtable stage advances
- **WHEN** a stage completes
- **THEN** the orchestrator advances to the next stage and records structured trace events

### Requirement: Agent Runtime
The system SHALL provide an agent runtime abstraction independent from the frontend and Java API Gateway.

#### Scenario: Agent is invoked
- **WHEN** the orchestrator invokes an agent
- **THEN** the runtime uses the agent version, task profile, allowed context, and expected output schema to produce a structured event

#### Scenario: Agent fails
- **WHEN** an agent invocation fails
- **THEN** the system records the failure and allows retry, replacement, or partial continuation

### Requirement: OpenAI API Runtime
The system SHALL use OpenAI API as the product AI runtime when real model execution is enabled.

#### Scenario: Real model execution is enabled
- **WHEN** the Python AI Orchestrator needs task profiling, agent recommendation, structured event generation, or report generation
- **THEN** it calls OpenAI-compatible API through a server-side adapter
- **AND** the assembly trace records runtime mode, schema name, model, call status, and latency

#### Scenario: API key is configured
- **WHEN** OpenAI API is used
- **THEN** the API key is read from server-side environment configuration and is never exposed to the frontend

### Requirement: Simulated Runtime
The system SHALL support a clearly labeled development-degraded runtime for local development and fallback.

#### Scenario: API is unavailable
- **WHEN** the OpenAI API key is missing or the API call fails during development
- **THEN** the system can run a deterministic degraded execution path to validate UI and workflow state
- **AND** the UI and API mark the result as `dev` or `dev_degraded_missing_key`
- **AND** the system SHALL NOT present that result as production-quality AI reasoning

### Requirement: Structured Data Store
The system SHALL persist core workflow data in structured storage.

#### Scenario: Session is saved
- **WHEN** a roundtable session is created or updated
- **THEN** the system stores session metadata, task profile, agent versions, trace events, evidence gaps, and artifacts

#### Scenario: Report is generated
- **WHEN** the final report is generated
- **THEN** the system stores the report and maintains trace links to source events

### Requirement: Agent Library Management
The system SHALL support base public agents, personal agents, and shared agent state in the Web MVP.

#### Scenario: User opens agent library
- **WHEN** the user opens the agent library
- **THEN** the system displays agent class, owner, source, version, trust status, capabilities, boundaries, and sharing state

#### Scenario: User requests a new agent
- **WHEN** the user submits a task whose required perspective is not covered by existing visible agents
- **THEN** the system first searches available agents and automatically generates a personal trial agent only when coverage is insufficient

### Requirement: Huawei Cloud Deployment
The system SHALL support first-release deployment to a Huawei Cloud server.

#### Scenario: Application is deployed
- **WHEN** the Web MVP is deployed on the server
- **THEN** the frontend and Java API Gateway run in `agent-roundtable-studio`
- **AND** the Python AI Orchestrator runs in `ai-orchestrator-python`
- **AND** both services are deployed by Docker Compose on an internal Docker network

#### Scenario: Deployment uses secrets
- **WHEN** production secrets are required
- **THEN** they are stored as server-side environment variables or secret files outside source control

#### Scenario: Existing 8181 gateway is used
- **WHEN** the application is exposed publicly on Huawei Cloud
- **THEN** the existing `8181` gateway Nginx routes `/agent-roundtable-studio/` traffic to the application container
- **AND** no additional public application port is required

#### Scenario: Application data is persisted
- **WHEN** the application container is recreated or upgraded
- **THEN** workflow data remains available through a mounted server-side data volume

### Requirement: Deployment Security
The system SHALL apply minimum deployment security controls before public access.

#### Scenario: Server is prepared
- **WHEN** the server is prepared for deployment
- **THEN** root password login is disabled or replaced with SSH key access, a non-root deployment user is created, and only required ports are opened

#### Scenario: Public traffic is enabled
- **WHEN** public access is enabled
- **THEN** the system uses the approved gateway entry and does not expose backend or application container ports directly to the internet
