# QUICK START: End-to-End Manual Testing

## ⚠️ Prerequisites Check

Before starting, ensure you have:

1. **Docker Desktop running** ✓
   ```bash
   docker ps  # Should work without errors
   ```

2. **Node.js installed** ✓
   ```bash
   node --version  # Should be 18+
   ```

3. **Java & Maven installed** ✓
   ```bash
   java -version   # Should be 17+
   mvn --version  # Should be 3.8+
   ```

---

## 🚀 RECOMMENDED: Quick Start (5 minutes)

### Step 1: Ensure Docker is Running

```bash
# On macOS with Docker Desktop:
# 1. Open Docker Desktop app from Applications
# 2. Wait 30 seconds for it to fully start
# 3. Then run:
docker ps

# If this fails, Docker isn't running yet
```

### Step 2: Start Infrastructure

```bash
cd /Users/diogobastos/workspace/personal/financeiro-presbiterio

# Clean and start PostgreSQL
docker-compose down -v 2>/dev/null || true
docker-compose up -d postgres

# Wait for PostgreSQL to be healthy
sleep 15

# Verify it's ready
docker-compose exec postgres pg_isready -U app
```

Expected output: `accepting connections`

### Step 3: Open 3 Terminal Windows

Copy & paste these commands into 3 separate terminal windows:

#### **Terminal 1: Ingestion Service**
```bash
cd /Users/diogobastos/workspace/personal/financeiro-presbiterio/backend/ingestion
npm run dev
```

Wait for: `Server listening on port 3000`

#### **Terminal 2: Reporting Service**
```bash
cd /Users/diogobastos/workspace/personal/financeiro-presbiterio/backend/reporting
mvn spring-boot:run
```

Wait for: `Tomcat started on port(s): 8081`

#### **Terminal 3: Frontend**
```bash
cd /Users/diogobastos/workspace/personal/financeiro-presbiterio/frontend
npm run dev
```

Wait for: `➜  Local: http://localhost:5173/`

### Step 4: Open Browser

```
http://localhost:5173
```

You should see the Upload page with:
- Account selector dropdown
- Month/Year period inputs
- File upload button

---

## ✅ Verify Everything is Running

Open a **4th terminal window**:

```bash
# Check all services
echo "=== Checking Services ===" && \
echo "Ingestion: $(curl -s http://localhost:3000/health | jq .status)" && \
echo "Reporting: $(curl -s http://localhost:8081/actuator/health | jq .status)" && \
echo "Database: $(curl -s http://localhost:3000/health/db | jq .status)"
```

All should show: `"ok"`

---

## 📝 Test Scenario: Upload & Import CSV

### Create Test CSV

Save this to `/tmp/test-import.csv`:

```csv
Data,Documento,Valor
01/12/2025,000001,1.234,56
02/12/2025,000002,(500,00)
03/12/2025,000003,2.000,00
04/12/2025,000004,15.000,75
05/12/2025,000005,(1.200,00)
```

### Test Through UI

1. Open http://localhost:5173
2. **Account**: Select "Personal Checking" (or any account)
3. **Month**: 12
4. **Year**: 2025
5. **File**: Upload the CSV file
6. **Submit**: Click "Upload CSV"

### Expected Results

✅ **Success Response** (2-3 seconds):
- Green success message
- Batch ID displayed
- Row count: 5
- Encoding detected: UTF8

✅ **Preview Page Shows**:
- Batch metadata (ID, timestamp, period)
- Total Transactions: 5
- Classification Status: 0% (not yet classified)
- Status indicator: "Classification not started"

✅ **Database Check**:
```bash
# In new terminal:
docker-compose exec postgres psql -U app -d financeiro -c \
  "SELECT id, row_count, status FROM import_batch ORDER BY uploaded_at DESC LIMIT 1;"
```

Should show the new batch.

---

## 🔄 Test Idempotency

### Upload Same File Again

1. Go back to upload page
2. Select **same account**, **same period**, **same file**
3. Click "Upload CSV"

### Expected: **409 Conflict Error**

This proves the system prevents duplicate imports!

### Upload Different Period

1. Select **same account**, **different month** (11/2025), **same file**
2. Click "Upload CSV"

### Expected: **202 Accepted**

New batch created because period is different.

---

## 🔍 API Testing

### Get Import Details

```bash
# From the success message, copy the Batch ID, then:
BATCH_ID="<copy-from-ui>"

curl http://localhost:3000/imports/$BATCH_ID | jq .

# Should show complete batch with classification stats:
# {
#   "id": "...",
#   "rowCount": 5,
#   "classification": {
#     "classified": 0,
#     "unclassified": 5,
#     "percentClassified": 0
#   }
# }
```

### Test File Upload Directly

```bash
curl -X POST http://localhost:3000/imports \
  -F "file=@/tmp/test-import.csv" \
  -F "accountId=1" \
  -F "periodMonth=12" \
  -F "periodYear=2025" | jq .

# Should return 202 Accepted or 409 Conflict (if duplicate)
```

---

## 🐛 Troubleshooting

### "Docker daemon not running"

**Solution**: Open Docker Desktop app and wait 30 seconds

### "Port 5173 already in use"

**Solution**: 
```bash
lsof -i :5173
kill -9 <PID>
```

### "Cannot connect to backend from frontend"

**Solution**: 
- Check frontend console (F12 → Console tab)
- Verify ingestion is running: `curl http://localhost:3000/health`
- Check API URL in `/frontend/src/pages/UploadPage.tsx` line 141-142

### "Database connection refused"

**Solution**:
```bash
# Restart PostgreSQL
docker-compose down postgres
docker-compose up -d postgres
sleep 15
docker-compose exec postgres pg_isready -U app
```

### "Migrations didn't run"

**Solution**: They run automatically when ingestion service starts. Check logs:
```bash
# In the ingestion terminal, look for:
# ✓ Database connection established
# ✓ Migrations complete
```

---

## 📊 What to Verify

- [ ] Frontend loads (http://localhost:5173)
- [ ] Account dropdown works
- [ ] Can select month/year
- [ ] Can upload CSV file
- [ ] See file preview
- [ ] Get success response with batch ID
- [ ] Preview page shows import metadata
- [ ] Classification stats show 0%
- [ ] Re-uploading same file returns 409 error
- [ ] Uploading different period creates new batch
- [ ] API endpoint returns batch details
- [ ] Database has the imported transactions

---

## 💡 Useful Commands

```bash
# View database
docker-compose exec postgres psql -U app -d financeiro

# List accounts
SELECT * FROM account;

# List batches
SELECT id, row_count, status, uploaded_at FROM import_batch;

# Check transactions
SELECT * FROM transaction LIMIT 5;

# Clean everything
docker-compose down -v

# View real-time logs
docker-compose logs -f postgres
```

---

## 🎯 Success Criteria

You've successfully completed E2E testing when:

1. ✅ All 3 services start without errors
2. ✅ Frontend loads and displays UI
3. ✅ Can upload CSV file
4. ✅ Get 202 Accepted response
5. ✅ Preview page shows correct data
6. ✅ Batch appears in database
7. ✅ Uploading same file returns 409 error
8. ✅ All services respond to health checks

---

**Time to complete**: ~5-10 minutes (including waiting for services to start)

**Next**: Manual test different CSV formats, error cases, and edge scenarios!
