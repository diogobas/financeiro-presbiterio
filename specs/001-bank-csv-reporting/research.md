# Research: Bank CSV Reporting

## Decisions

- **Architecture**: Microservices: Ingestion/Classification (Node.js/TypeScript) and Reporting (Java/Spring Boot + GraphQL). Rationale: isolates IO-heavy parsing from compute/reporting, enables language strengths and scaling per workload.
- **Database**: PostgreSQL 16 with native indexing (btree/GIN), partial indexes, materialized views for reporting SLOs.
- **CSV Parsing**: UTF-8 primary, graceful Latin-1 fallback; pt-BR locale (DD/MM/AAAA; comma decimal; parentheses→negative); ignore irrelevant columns; trim spaces.
- **Deduplication**: Idempotent imports via content hash + (account_id, date range) with unique constraints at DB level.
- **Classification**: Rule engine matching `Documento` (case-insensitive, accent-folded). Persist rule id/version and human-readable rationale.
- **Manual Review**: Queue for unclassified; override audit trail (actor, timestamp, previous, reason), optional rule-from-decision.
- **Reporting**: GraphQL API delivering category totals and drill-down; pre-aggregation via materialized views; caching with explicit invalidation on mutations.
- **Security**: OAuth2/JWT with RBAC roles: Admin, Viewer, Auditor.
- **Frontend**: React + TypeScript, shared component library, React Query; accessibility and UX consistency per Constitution.
- **CI/CD & Ops**: GitHub Actions, Docker images, K8s manifests; performance checks (EXPLAIN plans) in CI for critical queries.

## Alternatives Considered

- Single service (Node or Java): simpler, but mixes concerns and complicates scaling; rejected for clarity/performance isolation.
- REST for reporting: acceptable, but GraphQL fits variable aggregation/drill-down without overfetching.
- OLAP warehouse: overkill for current scope/volume; PostgreSQL with matviews sufficient.

## Open Items Resolved

- Locale, encoding, RBAC clarified; no outstanding NEEDS CLARIFICATION.
