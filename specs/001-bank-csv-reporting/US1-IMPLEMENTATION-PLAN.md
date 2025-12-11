# US1 Implementation Plan: Upload Monthly CSV & Map Accounts

## Overview

**Goal**: Enable users to upload CSV files, map to accounts, preview normalized data, and import with deduplication.

**MVP Success Criteria**:
- ✅ Parse pt-BR CSV (Data, Documento, Valor)
- ✅ Normalize parentheses → negative values
- ✅ Idempotent imports (checksum-based dedup)
- ✅ Show preview before confirming
- ✅ API endpoints ready for classification (T019-T022)

**Branch**: `feature/US1-csv-upload`

---

## Implementation Sequence

### Phase A: Backend Infrastructure (T016-T023)

**Order**: Tests first (TDD), then implementation

#### 1. CSV Schema & Validation (T016)
- **File**: `backend/ingestion/src/ingest/csvSchema.ts`
- **Purpose**: Validate required headers (Data, Documento, Valor)
- **Input**: CSV file
- **Output**: Validation result with precise errors
- **Tests**: Unit tests for validation function

#### 2. Parser Unit Tests (T017) ⭐ Write First
- **File**: `backend/ingestion/test/ingest/parser.spec.ts`
- **Tests**:
  - Date parsing: `03/01/2025` → Date(2025, 01, 03)
  - Number parsing: `R$ 2.000,00` → 2000.00
  - Parentheses: `(1.000,00)` → -1000.00
  - Trimming: `" value "` → `value`
  - Mixed case in Documento
  - Encoding edge cases

#### 3. CSV Parser Implementation (T019)
- **File**: `backend/ingestion/src/ingest/csvParser.ts`
- **Purpose**: Parse CSV lines into TransactionRow objects
- **Features**:
  - pt-BR date format (DD/MM/YYYY)
  - pt-BR number format (comma decimal, thousand separator)
  - Parentheses → negatives for Despesas
  - Space trimming
  - Column mapping (ignore extra columns)
  - Encoding handling (UTF-8 primary, graceful Latin-1 fallback)

#### 4. Idempotent Import Integration Test (T018) ⭐ Write First
- **File**: `backend/ingestion/test/ingest/import-idempotency.it.spec.ts`
- **Setup**: Testcontainers PostgreSQL
- **Tests**:
  - Import CSV → count = N
  - Re-import same CSV → count = N (no new rows)
  - Re-import with one new row → count = N+1
  - Verify checksum-based dedup

#### 5. Import Service (T020)
- **File**: `backend/ingestion/src/ingest/importService.ts`
- **Purpose**: Orchestrate import workflow
- **Features**:
  - Calculate file checksum (SHA-256)
  - Parse CSV → TransactionRow[]
  - Deduplicate by checksum + row hash
  - Store ImportBatch + Transactions
  - Audit trail
- **Exports**:
  ```typescript
  async createImport(file: Buffer, accountId: string, period: { month: number, year: number }): Promise<ImportBatch>
  async getImportStatus(batchId: string): Promise<ImportBatchWithRows>
  ```

#### 6. DB Migrations (T023)
- **Files**:
  - `backend/ingestion/src/db/migrations/0005-create-import-batch-table.sql`
  - `backend/ingestion/src/db/migrations/0006-create-transaction-table.sql`
- **Tables**:
  ```sql
  TABLE import_batch (
    id UUID PRIMARY KEY,
    account_id UUID NOT NULL,
    uploaded_at TIMESTAMP,
    file_checksum VARCHAR(64) UNIQUE,
    period_year INTEGER,
    period_month INTEGER,
    row_count INTEGER,
    status VARCHAR(20),
    created_by UUID,
    created_at TIMESTAMP DEFAULT NOW()
  )

  TABLE transaction (
    id UUID PRIMARY KEY,
    batch_id UUID REFERENCES import_batch,
    account_id UUID NOT NULL,
    date DATE,
    documento VARCHAR(255),
    amount DECIMAL(15, 2),
    currency VARCHAR(3),
    row_hash VARCHAR(64),  -- for dedup
    category_id UUID,
    tipo VARCHAR(20),
    classification_source VARCHAR(20),  -- RULE, OVERRIDE, NONE
    rule_id UUID,
    rule_version INTEGER,
    rationale TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )
  ```
- **Indexes**:
  - `import_batch(file_checksum)` - for dedup
  - `transaction(batch_id, account_id)`
  - `transaction(category_id, tipo)` - for reporting

#### 7. POST /imports Endpoint (T021)
- **File**: `backend/ingestion/src/http/importsRoute.ts`
- **Route**: `POST /imports` (multipart/form-data)
- **Body**:
  ```typescript
  {
    file: File,
    accountId: string,
    periodMonth: number,
    periodYear: number
  }
  ```
- **Response** (202 Accepted):
  ```typescript
  {
    id: string,
    accountId: string,
    uploadedAt: string,
    fileChecksum: string,
    rowCount: number,
    status: "PENDING",
  }
  ```
- **Validation**: RBAC (Admin only), file size < 10MB

#### 8. GET /imports/{id} Endpoint (T022)
- **File**: `backend/ingestion/src/http/importStatusRoute.ts`
- **Route**: `GET /imports/{id}`
- **Response**:
  ```typescript
  {
    id: string,
    accountId: string,
    uploadedAt: string,
    fileChecksum: string,
    periodMonth: number,
    periodYear: number,
    rowCount: number,
    status: "COMPLETED" | "PROCESSING" | "FAILED",
    rows: [  // Preview
      {
        date: string,
        documento: string,
        amount: number,
        normalized: boolean
      }
    ]
  }
  ```

