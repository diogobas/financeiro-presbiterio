/**
 * Integration tests for POST /imports endpoint
 * Tests: file upload, account validation, duplicate detection, CSV parsing
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { testcontainers } from 'testcontainers';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

let pool: Pool;
let container: any;
const BASE_URL = 'http://localhost:3000';

// Mock test CSV
const TEST_CSV_CONTENT = `Data,Documento,Valor
11/12/2024,DOC001,1000,00
12/12/2024,DOC002,(500,00)
13/12/2024,DOC003,2500,50
`;

describe('POST /imports - CSV Upload Integration', () => {
  beforeAll(async () => {
    // Start PostgreSQL container
    container = await new testcontainers.GenericContainer('postgres:15')
      .withEnvironment({ POSTGRES_PASSWORD: 'password' })
      .withExposedPorts(5432)
      .start();

    // Initialize database connection
    pool = new Pool({
      host: container.getHost(),
      port: container.getMappedPort(5432),
      database: 'postgres',
      user: 'postgres',
      password: 'password',
    });

    // Wait for database to be ready
    let ready = false;
    for (let i = 0; i < 10; i++) {
      try {
        await pool.query('SELECT 1');
        ready = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
    }

    if (!ready) {
      throw new Error('PostgreSQL failed to start');
    }

    // Run migrations
    const migrationSQL = fs.readFileSync(
      path.join(__dirname, '../../db/migrations/001_init_schema.sql'),
      'utf8'
    );
    await pool.query(migrationSQL);

    // Insert test data
    await pool.query(
      `INSERT INTO account (id, name, bank_name, status) 
       VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Test Account', 'Test Bank', 'ACTIVE')`
    );
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  it('should upload CSV and create import batch', async () => {
    const form = new FormData();
    form.append('file', Buffer.from(TEST_CSV_CONTENT), 'test.csv');
    form.append('accountId', '550e8400-e29b-41d4-a716-446655440000');
    form.append('periodMonth', '12');
    form.append('periodYear', '2024');

    const response = await fetch(`${BASE_URL}/imports`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(202);
    const data = await response.json();
    expect(data.id).toBeDefined();
    expect(data.rowCount).toBe(3);
    expect(data.status).toBe('ACCEPTED');
  });

  it('should reject missing required fields', async () => {
    const form = new FormData();
    form.append('file', Buffer.from(TEST_CSV_CONTENT), 'test.csv');
    form.append('accountId', '550e8400-e29b-41d4-a716-446655440000');
    // Missing periodMonth and periodYear

    const response = await fetch(`${BASE_URL}/imports`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('MISSING_FIELDS');
  });

  it('should reject invalid account', async () => {
    const form = new FormData();
    form.append('file', Buffer.from(TEST_CSV_CONTENT), 'test.csv');
    form.append('accountId', 'invalid-account-id');
    form.append('periodMonth', '12');
    form.append('periodYear', '2024');

    const response = await fetch(`${BASE_URL}/imports`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('ACCOUNT_NOT_FOUND');
  });

  it('should detect duplicate imports by checksum', async () => {
    // First upload
    const form1 = new FormData();
    form1.append('file', Buffer.from(TEST_CSV_CONTENT), 'test.csv');
    form1.append('accountId', '550e8400-e29b-41d4-a716-446655440000');
    form1.append('periodMonth', '12');
    form1.append('periodYear', '2024');

    const response1 = await fetch(`${BASE_URL}/imports`, {
      method: 'POST',
      body: form1,
    });
    expect(response1.status).toBe(202);

    // Second upload (same content, same period)
    const form2 = new FormData();
    form2.append('file', Buffer.from(TEST_CSV_CONTENT), 'test.csv');
    form2.append('accountId', '550e8400-e29b-41d4-a716-446655440000');
    form2.append('periodMonth', '12');
    form2.append('periodYear', '2024');

    const response2 = await fetch(`${BASE_URL}/imports`, {
      method: 'POST',
      body: form2,
    });

    expect(response2.status).toBe(409);
    const data = await response2.json();
    expect(data.error).toBe('DUPLICATE_IMPORT');
  });

  it('should validate period month', async () => {
    const form = new FormData();
    form.append('file', Buffer.from(TEST_CSV_CONTENT), 'test.csv');
    form.append('accountId', '550e8400-e29b-41d4-a716-446655440000');
    form.append('periodMonth', '13');
    form.append('periodYear', '2024');

    const response = await fetch(`${BASE_URL}/imports`, {
      method: 'POST',
      body: form,
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('INVALID_PERIOD');
  });
});
