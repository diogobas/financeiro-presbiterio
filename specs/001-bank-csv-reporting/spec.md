# Feature Specification: Bank CSV Reporting

**Feature Branch**: `001-bank-csv-reporting`  
**Created**: 2025-12-10  
**Status**: Draft  
**Input**: User description: "Build a financial reporting application that processes monthly CSV bank extracts (requiring manual account mapping on upload) into a database of classified transactions. Classification MUST be driven by configurable rules matching the CSV's \"Documento\" column, with mandatory manual review for unclassified items (Classification Transparency). The system MUST prevent data duplication (Data Accuracy) and normalize parentheses into negative values (Despesas). The UI MUST provide high-performance aggregated reports (p95 < 500ms) showing total Receitas and Despesas by Category, for any selected Month and Year, with drill-down capability to view the underlying individual transactions (UX Consistent)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Upload Monthly CSV & Map Accounts (Priority: P1)

As a Finance Admin, I upload a monthly bank CSV extract and map it to a known account (or create one), preview normalized rows, and confirm import without duplicates.

**Why this priority**: Foundation of the workflow; all reporting depends on reliable ingestion.

**Independent Test**: Import a CSV twice and verify no duplicates. Validate parentheses normalization for Despesas.

**Acceptance Scenarios**:

1. Given a valid CSV containing required columns Data, Documento, Valor (pt-BR formats), When the user uploads and selects/creates an Account, Then the system shows a preview that trims extra spaces, ignores irrelevant columns (e.g., Descrição, Saldo), correctly infers negatives from parentheses, and displays a deduplication summary.
2. Given the user confirms the import, When the same CSV (or same import batch content) is uploaded again, Then the system skips duplicates and reports zero new rows.

---

### User Story 2 - Rule-based Classification (Priority: P1)

As a Finance Admin, I manage classification rules matching on Documento to auto-classify transactions into Categories (Receitas/Despesas), with explanations and versioning.

**Why this priority**: Enables automation and consistency; required for accurate reporting.

**Independent Test**: Given rules R1..Rn, importing a sample file produces classified rows with recorded rule IDs and rationales.

**Acceptance Scenarios**:

1. Given an existing rule (contains "PADARIA" → Categoria: Alimentação, Tipo: Despesa), When a transaction with Documento "PAGAMENTO PADARIA CENTRAL" is imported, Then it is auto-classified accordingly and stores rule/version.
2. Given no rule matches a transaction, When import completes, Then the row is marked Unclassified requiring manual review and appears in the Review queue with explanation "no rule matched".

---

### User Story 3 - Manual Review & Overrides (Priority: P1)

As a Finance Admin, I review unclassified transactions, assign Category and Tipo (Receita/Despesa), and optionally create a new rule; all actions are audited.

**Why this priority**: Ensures completeness and transparency for audits.

**Independent Test**: Reviewing an item marks it classified, records actor/timestamp/reason, and updates aggregates immediately.

**Acceptance Scenarios**:

1. Given an unclassified item, When the admin assigns Category and saves, Then the transaction becomes classified and an audit record is created.
2. Given a repeated pattern, When the admin chooses "Create rule from this decision", Then a new rule is created and linked; future imports auto-classify accordingly.

---

### User Story 4 - Aggregated Reports with Drill-down (Priority: P1)

As a Finance Viewer, I select Month and Year to see totals of Receitas and Despesas by Category and drill down to the underlying transactions.

**Why this priority**: Delivers primary reporting value; must be performant.

**Independent Test**: With a dataset of N transactions, report loads with p95 < 500ms, and drill-down shows the exact rows contributing to a category total.

**Acceptance Scenarios**:

1. Given selected Month=MM, Year=YYYY, When the user opens the summary, Then the UI shows totals by Category for Receitas and Despesas and overall net.
2. Given the user clicks a category, When drill-down opens, Then the list shows the contributing transactions with pagination/filters and consistent component styling.

---

### Edge Cases

