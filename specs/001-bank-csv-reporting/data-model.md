# Data Model: Bank CSV Reporting

## Entities

### Account
- id (UUID)
- name (string)
- bank_name (string, optional)
- created_at (timestamp)

### ImportBatch
- id (UUID)
- account_id (FK → Account.id)
- uploaded_by (FK → User.id or subject string)
- uploaded_at (timestamp)
- file_checksum (string, unique with account_id + month)
- period_month (int 1-12)
- period_year (int YYYY)
- encoding (enum: UTF8, LATIN1)
- row_count (int)

### Transaction
- id (UUID)
- account_id (FK → Account.id)
- batch_id (FK → ImportBatch.id)
- date (date)
- documento (string)
- amount (numeric(14,2)) // signed; parentheses→negative normalization
- currency (string, default BRL)
- category_id (FK → Category.id, nullable until classified)
- tipo (enum: RECEITA, DESPESA, nullable until classified)
- classification_source (enum: RULE, OVERRIDE, NONE)
- rule_id (FK → Rule.id, nullable)
- rule_version (int, nullable)
- rationale (string, nullable)
- created_at (timestamp)

### Rule
- id (UUID)
- version (int)
- matcher_type (enum: CONTAINS, REGEX)
- pattern (string) // case-insensitive, accent-folded when applicable
- category_id (FK → Category.id)
- tipo (enum: RECEITA, DESPESA)
- created_by (string)
- created_at (timestamp)
- active (boolean)

### Category
- id (UUID)
- name (string)
- tipo (enum: RECEITA, DESPESA)

### ClassificationOverride
- id (UUID)
- transaction_id (FK → Transaction.id)
- previous_category_id (FK → Category.id, nullable)
- previous_tipo (enum, nullable)
- new_category_id (FK → Category.id)
- new_tipo (enum)
- actor (string)
- reason (string)
- created_at (timestamp)

## Relationships
- Account 1—N ImportBatch
- Account 1—N Transaction
- ImportBatch 1—N Transaction
- Category 1—N Transaction
- Rule N—N Transaction (applied per transaction via rule_id reference)

## Constraints & Validation
- Unique: (account_id, file_checksum, period_month, period_year) on ImportBatch
- Unique (optional): Transaction natural key e.g., (account_id, date, documento, amount, batch_id)
- amount MUST be signed decimal with normalization rules applied
- date parsed as DD/MM/AAAA (pt-BR) at ingestion
- documento stored canonicalized for matching (lowercase, accent-folded shadow column)

## Materialized Views (Reporting)
- mv_category_totals(month, year, account_id?, category_id, tipo, total_amount, row_count)
- Refresh policies on ingestion completion and overrides
