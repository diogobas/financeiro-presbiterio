# End-to-End Manual Testing Guide

## System Overview

This guide walks you through running and testing the complete Bank CSV Reporting system:

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React)                        │
│                      Port: 5173 (dev) / 80 (prod)              │
│    - Upload CSV Screen (UploadPage.tsx)                        │
│    - Import Preview Component (ImportPreview.tsx)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
    ┌──────────────────────┴──────────────────────┐
    │                                             │
    ▼                                             ▼
┌──────────────────────────────────┐  ┌──────────────────────────────────┐
│   INGESTION SERVICE (Node)        │  │  REPORTING SERVICE (Java)        │
│   Port: 3000 (dev) / 8080 (prod) │  │  Port: 8081 (prod)              │
├──────────────────────────────────┤  ├──────────────────────────────────┤
│ - POST /imports                  │  │ - GraphQL queries (future)       │
│ - GET /imports/{id}              │  │ - REST endpoints (future)        │
│ - CSV parsing & validation       │  │ - Report generation              │
│ - Duplicate detection            │  │ - Aggregation & drill-down       │
│ - Database write operations      │  │ - Database read operations       │
└──────────────────────┬────────────┘  └────────────────┬────────────────┘
                       │                                │
                       └────────────────┬───────────────┘
                                        │
                                        ▼
                              ┌──────────────────────┐
                              │  PostgreSQL (Docker) │
                              │   Port: 5432         │
                              │                      │
                              │ - account            │
                              │ - import_batch       │
                              │ - transaction        │
                              │ - category           │
                              │ - rule (future)      │
                              └──────────────────────┘
```

---

## Prerequisites

- Docker & Docker Compose installed
- Node.js 18+ (for frontend/ingestion)
- Java 17+ & Maven (for reporting)
- 4+ CPU cores / 4GB RAM available

---

## Part 1: Start Infrastructure

### Option A: Automated Setup (Recommended)

```bash
cd /Users/diogobastos/workspace/personal/financeiro-presbiterio
chmod +x scripts/e2e-test-guide.sh
./scripts/e2e-test-guide.sh
```

This will:
1. Clean up existing containers
2. Start PostgreSQL
3. Run database migrations
4. Display next steps

### Option B: Manual Setup

#### Step 1: Start PostgreSQL

```bash
cd /Users/diogobastos/workspace/personal/financeiro-presbiterio
docker-compose up -d postgres

# Wait for it to be healthy
sleep 10

# Verify it's running
docker-compose ps
```

#### Step 2: Run Database Migrations

```bash
cd backend/ingestion
npm run migrate
```

If this fails, you can also run migrations manually through the app on startup (automatic).

---

## Part 2: Start Backend Services

### Terminal 1: Ingestion Service (Node)

```bash
cd /Users/diogobastos/workspace/personal/financeiro-presbiterio/backend/ingestion

# Install dependencies (if not already done)
npm install

# Run in development mode
npm run dev
```

Expected output:
```
Server listening on port 3000
✓ Database connection established
✓ Migrations complete
```

Health check: `curl http://localhost:3000/health`

### Terminal 2: Reporting Service (Java)

```bash
cd /Users/diogobastos/workspace/personal/financeiro-presbiterio/backend/reporting

# Run with Maven
mvn spring-boot:run
```

Expected output:
```
Started ReportingApplication in X seconds
Tomcat started on port(s): 8081
```

Health check: `curl http://localhost:8081/actuator/health`

---

## Part 3: Start Frontend

### Terminal 3: Frontend (React/Vite)

```bash
cd /Users/diogobastos/workspace/personal/financeiro-presbiterio/frontend

# Install dependencies (if not already done)
npm install

# Run in development mode
npm run dev
```

Expected output:
```
  VITE v5.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  press h + enter to show help
```

---

## Part 4: Manual Test Walkthrough

### Step 1: Verify All Services Are Running

Open a new terminal and check health endpoints:

