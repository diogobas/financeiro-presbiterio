import { createHash } from 'crypto';
import { Pool, QueryResult } from 'pg';
import { parseCSVRow, TransactionRow } from './csvParser';
import { v4 as uuidv4 } from 'uuid';

/**
 * Import batch status enum
 */
export enum ImportStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

/**
 * Import batch domain model
 */
export interface ImportBatch {
  id: string;
  accountId: string;
  uploadedAt: Date;
  fileChecksum: string;
  periodMonth: number;
  periodYear: number;
  rowCount: number;
  status: ImportStatus;
  createdBy?: string;
  createdAt: Date;
  errorMessage?: string;
}

/**
 * Transaction domain model
 */
export interface Transaction {
  id: string;
  batchId: string;
  accountId: string;
  date: Date;
  documento: string;
  amount: number;
  currency: string;
  rowHash: string;
  categoryId?: string;
  tipo?: string;
  classificationSource: 'RULE' | 'OVERRIDE' | 'NONE';
  ruleId?: string;
  ruleVersion?: number;
  rationale?: string;
  createdAt: Date;
}

/**
 * Import service for handling CSV uploads and deduplication
 *
 * Responsibilities:
 * - Parse CSV files into transactions
 * - Calculate file checksums for deduplication
 * - Detect and skip duplicate rows
 * - Store import batches and transactions
 * - Track import status and metadata
 */
export class ImportService {
  private pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  /**
   * Calculate SHA256 checksum for file content
   *
   * @param fileContent - Raw file content (Buffer or string)
   * @returns SHA256 hex digest
   */
  calculateFileChecksum(fileContent: Buffer | string): string {
    const buffer =
      typeof fileContent === 'string' ? Buffer.from(fileContent, 'utf-8') : fileContent;
    return createHash('sha256').update(buffer).digest('hex');
  }

  /**
   * Calculate row hash for deduplication
   *
   * Combines date + documento + amount to create unique row identifier
   *
   * @param row - Parsed transaction row
   * @returns SHA256 hash of row content
   */
  calculateRowHash(row: TransactionRow): string {
    const rowContent = `${row.date.toISOString()}|${row.documento}|${row.amount}`;
    return createHash('sha256').update(rowContent).digest('hex');
  }

  /**
   * Check if a batch with given checksum already exists
   *
   * Used to detect if same file was already imported
   *
   * @param fileChecksum - File checksum
   * @returns Existing batch ID or null
   */
  async findExistingBatch(fileChecksum: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT id FROM import_batch WHERE file_checksum = $1 LIMIT 1',
      [fileChecksum]
    );

    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  /**
   * Check if a transaction row already exists in a batch
   *
   * @param batchId - Import batch ID
   * @param rowHash - Row hash
   * @returns Existing transaction ID or null
   */
  async findDuplicateRow(batchId: string, rowHash: string): Promise<string | null> {
    const result = await this.pool.query(
      'SELECT id FROM transaction WHERE batch_id = $1 AND row_hash = $2 LIMIT 1',
      [batchId, rowHash]
    );

    return result.rows.length > 0 ? result.rows[0].id : null;
  }

  /**
   * Create a new import batch
   *
   * @param accountId - Account ID to import to
   * @param fileChecksum - File checksum for dedup
   * @param periodMonth - Import period month (1-12)
   * @param periodYear - Import period year (YYYY)
   * @param rowCount - Number of rows in CSV
   * @param createdBy - User ID (optional)
   * @returns Created ImportBatch
   */
  async createImportBatch(
    accountId: string,
    fileChecksum: string,
    periodMonth: number,
    periodYear: number,
    rowCount: number,
    createdBy?: string
  ): Promise<ImportBatch> {
    const id = uuidv4();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO import_batch 
       (id, account_id, file_checksum, period_year, period_month, row_count, status, created_by, created_at, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        accountId,
        fileChecksum,
        periodYear,
        periodMonth,
        rowCount,
        ImportStatus.PENDING,
        createdBy,
        now,
        now,
      ]
    );

