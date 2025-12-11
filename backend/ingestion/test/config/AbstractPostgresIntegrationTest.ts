import { GenericContainer, StartedTestContainer } from 'testcontainers';
import { Pool } from 'pg';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Base class for PostgreSQL integration tests using Testcontainers
 *
 * Automatically:
 * - Starts a PostgreSQL 16 container
 * - Runs migrations from src/db/migrations
 * - Provides a Pool connection for tests
 * - Cleans up after tests
 */
export class AbstractPostgresIntegrationTest {
  private static container: StartedTestContainer | null = null;
  private static pool: Pool | null = null;

  /**
   * Start PostgreSQL container and initialize database
   */
  static async startDatabase(): Promise<void> {
    if (this.pool) {
      return; // Already started
    }

    // Start container
    this.container = await new GenericContainer('postgres:16')
      .withEnvironment({
        POSTGRES_USER: 'test',
        POSTGRES_PASSWORD: 'test',
        POSTGRES_DB: 'test_db',
      })
      .withExposedPorts(5432)
      .withHealthCheck({
        test: ['CMD-SHELL', 'pg_isready -U test -d test_db'],
        interval: 1000,
        timeout: 5000,
        retries: 5,
        startPeriod: 1000,
      })
      .start();

    const host = this.container.getHost();
    const port = this.container.getMappedPort(5432);

    // Create pool
    this.pool = new Pool({
      host,
      port,
      user: 'test',
      password: 'test',
      database: 'test_db',
    });

    // Run migrations
    await this.runMigrations();
  }

  /**
   * Stop PostgreSQL container and close pool
   */
  static async stopDatabase(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
    }

    if (this.container) {
      await this.container.stop();
      this.container = null;
    }
  }

  /**
   * Run all migrations from src/db/migrations
   */
  private static async runMigrations(): Promise<void> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    const migrationsDir = path.join(__dirname, '../../src/db/migrations');

    if (!fs.existsSync(migrationsDir)) {
      console.warn(`Migrations directory not found: ${migrationsDir}`);
      return;
    }

    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.sql'))
      .sort();

    for (const file of files) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf-8');

      // Split by ; to handle multiple statements
      const statements = sql
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        try {
          await this.pool.query(statement);
        } catch (error) {
          console.error(`Error running migration ${file}: ${statement}`);
          throw error;
        }
      }

      console.log(`Migration ${file} completed`);
    }
  }

  /**
   * Get the pool instance for use in tests
   */
  static getPool(): Pool {
    if (!this.pool) {
      throw new Error('Database not initialized. Call startDatabase() in beforeAll()');
    }
    return this.pool;
  }

  /**
   * Clean up a table (for test isolation)
   */
  static async cleanTable(tableName: string): Promise<void> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }
    await this.pool.query(`DELETE FROM ${tableName}`);
  }

  /**
   * Clean up multiple tables
   */
  static async cleanTables(...tableNames: string[]): Promise<void> {
    if (!this.pool) {
      throw new Error('Pool not initialized');
    }

    for (const table of tableNames) {
      await this.pool.query(`DELETE FROM ${table}`);
    }
  }
}

// Jest hooks to manage database lifecycle
beforeAll(async () => {
  await AbstractPostgresIntegrationTest.startDatabase();
});

afterAll(async () => {
  await AbstractPostgresIntegrationTest.stopDatabase();
});
