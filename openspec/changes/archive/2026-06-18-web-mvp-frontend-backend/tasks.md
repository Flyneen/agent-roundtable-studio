## 1. Project Setup

- [x] 1.1 Create a dedicated application repository or workspace for the Web MVP.
- [x] 1.2 Create frontend and backend directories with separate package management and build scripts.
- [x] 1.3 Add environment configuration templates without real secrets.
- [x] 1.4 Add project README with local development, build, and deployment commands.
- [x] 1.5 Add lint, format, and basic test commands for both frontend and backend.

## 2. Backend Foundation

- [x] 2.1 Implement backend application bootstrap and health check endpoint.
- [x] 2.2 Implement API routing structure for tasks, agents, sessions, events, artifacts, and settings.
- [x] 2.3 Add request validation and normalized error response format.
- [x] 2.4 Add server-side configuration loader for OpenAI API key, storage path, and runtime mode.
- [x] 2.5 Add structured logging with request ID and session ID.

## 3. Data Model And Storage

- [x] 3.1 Define database schema for agent profiles, agent versions, sessions, task profiles, trace events, evidence items, artifacts, and sharing records.
- [x] 3.2 Implement repository layer so storage can move from SQLite to PostgreSQL without changing business logic.
- [x] 3.3 Add database migration mechanism.
- [x] 3.4 Add seed data for base public agents.
- [x] 3.5 Add backup and restore notes for first deployment.

## 4. Agent Library

- [x] 4.1 Implement base public agent loading from server-side files or seed data.
- [x] 4.2 Implement agent listing with class, ownership, source, version, trust status, capabilities, boundaries, and sharing state.
- [x] 4.3 Implement request-driven agent matching against available agents.
- [x] 4.4 Implement personal agent draft generation flow.
- [x] 4.5 Implement personal agent trial status and approval state.
- [x] 4.6 Implement shared-agent state recording without full multi-user sharing in MVP-0.

## 5. Roundtable Runtime

- [x] 5.1 Implement task profile generation service with simulated runtime first.
- [x] 5.2 Implement agent recommendation service with inclusion and exclusion reasons.
- [x] 5.3 Implement roundtable session creation with agent version snapshot and access policy.
- [x] 5.4 Implement staged execution: independent positions, challenges, responses, revisions, consensus, evidence review, final report.
- [x] 5.5 Implement structured trace event writing for each stage.
- [x] 5.6 Implement failure handling for agent failure, insufficient evidence, and partial run.

## 6. OpenAI API Integration

- [x] 6.1 Implement OpenAI API adapter behind an internal interface.
- [x] 6.2 Define JSON schemas for task profile, recommendation, position, challenge, response, revision, consensus, evidence gap, and final report.
- [x] 6.3 Add runtime mode switch between simulated runtime and real OpenAI API runtime.
- [x] 6.4 Ensure OpenAI API key is only read server-side and never sent to frontend.
- [x] 6.5 Add retry, timeout, and structured failure handling.

## 7. Frontend Foundation

- [x] 7.1 Implement app shell, navigation, layout system, and route structure.
- [x] 7.2 Implement API client with typed responses and error states.
- [x] 7.3 Implement global session state for current task and roundtable.
- [x] 7.4 Implement loading, partial failure, and empty states.
- [x] 7.5 Implement responsive layout for desktop and mobile width.

## 8. Core Frontend Pages

- [x] 8.1 Implement problem workspace page.
- [x] 8.2 Implement task profile preview and edit panel.
- [x] 8.3 Implement agent recommendation and panel confirmation page.
- [x] 8.4 Implement roundtable live view with stage progress, agent states, event cards, disputes, and evidence gaps.
- [x] 8.5 Implement agent library page with class filters and detail view.
- [x] 8.6 Implement request-driven personal agent creation UI.
- [x] 8.7 Implement output center with final report, trace links, evidence gaps, and JSON export.

## 9. Security And Permissions

- [x] 9.1 Ensure frontend cannot access model API keys or raw server secrets.
- [x] 9.2 Implement material access labels for agents.
- [x] 9.3 Implement policy gateway stub for file, network, database, and tool access.
- [x] 9.4 Implement sensitive data warning for shared agent publication.
- [x] 9.5 Add server-side CORS and rate-limit defaults suitable for first deployment.

## 10. Local Verification

- [x] 10.1 Add local end-to-end smoke flow using simulated runtime.
- [x] 10.2 Verify task profile to final report flow with at least 3 sample problems.
- [x] 10.3 Verify agent request creates personal agent draft when no existing agent matches.
- [x] 10.4 Verify incomplete roundtable is marked partial rather than complete.
- [x] 10.5 Verify final report links back to trace events.

## 11. Huawei Cloud Deployment

- [x] 11.1 Create a non-root deployment user on the Huawei Cloud server.
- [x] 11.2 Configure SSH key login and disable or restrict root password login.
- [x] 11.3 Install required runtime dependencies on the server.
- [x] 11.4 Configure firewall/security group to expose only required deployment ports for the current IP-based preview.
- [x] 11.5 Build and upload frontend assets.
- [x] 11.6 Deploy backend service with process manager or systemd.
- [x] 11.7 Configure Nginx to serve frontend and reverse proxy `/api` to backend.
- [x] 11.8 Configure HTTPS certificate.
- [x] 11.9 Configure environment variables for production without writing secrets into source control.
- [x] 11.10 Verify public access through the server IP or domain.

## 12. Release Gate

- [x] 12.1 Run backend tests and frontend build.
- [x] 12.2 Run OpenSpec validation for all specs and changes.
- [x] 12.3 Run browser smoke test against deployed Web app.
- [x] 12.4 Confirm no secrets are committed or written into specs.
- [x] 12.5 Archive the OpenSpec change after implementation is complete and verified.