```bash
# Check all services
echo "=== Ingestion Service ===" && curl http://localhost:3000/health
echo -e "\n=== Reporting Service ===" && curl http://localhost:8081/actuator/health
echo -e "\n=== Database ===" && curl http://localhost:3000/health/db
```

All should return `200 OK` with status info.

### Step 2: Access Frontend

Open browser:
```
http://localhost:5173
```

You should see:
- Upload page with account selector
- Month/Year selectors
- File upload input

### Step 3: Create Test CSV File

Create a file `test-import.csv`:

```csv
Data,Documento,Valor
01/12/2025,000001,1.234,56
02/12/2025,000002,(500,00)
03/12/2025,000003,2.000,00
04/12/2025,000004,15.000,75
05/12/2025,000005,(1.200,00)
```

Key features being tested:
- **Date parsing**: DD/MM/YYYY format
- **Amount parsing**: 
  - Decimal: `1.234,56` → 1234.56
  - Negative (parentheses): `(500,00)` → -500.00
- **Encoding detection**: Auto-detect UTF-8/LATIN1
- **Idempotency**: Re-upload same file → no duplicates

### Step 4: Upload CSV Through UI

1. **Select Account**:
   - Click account dropdown
   - Select any available account (e.g., "Personal Checking")

2. **Select Period**:
   - Month: 12
   - Year: 2025

3. **Upload File**:
   - Click "Choose file"
   - Select `test-import.csv`
   - Should show file preview (first 6 lines)

4. **Submit**:
   - Click "Upload CSV"
   - Should see loading indicator
   - Should receive success message with:
     - Batch ID
     - Row count (5 transactions)
     - Encoding detected (UTF-8)
     - Upload timestamp

### Step 5: Review Import Results

After successful upload, you'll see the Preview page showing:

**Batch Information:**
- Batch ID (UUID)
- Upload timestamp
- Period: 12/2025
- Encoding detected
- File checksum (SHA256)

**Transaction Summary:**
- Total Transactions: 5

**Classification Status:**
- Classified: 0
- Unclassified: 5
- Progress: 0%
- Status: "Classification not started"

### Step 6: API Testing

Test the backend endpoints directly:

```bash
# Get import batch details
BATCH_ID="<from previous response>"
curl http://localhost:3000/imports/$BATCH_ID | jq .

# Example response:
# {
#   "id": "uuid-here",
#   "accountId": "1",
#   "uploadedBy": "system",
#   "uploadedAt": "2025-12-11T...",
#   "fileChecksum": "sha256hash",
#   "periodMonth": 12,
#   "periodYear": 2025,
#   "encoding": "UTF8",
#   "rowCount": 5,
#   "status": "COMPLETED",
#   "classification": {
#     "classified": 0,
#     "unclassified": 5,
#     "total": 5,
#     "percentClassified": 0
#   }
# }
```

### Step 7: Test Idempotency (Re-import)

1. Go back to upload page
2. Select same account, period, and file
3. Click upload again
4. Should receive **409 Conflict** error
5. Message: "Import already exists for this account/period/file"

This tests the duplicate detection by file checksum.

### Step 8: Test Different Period

1. Upload same CSV file but with different month (e.g., 11/2025)
2. Should succeed (different period)
3. Should create new ImportBatch
4. Both batches appear in database

---

## Troubleshooting

### "Connection refused" errors

**Problem:** Services can't reach each other or database

**Solution:**
```bash
# Check if containers are running
docker-compose ps

# Check docker network
docker network ls
docker network inspect financeiro-presbiterio_default

# Restart everything
docker-compose down
docker-compose up -d postgres
```

### "Port already in use"

**Problem:** Port 5173 (frontend) or 3000 (ingestion) already in use

**Solution:**
```bash
# Find what's using the port
lsof -i :5173
lsof -i :3000

# Kill the process
kill -9 <PID>

# Or change port in vite.config.ts / .env
```

### Database migration failures

**Problem:** Migrations won't run

