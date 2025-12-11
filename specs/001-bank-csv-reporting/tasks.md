---

description: "Task list template for feature implementation"
---

# Tasks: Bank CSV Reporting

**Input**: Design documents from `/specs/001-bank-csv-reporting/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: Include tests for Data Accuracy, Business Logic, and Performance SLOs per Constitution.

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Web app** with multiple services
- Paths below assume structure defined in plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 Create base folders per plan in backend/ingestion, backend/reporting, frontend, infra/kubernetes, infra/github-actions
- [x] T002 Initialize Node/TS project for ingestion in backend/ingestion (package.json, tsconfig.json)
- [x] T003 Initialize Spring Boot project for reporting in backend/reporting (build.gradle or pom.xml)
- [x] T004 Initialize React/TS project in frontend (package.json, tsconfig.json, vite or CRA)
- [x] T005 [P] Add Dockerfiles for each service at backend/ingestion/Dockerfile, backend/reporting/Dockerfile, frontend/Dockerfile
- [ ] T006 [P] Add docker-compose.yaml under infra/ for local dev (PostgreSQL + services)
- [ ] T007 Configure GitHub Actions workflows under infra/github-actions for CI (lint, typecheck, tests)
- [ ] T008 Add shared code style and linting (ESLint/Prettier for Node/Frontend; Checkstyle/Spotless for Java)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [ ] T009 Setup PostgreSQL schema migrations (ingestion: backend/ingestion/src/db/migrations/, reporting reads same DB)
- [ ] T010 [P] Implement DB connection factories and env config (backend/ingestion/src/config/db.ts, backend/reporting/src/main/resources/application.yml)
- [ ] T011 [P] Create base entities and repositories matching data-model.md (ingestion: src/domain/*, reporting: src/main/java/.../domain/*)
- [ ] T012 Implement OAuth2/JWT middleware (ingestion: src/middleware/auth.ts, reporting: SecurityConfig.java)
- [ ] T013 Add RBAC guards for Admin/Viewer/Auditor roles (ingestion: src/middleware/rbac.ts, reporting: method security)
- [ ] T014 Setup test frameworks (Jest/Vitest in ingestion; JUnit + Testcontainers in reporting; RTL/Playwright in frontend)
- [ ] T015 Add CI jobs for EXPLAIN-plan capture on key report queries (infra/github-actions/report-perf.yml)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Upload Monthly CSV & Map Accounts (Priority: P1) 🎯 MVP

**Goal**: Upload CSV, map to Account, preview normalization, idempotent import.

**Independent Test**: Re-import same CSV → 0 new rows; parentheses normalization accurate.

### Tests for User Story 1 (REQUIRED by Constitution)

- [ ] T016 [P] [US1] Add schema validation for CSV required headers (Data, Documento, Valor) in backend/ingestion/src/ingest/csvSchema.ts
- [ ] T017 [P] [US1] Unit tests for parser: pt-BR date/number parsing, parentheses→negative at backend/ingestion/test/parser.spec.ts
- [ ] T018 [P] [US1] Integration test: idempotent import using Testcontainers PG at backend/ingestion/test/import-idempotency.it.spec.ts

### Implementation for User Story 1

- [ ] T019 [US1] Implement CSV parser with trimming/locale handling at backend/ingestion/src/ingest/csvParser.ts
- [ ] T020 [US1] Implement import service (checksum, batch, dedup) at backend/ingestion/src/ingest/importService.ts
- [ ] T021 [US1] Implement POST /imports endpoint per OpenAPI at backend/ingestion/src/http/importsRoute.ts
- [ ] T022 [US1] Implement GET /imports/{id} status endpoint at backend/ingestion/src/http/importStatusRoute.ts
- [ ] T023 [US1] DB migrations: tables for Account, ImportBatch, Transaction at backend/ingestion/src/db/migrations/*.sql
- [ ] T024 [P] [US1] Frontend upload screen with account mapping at frontend/src/pages/UploadPage.tsx
- [ ] T025 [US1] Frontend preview component showing normalization/dedup summary at frontend/src/components/import/ImportPreview.tsx

**Checkpoint**: US1 should be fully functional and independently testable

---

## Phase 4: User Story 2 - Rule-based Classification (Priority: P1)

**Goal**: Auto-classify using Documento rules; store rule/version; explainability.

**Independent Test**: Given rules, import classifies rows and stores rationale + rule refs.

### Tests for User Story 2

- [ ] T026 [P] [US2] Contract tests for /rules endpoints at backend/ingestion/test/rules.contract.spec.ts
- [ ] T027 [P] [US2] Unit tests for matcher (case-insensitive, accent-folded) at backend/ingestion/test/matcher.spec.ts

### Implementation for User Story 2

- [ ] T028 [US2] Implement Rule entity/versioning and repository at backend/ingestion/src/domain/rule.ts
- [ ] T029 [US2] Implement matcher library (contains/regex, accent-folded) at backend/ingestion/src/classify/matcher.ts
- [ ] T030 [US2] Integrate classification into import pipeline at backend/ingestion/src/classify/classificationService.ts
- [ ] T031 [US2] Implement GET/POST /rules per OpenAPI at backend/ingestion/src/http/rulesRoute.ts
- [ ] T032 [P] [US2] Frontend Rules management page at frontend/src/pages/RulesPage.tsx
- [ ] T033 [US2] Persist rationale, rule id/version in Transaction at backend/ingestion/src/db/migrations/*.sql

**Checkpoint**: US2 functional; imports classify with stored explainability

---

## Phase 5: User Story 3 - Manual Review & Overrides (Priority: P1)

**Goal**: Review queue for unclassified, audited overrides, rule-from-decision.

**Independent Test**: Review marks classified, creates audit record, updates aggregates.

### Tests for User Story 3

- [ ] T034 [P] [US3] Contract tests for /transactions/unclassified and /transactions/{id}/override at backend/ingestion/test/review.contract.spec.ts

### Implementation for User Story 3

- [ ] T035 [US3] Implement list unclassified endpoint at backend/ingestion/src/http/unclassifiedRoute.ts
- [ ] T036 [US3] Implement override endpoint storing audit trail at backend/ingestion/src/http/overrideRoute.ts
- [ ] T037 [P] [US3] Frontend Review queue page at frontend/src/pages/ReviewPage.tsx
- [ ] T038 [US3] Frontend Override form with optional "create rule from decision" at frontend/src/components/review/OverrideForm.tsx
- [ ] T039 [US3] DB migrations for ClassificationOverride table and audit columns at backend/ingestion/src/db/migrations/*.sql

**Checkpoint**: US3 functional; transparency assured

---

## Phase 6: User Story 4 - Aggregated Reports with Drill-down (Priority: P1)

**Goal**: p95 < 500ms aggregates; drill-down to contributing transactions.

**Independent Test**: Summaries fast; drill-down equals exact contributing rows.

### Tests for User Story 4

- [ ] T040 [P] [US4] Performance tests for summaries p95/p99 using realistic dataset at backend/reporting/src/test/java/.../SummaryPerfTest.java
- [ ] T041 [P] [US4] Contract tests for GraphQL queries (summaries, drillDown) at backend/reporting/src/test/java/.../GraphQLContractTest.java

### Implementation for User Story 4

- [ ] T042 [US4] Implement materialized view and refresh logic at backend/reporting/src/main/resources/db/migration/*.sql
- [ ] T043 [US4] Implement GraphQL schema resolvers for summaries/drillDown at backend/reporting/src/main/java/.../graphql/Resolvers.java
- [ ] T044 [US4] Add indexes/partial indexes to support sargable queries at backend/reporting/src/main/resources/db/migration/*.sql
- [ ] T045 [US4] CI step to capture EXPLAIN plans and fail on regressions at infra/github-actions/report-perf.yml
- [ ] T046 [P] [US4] Frontend reports page (month/year filter) at frontend/src/pages/ReportsPage.tsx
- [ ] T047 [P] [US4] Frontend category drill-down view with pagination/filters at frontend/src/components/reports/DrillDown.tsx

**Checkpoint**: US4 functional; performance SLOs satisfied

---

## Phase N: Polish & Cross-Cutting Concerns

- [ ] T048 [P] Documentation updates in specs/001-bank-csv-reporting/quickstart.md
- [ ] T049 Code cleanup, error handling hardening, and logging (structured) across services
- [ ] T050 [P] Visual tests/Storybook for shared components at frontend/.storybook and frontend/src/components/*
- [ ] T051 Security hardening (rate limits on ingestion endpoints, JWT expiry/refresh) at backend/ingestion and backend/reporting
- [ ] T052 Add caching for stable report results with explicit invalidation hooks at backend/reporting/src/main/java/.../cache/*
- [ ] T053 Run quickstart.md validation end-to-end

---

## Dependencies & Execution Order

### Phase Dependencies
- Setup (Phase 1) → Foundational (Phase 2) → User Stories (Phase 3+)
- US1 → US2 (classification pipeline depends on import pipeline)
- US3 depends on US1 (unclassified) and US2 (rule references)
- US4 can start after foundational DB + matview groundwork; final validation after US1-3 data available

### User Story Dependencies
- US1: no prior stories
- US2: depends on US1
- US3: depends on US1 and US2
- US4: can be parallel after foundational but validated after US1-3

### Within Each User Story
- Tests (where included) MUST be written and FAIL before implementation
- Models before services
- Services before endpoints
- Core implementation before integration

### Parallel Opportunities
- [P] tasks in each phase can run in parallel (different files)
- Frontend pages/components often parallel with backend after contracts are defined

---

## Implementation Strategy

### MVP First (User Story 1 Only)
1. Complete Setup + Foundational
2. Implement US1 and validate dedup + normalization
3. Deploy/demo MVP

### Incremental Delivery
1. Add US2 (rules) → Test independently → Deploy
2. Add US3 (review/overrides) → Test → Deploy
3. Add US4 (reports) → Performance validate → Deploy

### Parallel Team Strategy
- Developer A: Ingestion pipeline (US1→US2)
- Developer B: Review/override UI + endpoints (US3)
- Developer C: Reporting GraphQL + indexes/matviews + frontend (US4)