    return this.rowToImportBatch(result.rows[0]);
  }

  /**
   * Insert a transaction row
   *
   * @param accountId - Account ID
   * @param batchId - Import batch ID
   * @param row - Parsed transaction row
   * @param rowHash - Pre-calculated row hash
   * @returns Created Transaction
   */
  async insertTransaction(
    accountId: string,
    batchId: string,
    row: TransactionRow,
    rowHash: string
  ): Promise<Transaction> {
    const id = uuidv4();
    const now = new Date();

    const result = await this.pool.query(
      `INSERT INTO transaction 
       (id, batch_id, account_id, date, documento, amount, currency, row_hash, classification_source, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [id, batchId, accountId, row.date, row.documento, row.amount, 'BRL', rowHash, 'NONE', now]
    );

    return this.rowToTransaction(result.rows[0]);
  }

  /**
   * Update import batch status
   *
   * @param batchId - Batch ID
   * @param status - New status
   * @param errorMessage - Error message (if FAILED)
   */
  async updateBatchStatus(
    batchId: string,
    status: ImportStatus,
    errorMessage?: string
  ): Promise<void> {
    await this.pool.query(
      `UPDATE import_batch 
       SET status = $1, error_message = $2
       WHERE id = $3`,
      [status, errorMessage || null, batchId]
    );
  }

  /**
   * Get import batch by ID
   *
   * @param batchId - Batch ID
   * @returns ImportBatch or null
   */
  async getImportBatch(batchId: string): Promise<ImportBatch | null> {
    const result = await this.pool.query('SELECT * FROM import_batch WHERE id = $1', [batchId]);

    return result.rows.length > 0 ? this.rowToImportBatch(result.rows[0]) : null;
  }

  /**
   * Get transactions for an import batch (with pagination)
   *
   * @param batchId - Batch ID
   * @param limit - Max rows to return
   * @param offset - Pagination offset
   * @returns Array of transactions
   */
  async getImportBatchTransactions(
    batchId: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<Transaction[]> {
    const result = await this.pool.query(
      `SELECT * FROM transaction 
       WHERE batch_id = $1
       ORDER BY date ASC, documento ASC
       LIMIT $2 OFFSET $3`,
      [batchId, limit, offset]
    );

    return result.rows.map((row) => this.rowToTransaction(row));
  }

  /**
   * Get transaction count for a batch
   *
   * @param batchId - Batch ID
   * @returns Count of transactions
   */
  async getImportBatchTransactionCount(batchId: string): Promise<number> {
    const result = await this.pool.query(
      'SELECT COUNT(*) as count FROM transaction WHERE batch_id = $1',
      [batchId]
    );

    return parseInt(result.rows[0].count, 10);
  }

  /**
   * Process a CSV file import
   *
   * This is the main orchestration method that:
   * 1. Calculates file checksum
   * 2. Checks for existing batch
   * 3. Parses CSV rows
   * 4. Detects and skips duplicates
   * 5. Creates batch and inserts rows
   *
   * @param csvContent - CSV file content
   * @param accountId - Account to import to
   * @param periodMonth - Period month
   * @param periodYear - Period year
   * @param createdBy - User ID (optional)
   * @returns Created ImportBatch with transaction count
   */
  async processImport(
    csvContent: Buffer | string,
    accountId: string,
    periodMonth: number,
    periodYear: number,
    createdBy?: string
  ): Promise<ImportBatch> {
    const fileChecksum = this.calculateFileChecksum(csvContent);

    // Parse CSV content
    const csvText = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf-8');

    const lines = csvText.trim().split('\n');
    const dataRows = lines.slice(1); // Skip header

    // Parse rows
    const parsedRows: Array<{ row: TransactionRow; hash: string }> = [];
    const errors: Array<{ lineNumber: number; error: string }> = [];

    for (let i = 0; i < dataRows.length; i++) {
      try {
        const cols = this.parseCSVLine(dataRows[i]);
        const row = parseCSVRow(cols);
        const hash = this.calculateRowHash(row);
        parsedRows.push({ row, hash });
      } catch (error) {
        errors.push({
          lineNumber: i + 2, // +2: skip header, 1-indexed
          error: (error as Error).message,
        });
      }
    }

    // If there are parse errors, fail the import
    if (errors.length > 0) {
      throw new Error(
        `Failed to parse CSV: ${errors.map((e) => `Line ${e.lineNumber}: ${e.error}`).join('; ')}`
      );
    }

    // Check if batch with same checksum + period already exists
    const existingBatchId = await this.findExistingBatch(fileChecksum);
    if (existingBatchId) {
      const batch = await this.getImportBatch(existingBatchId);
      if (batch && batch.periodMonth === periodMonth && batch.periodYear === periodYear) {
        return batch; // Return existing batch (idempotent)
      }
    }

    // Create import batch
    const batch = await this.createImportBatch(
      accountId,
      fileChecksum,
      periodMonth,
      periodYear,
      parsedRows.length,
      createdBy
    );

    try {
      // Insert rows (skip duplicates)
      let insertedCount = 0;
      let skippedCount = 0;

      for (const { row, hash } of parsedRows) {
        const isDuplicate = await this.findDuplicateRow(batch.id, hash);
        if (!isDuplicate) {
          await this.insertTransaction(accountId, batch.id, row, hash);
          insertedCount++;
        } else {
          skippedCount++;
        }
      }

      // Update batch status to COMPLETED
      await this.updateBatchStatus(batch.id, ImportStatus.COMPLETED);

      // Return updated batch
      const finalBatch = await this.getImportBatch(batch.id);
      if (!finalBatch) {
        throw new Error(`Failed to retrieve batch ${batch.id}`);
      }

      return finalBatch;
    } catch (error) {
      // Mark batch as FAILED
      await this.updateBatchStatus(batch.id, ImportStatus.FAILED, (error as Error).message);
      throw error;
    }
  }

  /**
   * Parse CSV line with proper quote handling
   *
   * @param line - CSV line
   * @returns Array of column values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const next = line[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // Field separator
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Convert database row to ImportBatch model
   */
  private rowToImportBatch(row: any): ImportBatch {
    return {
      id: row.id,
      accountId: row.account_id,
      uploadedAt: new Date(row.uploaded_at),
      fileChecksum: row.file_checksum,
      periodMonth: row.period_month,
      periodYear: row.period_year,
      rowCount: row.row_count,
      status: row.status,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at),
      errorMessage: row.error_message,
    };
  }

  /**
   * Convert database row to Transaction model
   */
  private rowToTransaction(row: any): Transaction {
    return {
      id: row.id,
      batchId: row.batch_id,
      accountId: row.account_id,
      date: new Date(row.date),
      documento: row.documento,
      amount: parseFloat(row.amount),
      currency: row.currency,
      rowHash: row.row_hash,
      categoryId: row.category_id,
      tipo: row.tipo,
      classificationSource: row.classification_source,
      ruleId: row.rule_id,
      ruleVersion: row.rule_version,
      rationale: row.rationale,
      createdAt: new Date(row.created_at),
    };
  }
}
