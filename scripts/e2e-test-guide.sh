#!/bin/bash

# Manual E2E Test Script
# This script helps you set up and test the entire system

set -e

PROJECT_ROOT="/Users/diogobastos/workspace/personal/financeiro-presbiterio"
POSTGRES_CONTAINER="pg"

echo "╔════════════════════════════════════════════════════════════════════════════╗"
echo "║                   END-TO-END MANUAL TEST GUIDE                              ║"
echo "║           Bank CSV Reporting System - Complete Stack                        ║"
echo "╚════════════════════════════════════════════════════════════════════════════╝"

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "\n${BLUE}=== STEP 1: Clean up any existing containers ===${NC}"
echo "Stopping and removing existing containers..."
cd "$PROJECT_ROOT"
docker-compose down --volumes || true
sleep 2

echo -e "\n${BLUE}=== STEP 2: Start PostgreSQL ===${NC}"
echo "Starting PostgreSQL container..."
docker-compose up -d postgres
echo "Waiting for PostgreSQL to be healthy..."
sleep 10

echo -e "\n${BLUE}=== STEP 3: Run database migrations ===${NC}"
echo "Running migrations for ingestion service..."
cd "$PROJECT_ROOT/backend/ingestion"
npm run migrate 2>&1 || {
  echo -e "${YELLOW}Note: If npm run migrate fails, you can manually run:${NC}"
  echo "  cd backend/ingestion && npx tsx src/scripts/migrate.ts"
}

echo -e "\n${GREEN}✓ Infrastructure ready!${NC}"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo -e "${BLUE}NEXT: Open 3 new terminal windows and run the services:${NC}"
echo ""
echo -e "${YELLOW}Terminal 1 - Ingestion Service (Node):${NC}"
echo "  cd $PROJECT_ROOT/backend/ingestion"
echo "  npm run dev"
echo ""
echo -e "${YELLOW}Terminal 2 - Reporting Service (Java):${NC}"
echo "  cd $PROJECT_ROOT/backend/reporting"
echo "  mvn spring-boot:run"
echo ""
echo -e "${YELLOW}Terminal 3 - Frontend (React):${NC}"
echo "  cd $PROJECT_ROOT/frontend"
echo "  npm run dev"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}After all services are running (2-3 minutes), access:${NC}"
echo "  Frontend:   http://localhost:5173"
echo "  Ingestion:  http://localhost:3000"
echo "  Reporting:  http://localhost:8080"
echo "  PostgreSQL: localhost:5432 (user: app, pass: app, db: financeiro)"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${YELLOW}Manual Test Flow:${NC}"
echo "  1. Open http://localhost:5173 in browser"
echo "  2. Navigate to Upload page"
echo "  3. Select an account from dropdown"
echo "  4. Select a month and year"
echo "  5. Upload a sample CSV file (see below for format)"
echo "  6. Review the import results on preview page"
echo "  7. Check GET /imports/{id} endpoint"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${YELLOW}Sample CSV Format (to test with):${NC}"
cat << 'CSV'
Data,Documento,Valor
01/12/2025,000001,1.234,56
02/12/2025,000002,(500,00)
03/12/2025,000003,2.000,00
CSV
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${YELLOW}Health Check Endpoints:${NC}"
echo "  Ingestion Health:  curl http://localhost:3000/health"
echo "  DB Health:         curl http://localhost:3000/health/db"
echo "  Reporting Health:  curl http://localhost:8080/actuator/health"
echo ""
echo "═══════════════════════════════════════════════════════════════════════════════"
echo ""
echo -e "${GREEN}✓ Setup complete! Ready for manual testing.${NC}"