- CSV contains repeated lines: deduplication prevents re-insert.
- Documento contains mixed case/accents: matching is case-insensitive and accent-folded.
- Amounts with parentheses and thousand separators/spaces: normalized to signed decimals per pt-BR, trimming extra spaces.
- Dates in DD/MM/AAAA: parsed in pt-BR locale; month boundaries handled in local timezone.
- Encoding deviations (Latin-1/ISO-8859-1): handled gracefully with UTF-8 as primary.
- Example row parsable: `03/01/2025,TRANSF ENTRE CONTAS 239...,DIST PSGA,"R$2.000,00 ", "R$2.002,00 ",...` (irrelevant columns ignored).

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow upload of monthly CSV extracts and map to an Account or create a new Account.
- **FR-002**: System MUST prevent duplicate transactions across repeated imports (idempotent ingestion using content hashes + bank reference).
- **FR-003**: System MUST normalize parentheses in values to negatives for Despesas and parse localized number formats.
- **FR-004**: System MUST classify transactions via configurable rules matching the Documento column; matching is case-insensitive and accent-folded.
- **FR-005**: System MUST mark unmatched transactions as Unclassified and require manual review before reports treat them as finalized.
- **FR-006**: System MUST store rule/version used for each auto-classified transaction and provide a human-readable rationale.
- **FR-007**: System MUST support manual overrides with actor, timestamp, previous value, reason, and optional "create rule from decision".
- **FR-008**: System MUST provide aggregated reports for selected Month/Year: totals of Receitas and Despesas by Category with net total.
- **FR-009**: System MUST provide drill-down to the contributing transactions for any category aggregate.
- **FR-010**: System MUST meet report SLOs: p95 < 500ms for primary reports; p99 < 1s.
- **FR-011**: System MUST expose explanations for classifications and overrides (Classification Transparency principle).
- **FR-012**: System MUST validate incoming CSV schema at upload and report precise errors; required columns are `Data`, `Documento`, `Valor`. Irrelevant columns (e.g., `Descrição`, `Saldo`) MUST be ignored. Parser MUST tolerate extra spaces around values.
- **FR-013**: System SHOULD cache stable report results with explicit invalidation on relevant mutations.
- **FR-014**: System SHOULD provide what-if classification preview before saving a new rule.
- **FR-015**: System MUST process pt-BR locale formats: numbers use comma as decimal separator and `()` indicate negative values; dates are `DD/MM/AAAA`.
- **FR-016**: System MUST accept UTF-8 encoded CSVs; MUST gracefully handle common deviations (Latin-1/ISO-8859-1) with clear warnings without corrupting data.
- **FR-017**: System MUST be bank-agnostic; users MUST manually map the source bank account during upload regardless of originating bank.
- **FR-018**: System MUST enforce RBAC with three roles:
  - Finance Admin: Full CRUD; can import CSVs, manage Accounts, Rules, and perform manual reclassifications (all audited).
  - Finance Viewer: Read-only access to aggregated reports and drill-down details.
  - Finance Auditor: Read-only extended access, including full audit trail and provenance (rules applied, overrides, actor/timestamps).

### Key Entities *(include if feature involves data)*

- **Account**: Bank account identity mapped by the user on upload.
- **ImportBatch**: Single CSV upload with metadata, checksum, and account mapping.
- **Transaction**: Parsed row with date, documento, amount (signed), account, batch, classification info.
- **Rule**: Configurable matcher (contains/regex) over Documento with target Category and Tipo, versioned.
- **Category**: Domain category label; includes Tipo: Receita or Despesa.
- **ClassificationOverride**: Manual decision with actor, timestamp, previous value, reason, optional rule creation link.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Duplicate upload of the same CSV results in 0 new transactions; report indicates deduplication.
- **SC-002**: 95% of primary report requests complete in < 500ms; 99% in < 1s on target dataset.
- **SC-003**: 100% of classified transactions store rule/version or override record with human-readable rationale.
- **SC-004**: 100% of parentheses-based negative values in Despesas are normalized correctly.
- **SC-005**: Drill-down results exactly equal the set of transactions contributing to the selected aggregate.

## Assumptions

- Matching strategy uses case-insensitive and accent-folded substring search by default.
- Target dataset is typical monthly volume for the organization; performance tuning uses realistic samples.
- Roles: Finance Admin (manage imports, rules, reviews), Finance Viewer (view reports), Finance Auditor (view reports, transactions, and complete audit trail).

## Open Questions

None.