**Solution:**
```bash
# Check database connection
docker-compose exec postgres psql -U app -d financeiro -c "\dt"

# Manually run migrations
cd backend/ingestion
DATABASE_URL=postgres://app:app@localhost:5432/financeiro npm run migrate

# Check log file
tail -100 backend/ingestion/logs/*.log
```

### "Cannot find module" errors

**Problem:** Dependencies not installed

**Solution:**
```bash
# Reinstall all dependencies
cd backend/ingestion && npm install --force
cd ../../frontend && npm install --force
cd ../reporting && mvn clean install
```

### API call failures

**Problem:** Frontend can't reach backend

**Solution:**
1. Check frontend console (F12) for CORS errors
2. Verify ingestion service is responding:
   ```bash
   curl -v http://localhost:3000/health
   ```
3. Check if API URL is correct in components

---

## Expected Behavior Summary

### Happy Path (Successful Upload)

| Component | Expected Result |
|-----------|-----------------|
| Frontend loads | React app on 5173 ✓ |
| Form validation | All fields required ✓ |
| CSV upload | File preview shows ✓ |
| POST /imports | 202 Accepted ✓ |
| Batch created | UUID in database ✓ |
| Preview shows | Metadata + stats ✓ |
| GET /imports/{id} | Returns complete batch ✓ |

### Idempotency Test

| Step | Expected Result |
|------|-----------------|
| First upload | 202 Accepted ✓ |
| Same file/period | 409 Conflict ✓ |
| Different period | 202 Accepted (new batch) ✓ |

### Performance Expectations

| Operation | Expected Time |
|-----------|----------------|
| PostgreSQL startup | < 10 seconds |
| Ingestion startup | < 5 seconds |
| Reporting startup | < 15 seconds |
| Frontend startup | < 3 seconds |
| CSV upload (5 rows) | < 1 second |
| GET /imports/{id} | < 100ms |

---

## Checking the Database

### Connect to PostgreSQL

```bash
# Using Docker
docker-compose exec postgres psql -U app -d financeiro

# Using local psql (if installed)
psql postgres://app:app@localhost:5432/financeiro
```

### Useful Queries

```sql
-- List all accounts
SELECT * FROM account;

-- List all import batches
SELECT id, account_id, uploaded_at, row_count, status FROM import_batch;

-- List transactions from a batch
SELECT * FROM transaction WHERE batch_id = 'batch-uuid-here';

-- Count by classification status
SELECT 
  classification_source,
  COUNT(*) as count 
FROM transaction 
GROUP BY classification_source;
```

---

## Next Steps After Manual Testing

1. **Verify all flows work end-to-end**
2. **Test error scenarios** (invalid CSV, large files, etc.)
3. **Check browser console** for any JavaScript errors
4. **Monitor logs** in each terminal for warnings/errors
5. **Once satisfied**, you're ready for automated E2E tests

---

## Useful Commands for Testing

```bash
# Watch logs from all services
docker-compose logs -f

# Rebuild containers after code changes
docker-compose up -d --build

# Clean everything and start fresh
docker-compose down -v
docker-compose up -d postgres

# Test database connection
nc -zv localhost 5432

# Test service endpoints
curl -X GET http://localhost:3000/health
curl -X GET http://localhost:8081/actuator/health
curl -X POST http://localhost:3000/imports -F file=@test.csv
```

---

## System Readiness Checklist

Before considering the system "ready for production":

- [ ] PostgreSQL health check passes
- [ ] Ingestion service health check passes
- [ ] Reporting service health check passes
- [ ] Frontend loads without errors
- [ ] Account dropdown populated
- [ ] CSV upload succeeds
- [ ] Import preview shows correct data
- [ ] Batch metadata persists in database
- [ ] Idempotency prevents duplicates
- [ ] Re-uploading different period creates new batch
- [ ] API endpoints respond in < 100ms
- [ ] No console errors in browser
- [ ] No warning logs in backend

---

**Good luck with your manual testing! 🚀**