---

### Phase B: Frontend (T024-T025)

#### 9. Upload Page (T024)
- **File**: `frontend/src/pages/UploadPage.tsx`
- **Features**:
  - File picker (CSV only)
  - Account selector (dropdown + "Create new")
  - Month/Year selectors
  - Drag-and-drop upload
  - Upload status spinner
  - Preview on success

#### 10. Import Preview Component (T025)
- **File**: `frontend/src/components/import/ImportPreview.tsx`
- **Features**:
  - Table of parsed rows (date, documento, amount)
  - Highlight normalized values (green for parentheses → negative)
  - Dedup summary ("X rows ignored as duplicates")
  - Cancel / Confirm Import buttons
  - Links to review if reupload of known CSV

---

## Task Dependencies & Parallelization

```
T016 (schema) → standalone
T017 (parser tests) → ⭐ Start here (TDD)
T019 (parser impl) → after T017 passes
T018 (idempotent test) → ⭐ Start after T019
T020 (import service) → after T018 passes
T023 (migrations) → parallel with T020
T021, T022 (endpoints) → after T020
T024, T025 (frontend) → parallel after T021-T022 done
```

**Critical Path**: T017 → T019 → T018 → T020 → T023 → (T021, T022, T024, T025)

---

## Files to Create/Modify

### Backend (Node.js / TypeScript)

#### New Files:
```
backend/ingestion/src/ingest/csvSchema.ts
backend/ingestion/src/ingest/csvParser.ts
backend/ingestion/src/ingest/importService.ts
backend/ingestion/src/http/importsRoute.ts
backend/ingestion/src/http/importStatusRoute.ts
backend/ingestion/src/db/migrations/0005-create-import-batch-table.sql
backend/ingestion/src/db/migrations/0006-create-transaction-table.sql
backend/ingestion/test/ingest/parser.spec.ts
backend/ingestion/test/ingest/import-idempotency.it.spec.ts
```

#### Modified Files:
```
backend/ingestion/src/index.ts (register routes)
backend/ingestion/package.json (add dependencies if needed: csv-parser, etc.)
```

### Frontend (React / TypeScript)

#### New Files:
```
frontend/src/pages/UploadPage.tsx
frontend/src/components/import/ImportPreview.tsx
frontend/src/api/imports.ts (API client)
frontend/src/hooks/useImport.ts (state management)
```

#### Modified Files:
```
frontend/src/App.tsx (add route)
```

### Shared
```
specs/001-bank-csv-reporting/contracts/ingestion-openapi.yaml (already defined)
```

---

## Testing Strategy

### Unit Tests (T017)
```typescript
describe('CSVParser', () => {
  it('parses pt-BR dates DD/MM/YYYY', () => {})
  it('parses pt-BR numbers with comma decimal', () => {})
  it('converts parentheses to negative', () => {})
  it('trims spaces', () => {})
})
```

### Integration Tests (T018)
```typescript
describe('Import Idempotency', () => {
  it('first import creates N rows', async () => {})
  it('re-import of same CSV creates no new rows', async () => {})
  it('re-import with one new row creates 1 new row', async () => {})
  it('dedup works on checksum + row hash', async () => {})
})
```

### API Contract Tests (Future US2)
```typescript
POST /imports → 202 with ImportBatch
GET /imports/{id} → 200 with status + preview rows
```

---

## Success Criteria (Definition of Done)

- ✅ CSV parsing handles all pt-BR formats (dates, numbers, parentheses)
- ✅ All unit tests pass (parser)
- ✅ All integration tests pass (idempotency)
- ✅ POST /imports endpoint accepts multipart form, returns 202
- ✅ GET /imports/{id} returns import status + preview
- ✅ Database tables created and migrations run
- ✅ Frontend upload page accepts CSV and displays preview
- ✅ Re-importing same CSV shows dedup summary (no new rows)
- ✅ All builds pass (TypeScript, ESLint)
- ✅ All tests pass (Jest)

---

## Notes

### Design Decisions

1. **Checksum-based Dedup**: File SHA-256 + row content hash prevents re-imports
2. **Async Processing**: POST returns 202 (Accepted), client polls GET /imports/{id}
3. **No Immediate Classification**: T019-T020 focus on ingestion; classification is US2
4. **pt-BR Locale**: All dates, numbers, and messages in pt-BR (pt_BR locale in code)
5. **Preview Before Confirm**: User reviews normalized data before final import

### Potential Challenges

- **CSV Encoding**: Handle Latin-1/ISO-8859-1 gracefully (detect + warn)
- **Performance**: Large files (>100K rows) → streaming parser or background job
- **Concurrent Uploads**: Same account, same period → block or merge?
- **Network**: Upload interruption → store partial + resume

### Future Enhancements (Not MVP)

- Streaming upload for large files (chunked)
- Background processing (job queue)
- Rule preview before committing
- What-if classification simulation

---

## Next Steps

1. **Start with T017** (parser unit tests) - write failing tests
2. **Then T019** (parser implementation) - make tests pass
3. **Then T018** (idempotent integration test)
4. **Then T020** (import service)
5. **Then T023** (migrations)
6. **Then T021-T022** (endpoints)
7. **Then T024-T025** (frontend)
