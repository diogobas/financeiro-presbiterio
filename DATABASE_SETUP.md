# Database Setup Guide

This guide explains how to set up and manage the PostgreSQL database for the Bank CSV Reporting system.

## Prerequisites

- PostgreSQL 12+ installed
- Docker (optional, for containerized setup)
- Node.js 18+ (for ingestion service)
- Java 21 (for reporting service)

## Quick Start with Docker

The easiest way to get started is using Docker Compose:

```bash
cd infra
docker-compose up -d postgres
```

This will:
- Start a PostgreSQL container on port 5432
- Create the `financeiro` database
- Use default credentials (see docker-compose.yml)

## Manual Setup

### 1. Create Database and User

```bash
# Connect to PostgreSQL
psql -U postgres

# Create database
CREATE DATABASE financeiro ENCODING 'UTF8';

# Create application user
CREATE USER financeiro_app WITH PASSWORD 'your-secure-password';

# Grant permissions
GRANT CONNECT ON DATABASE financeiro TO financeiro_app;
GRANT USAGE ON SCHEMA public TO financeiro_app;
GRANT CREATE ON SCHEMA public TO financeiro_app;
```

### 2. Run Migrations

Migrations run automatically on ingestion service startup if `ENABLE_MIGRATIONS_ON_STARTUP=true`:

```bash
cd backend/ingestion
ENABLE_MIGRATIONS_ON_STARTUP=true npm run dev
```

Or manually using psql:

```bash
psql -U postgres financeiro < backend/ingestion/src/db/migrations/001_init_schema.sql
```

## Configuration

### Environment Variables (Node/Ingestion)

Create `.env` file in `backend/ingestion/`:

```bash
cp backend/ingestion/.env.example backend/ingestion/.env
```

Then edit with your database credentials:

```env
DATABASE_HOST=localhost
DATABASE_PORT=5432
DATABASE_NAME=financeiro
DATABASE_USER=financeiro_app
DATABASE_PASSWORD=your-secure-password
DATABASE_SSL=false
```

### Environment Variables (Spring Boot/Reporting)

Set environment variables or use `application-{profile}.yml`:

```bash
export DB_HOST=localhost
export DB_PORT=5432
export DB_NAME=financeiro
export DB_USER=financeiro_app
export DB_PASSWORD=your-secure-password
```

Or in `application.yml`:

```yaml
spring:
  datasource:
    url: jdbc:postgresql://localhost:5432/financeiro
    username: financeiro_app
    password: your-secure-password
```

## Database Schema

### Core Tables

- **account** - Bank accounts being tracked
- **category** - Transaction categories for classification
- **import_batch** - CSV import metadata (deduplication)
- **transaction** - Imported bank transactions
- **rule** - Auto-classification rules
- **classification_override** - Audit trail for manual changes

### Materialized Views

- **mv_category_totals** - Aggregated transaction totals by category/month/account

## Development Tasks

### View Database Schema

```bash
# Connect to database
psql -U financeiro_app financeiro

# List tables
\dt

# Describe a table
\d transaction

# View schema
psql -U postgres financeiro -c "\d transaction"
```

### Insert Test Data

```sql
-- Insert test account
INSERT INTO account (name, bank_name) VALUES ('Test Account', 'Test Bank');

-- Insert test category
INSERT INTO category (name, tipo) VALUES ('Salário', 'RECEITA');
INSERT INTO category (name, tipo) VALUES ('Alimentação', 'DESPESA');

-- View data
SELECT * FROM account;
SELECT * FROM category;
```

### Query Examples

```sql
-- Transactions awaiting classification
SELECT * FROM transaction WHERE category_id IS NULL LIMIT 10;

-- Active classification rules
SELECT * FROM rule WHERE active = true;

-- Aggregated totals
SELECT * FROM mv_category_totals WHERE year = 2025 AND month = 12;

-- Override audit trail
SELECT * FROM classification_override ORDER BY created_at DESC;
```

### Backup & Restore

```bash
# Backup database
pg_dump -U postgres financeiro > backup_financeiro.sql

# Restore from backup
psql -U postgres < backup_financeiro.sql
```

## Monitoring

### Check Connection

```bash
# From Node
npm run dev  # Health check at http://localhost:3000/health/db

# From Spring Boot
curl http://localhost:8080/actuator/health

# From psql
psql -U postgres -c "SELECT version();"
```

### View Database Stats

```sql
-- Table sizes
SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname != 'pg_catalog'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- Index sizes
SELECT schemaname, tablename, indexname, pg_size_pretty(pg_relation_size(indexrelname)) AS size
FROM pg_indexes
WHERE schemaname != 'pg_catalog'
ORDER BY pg_relation_size(indexrelname) DESC;

-- Active connections
SELECT datname, count(*) FROM pg_stat_activity GROUP BY datname;
```

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution**: Check if PostgreSQL is running:

```bash
# macOS
brew services list | grep postgres

# Linux
sudo systemctl status postgresql

# Docker
docker ps | grep postgres
```

### Authentication Failed

```
FATAL: password authentication failed for user "postgres"
```

**Solution**: Check credentials in `.env` or `docker-compose.yml`

### Migration Failed

```
ERROR: relation "account" already exists
```

**Solution**: Schema already migrated. Remove `ENABLE_MIGRATIONS_ON_STARTUP` or check migration status.

### Performance Issues

Run EXPLAIN ANALYZE on slow queries:

```sql
EXPLAIN ANALYZE SELECT * FROM transaction WHERE category_id IS NULL;
```

Then check `infra/github-actions/report-perf.yml` for automated performance monitoring.

## Next Steps

- **T011**: Create entities and repositories in application code
- **T012**: Implement OAuth2/JWT middleware
- **T013**: Add RBAC guards for role-based access
- **T014**: Setup test frameworks with Testcontainers
