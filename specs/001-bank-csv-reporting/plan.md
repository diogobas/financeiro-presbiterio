# Implementation Plan: Bank CSV Reporting

**Branch**: `001-bank-csv-reporting` | **Date**: 2025-12-10 | **Spec**: ../spec.md
**Input**: Feature specification from `/specs/001-bank-csv-reporting/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Build a financial reporting application ingesting monthly bank CSVs into a PostgreSQL-backed dataset of classified transactions. Ingestion/classification runs in a Node.js/TypeScript service; high-performance reporting runs in a Java/Spring Boot service with GraphQL. Frontend is React + TypeScript using a shared component library and React Query. All services are containerized and deployed on Kubernetes with CI/CD via GitHub Actions. OAuth2/JWT enforces RBAC (Admin, Viewer, Auditor).

## Technical Context

**Language/Version**: Node.js 20 (TS 5.x) for Ingestion/Classification; Java 21 + Spring Boot 3.x for Reporting  
**Primary Dependencies**: 
- Ingestion: TypeScript, Fastify/Express, csv-parse, zod/class-validator
- Reporting: Spring Boot WebFlux, spring-graphql, JOOQ/JPA, Micrometer
- Frontend: React 18, TypeScript, TanStack React Query, component library (e.g., MUI or shadcn)
**Storage**: PostgreSQL 16 (native indexes, partial indexes, materialized views)  
**Testing**: Jest/Vitest (Node), JUnit + Testcontainers (Java), Playwright/RTL (Frontend)  
**Target Platform**: Kubernetes (Docker images)  
**Project Type**: web  
**Performance Goals**: p95 < 500ms, p99 < 1s for primary reports (SC-002)  
**Constraints**: pt-BR locale parsing; parentheses→negative; UTF-8 primary (graceful Latin-1); idempotent imports; audit trail  
**Scale/Scope**: Monthly datasets typical for the organization; optimized for interactive reporting

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- Data Accuracy: 
  - Input validation (schema + domain), DB constraints, idempotent imports (content hash + bank ref) → COVERED
- Automated Tests for Business Logic: 
  - Unit/contract tests for classification rules, import idempotency, parentheses normalization → COVERED
- Optimized Report Query Performance: 
  - SLOs defined; indexing, materialized views; EXPLAIN plans in CI for key queries → COVERED
- Classification Transparency: 
  - Persist rule/version, human-readable rationale; overrides with actor/timestamp/reason; what-if preview → COVERED
- Consistent Component‑Based UX: 
  - Shared component library, strict TS types, accessibility, loading/error skeletons, Storybook → COVERED

## Project Structure

### Documentation (this feature)

```text
specs/001-bank-csv-reporting/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   ├── ingestion-openapi.yaml
│   └── reporting-graphql.graphql
└── checklists/
    └── requirements.md
```

### Source Code (repository root)

```text
backend/
├── ingestion/           # Node.js/TypeScript service
│   ├── src/
│   ├── test/
│   └── Dockerfile
├── reporting/           # Java/Spring Boot service
│   ├── src/
│   ├── test/
│   └── Dockerfile

frontend/
├── src/
├── tests/
└── Dockerfile

infra/
├── kubernetes/
└── github-actions/
```

**Structure Decision**: Web application with separate backend services (ingestion, reporting) and a frontend app. Kubernetes deployment.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| - | - | - |
