/**
 * Integration tests for GET /imports/{id} endpoint
 * Tests: batch retrieval, classification statistics
 */

import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Pool } from 'pg';
import { testcontainers } from 'testcontainers';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

let pool: Pool;
let container: any;
const BASE_URL = 'http://localhost:3000';

describe('GET /imports/{id} - Import Status and Statistics', () => {
  let testAccountId: string;
  let testBatchId: string;
  let testCategoryId: string;

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
    testAccountId = uuidv4();
    testBatchId = uuidv4();
    testCategoryId = uuidv4();

    await pool.query(
      `INSERT INTO account (id, name, bank_name, status) 
       VALUES ($1, 'Test Account', 'Test Bank', 'ACTIVE')`,
      [testAccountId]
    );

    await pool.query(
      `INSERT INTO category (id, name, tipo) 
       VALUES ($1, 'Salário', 'RECEITA')`,
      [testCategoryId]
    );

    await pool.query(
      `INSERT INTO import_batch (id, account_id, uploaded_by, file_checksum, period_month, period_year, encoding, row_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [testBatchId, testAccountId, 'test-user', 'test-checksum-123', 12, 2024, 'UTF8', 3]
    );

    // Insert sample transactions: 2 classified, 1 unclassified
    await pool.query(
      `INSERT INTO transaction (id, account_id, batch_id, date, documento, amount, category_id, tipo, classification_source)
       VALUES 
       ($1, $2, $3, '2024-12-01', 'DOC001', 1000, $4, 'RECEITA', 'RULE'),
       ($5, $2, $3, '2024-12-02', 'DOC002', -500, $4, 'DESPESA', 'OVERRIDE'),
       ($6, $2, $3, '2024-12-03', 'DOC003', 2500, NULL, NULL, 'NONE')`,
      [uuidv4(), testAccountId, testBatchId, testCategoryId, uuidv4(), uuidv4()]
    );
  });

  afterAll(async () => {
    await pool.end();
    await container.stop();
  });

  it('should retrieve import batch with status', async () => {
    const response = await fetch(`${BASE_URL}/imports/${testBatchId}`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.id).toBe(testBatchId);
    expect(data.status).toBe('COMPLETED');
    expect(data.rowCount).toBe(3);
    expect(data.classification.total).toBe(3);
  });

  it('should calculate classification statistics', async () => {
    const response = await fetch(`${BASE_URL}/imports/${testBatchId}`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.classification).toBeDefined();
    expect(data.classification.classified).toBe(2);
    expect(data.classification.unclassified).toBe(1);
    expect(data.classification.percentClassified).toBe(67); // 2/3 = 66.67% rounded to 67%
  });

  it('should return 404 for non-existent batch', async () => {
    const fakeId = uuidv4();
    const response = await fetch(`${BASE_URL}/imports/${fakeId}`);

    expect(response.status).toBe(404);
    const data = await response.json();
    expect(data.error).toBe('NOT_FOUND');
  });

  it('should include import metadata in response', async () => {
    const response = await fetch(`${BASE_URL}/imports/${testBatchId}`);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.accountId).toBe(testAccountId);
    expect(data.uploadedBy).toBe('test-user');
    expect(data.fileChecksum).toBe('test-checksum-123');
    expect(data.periodMonth).toBe(12);
    expect(data.periodYear).toBe(2024);
    expect(data.encoding).toBe('UTF8');
  });
});
