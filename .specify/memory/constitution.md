<!--
Sync Impact Report
Version change: n/a → 1.0.0
Modified principles: [new]
Added sections: Performance & Reporting Standards; Development Workflow & Quality Gates
Removed sections: none
Templates requiring updates:
✅ .specify/templates/plan-template.md (aligns via Constitution Check gates; no changes required)
✅ .specify/templates/spec-template.md (no changes required)
✅ .specify/templates/tasks-template.md (no changes required)
✅ .specify/templates/agent-file-template.md (no changes required)
✅ .specify/templates/commands/ (none present)
Follow-up TODOs:
- TODO(RATIFICATION_DATE): original adoption date unknown; set with first formal approval
-->

# Financeiro Presbitério Constitution

## Core Principles

### I. Data Accuracy Is Non‑Negotiable
The system MUST ensure correctness of financial and classification data at creation, update,
aggregation, and reporting time.

- MUST implement validation at input boundaries (schema + domain rules) with precise error messages.
- MUST use idempotent operations for imports/ingestions to prevent duplication or drift.
- MUST maintain source-of-truth invariants with database constraints (FKs, uniques, checks) and
  programmatic guards.
- MUST reconcile derived values with raw data via periodic checksums and configurable tolerance (default 0).
- MUST track provenance (who/when/how) for every financial mutation.
- SHOULD provide corrective workflows with full audit trails.

Rationale: Financial decisions rely on trustworthy numbers; correctness precedes convenience.

### II. Automated Tests For Business Logic
Business rules MUST be encoded in automated tests covering unit, contract, and critical integrations.

- MUST write tests before or alongside implementation for any business rule affecting money,
  classification, posting, or reporting.
- MUST encode fixtures that reflect canonical scenarios and edge cases (rounding, timezone, partial periods).
- MUST treat failing tests as release blockers; green builds required for merge.
- SHOULD prioritize contract tests for public APIs and report queries to lock observable behavior.
- SHOULD measure coverage for business modules and prevent regressions on critical paths.

Rationale: Tests are the only scalable, repeatable way to protect domain correctness.

### III. Optimized Report Query Performance
Reports MUST be fast and predictable at project scale.

- MUST define SLOs: p95 < 500ms for primary reports under expected data volume; p99 < 1s.
- MUST use appropriate indexing, partitioning, and pre-aggregation/materialization where justified by usage.
- MUST design queries to be sargable and avoid N+1 patterns (verified with explain plans in CI for key reports).
- SHOULD cache stable report results with explicit invalidation on relevant mutations.
- SHOULD include performance regression checks for critical reports in CI.

Rationale: Decision-making is interactive; slow reports reduce trust and adoption.

### IV. Classification Transparency
The system MUST make category/classification logic explainable to end users and auditors.

- MUST store the rule/version that produced each classification and expose an explanation path.
- MUST provide human-readable rationales for automated decisions (rule matched, priority order, thresholds).
- MUST record overrides with actor, timestamp, previous value, and reason.
- SHOULD provide what-if tools to preview how rules apply before committing.

Rationale: Transparent rules reduce disputes and accelerate reconciliation.

### V. Consistent Component‑Based UX (React + TypeScript)
Frontend work MUST use a shared, accessible component system with predictable behavior.

- MUST implement and reuse a design‑system library (React + TS) for forms, tables, filters, and charts.
- MUST type all props and state strictly; no `any` in shared components.
- MUST ensure accessibility basics (labels, roles, focus, keyboard navigation, color contrast).
- SHOULD deliver responsive layouts and loading/error skeletons consistently.
- SHOULD enforce visual and interaction consistency via Storybook/visual tests.

Rationale: Consistency improves speed, quality, and user trust.

## Performance & Reporting Standards

- Primary reports: p95 < 500ms, p99 < 1s measured with realistic datasets.
- Background aggregations MUST not block user interactions; schedule and backoff policies documented.
- Explain plans MUST be captured for critical queries and tracked for regressions.
- Materializations/caches MUST define invalidation triggers and freshness SLAs.

## Development Workflow & Quality Gates

- Constitution Check gates in plans MUST verify:
  - Data validations and constraints defined.
  - Tests for business logic specified (unit/contract/integration as applicable).
  - Report SLOs and measurement approach stated.
  - UX components planned from the shared library with accessibility acceptance criteria.
- CI MUST run lint/typecheck/tests and key report performance checks.
- Any violation requires a documented Complexity Tracking entry in plan.md.

## Governance
The Constitution supersedes other conventions. Amendments require documentation, approval, and a
migration plan when behavior changes.

- Compliance: PRs MUST include evidence (tests, plans, explain plans, Storybook links) for affected areas.
- Reviews: Approvers verify gates; breaking changes require explicit versioning/notes.
- Versioning: Semantic versioning for the Constitution (MAJOR incompatible principle change; MINOR new
  principle/section; PATCH clarifications).
- Reviews cadence: Quarterly compliance sampling for critical features and reports.

**Version**: 1.0.0 | **Ratified**: TODO(RATIFICATION_DATE) | **Last Amended**: 2025-12-10
