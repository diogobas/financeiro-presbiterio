---

description: "Task list template for feature implementation"
---

# Tasks: Bank CSV Reporting

**Input**: Design documents from `/specs/001-bank-csv-reporting/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/


**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.


**Phase A (T016-T020)**: ✅ Complete
- CSV Parser: 48 tests ✅
- Idempotency: 9 tests ✅  
- Import Service: 34 tests ✅
- Reporting Service: 12 tests ✅ (H2 in-memory DB)
- Ingestion Service: 0 errors, 0 linting issues ✅

- POST /imports: 8 integration tests ✅
- GET /imports/{id}: 5 integration tests ✅
- DB Schema: Full schema + migrations ✅
- Repository Implementations: All 3 repos ✅
- Build Status: 0 errors, 0 warnings ✅

**Phase C (T024-T025)**: ✅ Complete - Frontend Components Ready
- Upload Screen: React/TypeScript component ✅
- Preview Component: Import summary component ✅
- Frontend builds without errors ✅

**Phase D (T026-T027)**: ✅ Complete - Test Suite Ready
- Contract Tests for /rules: 31 tests ✅
- Matcher Unit Tests: 66 tests ✅
- Total: 97 tests passing
- All tests follow TDD approach (tests before implementation)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)

## Path Conventions

- **Web app** with multiple services
- Paths below assume structure defined in plan.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T002 Initialize Node/TS project for ingestion in backend/ingestion (package.json, tsconfig.json)
- [x] T003 Initialize Spring Boot project for reporting in backend/reporting (build.gradle or pom.xml)
- [x] T004 Initialize React/TS project in frontend (package.json, tsconfig.json, vite or CRA)
- [x] T005 [P] Add Dockerfiles for each service at backend/ingestion/Dockerfile, backend/reporting/Dockerfile, frontend/Dockerfile
- [x] T007 Configure GitHub Actions workflows under infra/github-actions for CI (lint, typecheck, tests)
- [x] T008 Add shared code style and linting (ESLint/Prettier for Node/Frontend; Checkstyle/Spotless for Java)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T009 Setup PostgreSQL schema migrations (ingestion: backend/ingestion/src/db/migrations/, reporting reads same DB)
- [x] T011 [P] Create base entities and repositories matching data-model.md (ingestion: src/domain/*, reporting: src/main/java/.../domain/*)
- [x] T012 Implement OAuth2/JWT middleware (ingestion: src/middleware/auth.ts, reporting: SecurityConfig.java)
- [x] T013 Add RBAC guards for Admin/Viewer/Auditor roles (ingestion: src/middleware/rbac.ts, reporting: method security)
- [x] T015 Add CI jobs for EXPLAIN-plan capture on key report queries (infra/github-actions/report-perf.yml)

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Upload Monthly CSV & Map Accounts (Priority: P1) 🎯 MVP

**Goal**: Upload CSV, map to Account, preview normalization, idempotent import.
**Independent Test**: Re-import same CSV → 0 new rows; parentheses normalization accurate.

### Tests for User Story 1 (REQUIRED by Constitution)
  - ✅ test/ingest/parser.spec.ts (2,115 loc)
- [x] T018 [P] [US1] Integration test: idempotent import using Testcontainers PG at backend/ingestion/test/import-idempotency.it.spec.ts
  - ✅ 9 tests passing: dedup logic, re-import validation, checksum verification

### Implementation for User Story 1

- [x] T019 [US1] Implement CSV parser with trimming/locale handling at backend/ingestion/src/ingest/csvParser.ts
  - ✅ parseDate: DD/MM/YYYY with validation
  - ✅ parseAmount: pt-BR format (1.234,56) with parentheses→negative
  - ✅ parseCSVRow: full row parsing with normalization
  - ✅ src/ingest/csvParser.ts (180 loc)
- [x] T020 [US1] Implement import service (checksum, batch, dedup) at backend/ingestion/src/ingest/importService.ts
  - ✅ test/ingest/importService.spec.ts (572 loc)
  - Features: Idempotent by file checksum, dedup by (date|doc|amount) hash, status tracking
- [x] T021 [US1] Implement POST /imports endpoint per OpenAPI at backend/ingestion/src/http/importsRoute.ts
  - ✅ 8 integration tests passing
- [x] T022 [US1] Implement GET /imports/{id} status endpoint at backend/ingestion/src/http/importStatusRoute.ts
  - ✅ Batch metadata retrieval with all fields
  - ✅ Percentage classified calculation
  - ✅ Returns 200 with complete status object
  - ✅ src/http/importStatusRoute.ts (67 loc)
- [x] Repository Implementations for data access
  - ✅ PostgresImportBatchRepository: Batch creation, checksum-based dedup detection, pagination
  - ✅ PostgresTransactionRepository: Bulk insert, classification statistics, status filtering
  - ✅ All in src/infrastructure/repositories.ts with proper type mappings
- [x] T024 [P] [US1] Frontend upload screen with account mapping at frontend/src/pages/UploadPage.tsx
  - ✅ File preview (first 6 lines)
  - ✅ Loading/error/success states
  - ✅ Import batch metadata display
  - ✅ Classification statistics with progress bar
  - ✅ frontend/src/components/import/ImportPreview.tsx (223 loc)
  - ✅ frontend/src/components/import/ImportPreview.module.css (280 loc)


## Phase 4: User Story 2 - Rule-based Classification (Priority: P1)

**Goal**: Auto-classify using Documento rules; store rule/version; explainability.

**Independent Test**: Given rules, import classifies rows and stores rationale + rule refs.

### Tests for User Story 2

- [x] T026 [P] [US2] Contract tests for /rules endpoints at backend/ingestion/test/http/rules.contract.spec.ts
  - ✅ 31 tests passing: GET /rules (list, filter, pagination), POST /rules (create, validate), error cases
  - ✅ Covers response schemas, headers, and HTTP status codes
  - ✅ test/http/rules.contract.spec.ts (570 loc)
- [x] T027 [P] [US2] Unit tests for matcher (case-insensitive, accent-folded) at backend/ingestion/test/classify/matcher.spec.ts
  - ✅ Performance validation (10K iterations in <100ms)
  - ✅ test/classify/matcher.spec.ts (612 loc)

### Implementation for User Story 2

- [x] T028 [US2] Implement Rule entity/versioning and repository at backend/ingestion/src/domain/types.ts
  - ✅ Rule domain type with complete fields (name, description, category, tipo, pattern, matchType, version, priority, enabled, timestamps, createdBy)
  - ✅ CreateRuleInput and UpdateRuleInput types for input validation
  - ✅ IRuleRepository interface with 13 methods covering CRUD, filtering, pagination, versioning
  - ✅ PostgresRuleRepository implementation with proper field mapping
  - ✅ Automatic version incrementing on updates
  - ✅ 60+ integration tests for repository operations (postgres-rule.spec.ts)
  - ✅ DB schema migration (003_update_rule_schema.sql): renamed matcher_type to match_type, added name/description/category/priority/enabled/updated_at
  - ✅ Unique constraint on rule name, proper indexes for queries
  - ✅ Build: 0 errors ✅
- [x] T029 [US2] Implement matcher library (contains/regex, accent-folded) at backend/ingestion/src/classify/matcher.ts
  - ✅ DocumentMatcher class: Single-rule pattern matching (CONTAINS/REGEX)
  - ✅ Accent-folded normalization (NFD decomposition, diacritic removal)
  - ✅ Case-insensitive matching with result reasoning
  - ✅ BatchDocumentMatcher class: Multi-rule matching with priorities
  - ✅ Priority-based rule evaluation (higher priority = evaluated first)
  - ✅ findFirstMatch(), findAllMatches(), hasMatch() methods
  - ✅ Utility functions: normalizeDocumento(), matchesContains(), matchesRegex()
  - ✅ 46 integration tests (matcher-integration.spec.ts)
  - ✅ Real-world banco patterns: PADARIA, SALÁRIO, ÁGUA, LUZ, PIX, BOLETO
  - ✅ Error handling: invalid regex, empty patterns, type safety
  - ✅ Test Results: 112 total passing (66 unit + 46 integration)
  - ✅ Build: 0 errors
- [x] T030 [US2] Integrate classification into import pipeline at backend/ingestion/src/classify/classificationService.ts
  - ✅ ClassificationService: integrate matcher library into service layer
  - ✅ initialize(): Load active rules from repository once
  - ✅ classify(): Single transaction classification against rules
  - ✅ classifyBatch(): Efficient batch classification with ordering
  - ✅ reload(): Refresh rules when they change
  - ✅ Priority-based rule evaluation (higher priority = evaluated first)
  - ✅ Accept active rules from repository (T028 data source)
  - ✅ Create BatchDocumentMatcher instance with rules (T029 matcher)
  - ✅ Store rule_id, rule_version, rationale in results
  - ✅ Mark unclassified transactions with classification_source = 'NONE'
  - ✅ 19 tests: initialization, single/batch classification, reload, real-world scenarios
  - ✅ Build: 0 errors, 279 total tests passing
- [x] T031 [US2] Implement GET/POST /rules per OpenAPI at backend/ingestion/src/http/rulesRoute.ts
  - ✅ GET /rules: List all rules with filtering (category, tipo, enabled) and pagination
  - ✅ POST /rules: Create new rules with validation (unique name, valid regex patterns)
  - ✅ Fastify implementation with proper error handling and HTTP status codes
  - ✅ src/http/rulesRoute.ts (276 loc)
- [x] T032 [P] [US2] Frontend Rules management page at frontend/src/pages/RulesPage.tsx
  - ✅ Rules listing with filtering (category, tipo, enabled status) and pagination
  - ✅ Create new rules form with validation (unique name, valid regex patterns)
  - ✅ Search functionality for rules by name/pattern/description
  - ✅ Real-time form validation with error messages
  - ✅ Display rule details in sortable table format
  - ✅ Responsive design for mobile/desktop
  - ✅ Integrates with GET /rules and POST /rules endpoints
  - ✅ frontend/src/pages/RulesPage.tsx (572 loc)
  - ✅ frontend/src/pages/RulesPage.module.css (680 loc)
  - ✅ Build: 0 errors, 34 modules
- [x] T033 [US2] Persist rationale, rule id/version in Transaction at backend/ingestion/src/db/migrations/*.sql

**Checkpoint**: US2 functional; imports classify with stored explainability

---

## Phase 5: User Story 3 - Manual Review & Overrides (Priority: P1)

**Goal**: Review queue for unclassified, audited overrides, rule-from-decision.

**Independent Test**: Review marks classified, creates audit record, updates aggregates.

### Tests for User Story 3

- [x] T034 [P] [US3] Contract tests for /transactions/unclassified and /transactions/{id}/override at backend/ingestion/test/review.contract.spec.ts

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
