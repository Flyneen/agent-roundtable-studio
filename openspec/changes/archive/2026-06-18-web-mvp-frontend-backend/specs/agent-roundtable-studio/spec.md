## ADDED Requirements

### Requirement: First Web Release Scope
The system SHALL deliver the first release as a Web application with separated frontend and backend components.

#### Scenario: Release scope is evaluated
- **WHEN** the first release is evaluated
- **THEN** browser-based access, frontend/backend separation, backend API, structured roundtable orchestration, and deployability are required

#### Scenario: Non-Web platform is requested
- **WHEN** desktop or mobile app support is requested during the first release
- **THEN** it is recorded as a future option and does not block the Web MVP

### Requirement: Codex Development Role
The system SHALL treat Codex as a development tool rather than product runtime.

#### Scenario: Development work is performed
- **WHEN** code needs to be generated, reviewed, tested, or deployed
- **THEN** Codex can be used as the engineering assistant

#### Scenario: User roundtable is executed
- **WHEN** an end user starts a roundtable in the Web application
- **THEN** the system uses the backend runtime and OpenAI API adapter rather than Codex as the serving runtime
