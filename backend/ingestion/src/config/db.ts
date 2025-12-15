import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

/**
 * PostgreSQL Connection Pool Configuration
 * Manages database connections for the ingestion service
 */

interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
  ssl: boolean | { rejectUnauthorized: boolean };
}

/**
 * Load database configuration from environment variables
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.DATABASE_HOST || 'postgres',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'financeiro',
    user: process.env.DATABASE_USER || 'app',
    password: process.env.DATABASE_PASSWORD || 'app',
    maxConnections: parseInt(process.env.DATABASE_MAX_CONNECTIONS || '20'),
    idleTimeout: parseInt(process.env.DATABASE_IDLE_TIMEOUT || '30000'),
    connectionTimeout: parseInt(process.env.DATABASE_CONNECTION_TIMEOUT || '10000'),
    ssl:
      process.env.DATABASE_SSL === 'true'
        ? { rejectUnauthorized: process.env.NODE_ENV === 'production' }
        : false,
  };
}

/**
 * Global database pool instance
 */
let pool: Pool | null = null;

/**
 * Initialize database connection pool
 * Call this during application startup
 */
export async function initializePool(): Promise<Pool> {
  if (pool) {
    return pool;
  }

  const config = getDatabaseConfig();

  pool = new Pool({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    max: config.maxConnections,
    idleTimeoutMillis: config.idleTimeout,
    connectionTimeoutMillis: config.connectionTimeout,
    ssl: config.ssl,
  });

  // Handle pool errors
  pool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });

  // Test connection
  try {
    const client = await pool.connect();
    const result = await client.query('SELECT NOW()');
    client.release();
    console.log('✓ Database connection successful', {
      host: config.host,
      port: config.port,
      database: config.database,
      timestamp: result.rows[0].now,
    });
  } catch (err) {
    console.error('✗ Database connection failed:', err);
    throw err;
  }

  return pool;
}

/**
 * Get database pool instance
 * Must call initializePool() first
 */
export function getPool(): Pool {
  if (!pool) {
    throw new Error('Database pool not initialized. Call initializePool() during startup.');
  }
  return pool;
}

/**
 * Execute a query using the connection pool
 */
export async function query<T = any>(text: string, values?: any[]): Promise<T[]> {
  const pool = getPool();
  try {
    const result = await pool.query(text, values);
    return result.rows;
  } catch (err) {
    console.error('Database query error:', { text, values, error: err });
    throw err;
  }
}

/**
 * Execute a query that returns a single row
 */
export async function queryOne<T = any>(text: string, values?: any[]): Promise<T | null> {
  const rows = await query<T>(text, values);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute multiple statements in a transaction
 */
export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Transaction failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Close the database pool
 * Call this during application shutdown
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('✓ Database connection pool closed');
  }
}

/**
 * Run database migrations on startup
 * Executes all .sql files in migrations directory
 */
export async function runMigrations(): Promise<void> {
  const fs = await import('fs').then((m) => m.promises);
  const path = await import('path');

  const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
  console.log(`Migrations directory: ${migrationsDir}`);
  console.log(`__dirname: ${__dirname}`);

  const pool = getPool();

  try {
    // Check if migrations directory exists
    try {
      await fs.access(migrationsDir);
    } catch {
      console.log('⚠ Migrations directory not found, skipping migrations');
      return;
    }

    // Get all migration files
    const files = (await fs.readdir(migrationsDir)).filter((f) => f.endsWith('.sql')).sort();

    console.log(`Found ${files.length} migration(s)`);

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = await fs.readFile(filePath, 'utf-8');

      console.log(`Executing migration: ${file}`);
      // Execute the entire file as-is; PostgreSQL can handle multiple statements
      await pool.query(sql);
      console.log(`✓ Migration complete: ${file}`);
    }
  } catch (err) {
    console.error('Migration error:', err);
    throw err;
  }
}
