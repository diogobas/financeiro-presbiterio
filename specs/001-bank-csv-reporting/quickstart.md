# Quickstart: Bank CSV Reporting

## Prerequisites
- Docker & Docker Compose
- Node.js 20, Java 21 (for local dev)
- PostgreSQL 16

## Services
- Ingestion (Node/TS) → REST OpenAPI at /ingestion
- Reporting (Spring Boot) → GraphQL at /graphql
- Frontend (React/TS)

## Local Setup (suggested)
1. Start PostgreSQL
2. Build and run services with Docker Compose (to be added under infra/)
3. Seed categories as needed

## Sample Import (cURL)
```bash
curl -F file=@/path/to/month.csv \
     -F accountId=ACCOUNT_UUID \
     -F periodMonth=1 -F periodYear=2025 \
     https://api.example.com/ingestion/imports
```

## Sample GraphQL Query
```graphql
query MonthSummaries($m:Int!, $y:Int!, $acct:ID) {
  summaries(month:$m, year:$y, accountId:$acct) {
    categoryId
    categoryName
    tipo
    total
    count
  }
}
```

## Constitution Gates (Checklist)
- Data validations and DB constraints defined
- Tests for normalization, idempotency, classification rules
- Report SLOs + EXPLAIN plan checks
- UX uses shared component library with a11y
