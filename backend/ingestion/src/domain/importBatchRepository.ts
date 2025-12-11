/**
 * ImportBatchRepository - PostgreSQL implementation
 * Handles all database operations for ImportBatch entities
 */

import { query } from '../config/db';
import { ImportBatch, CreateImportBatchInput, EncodingType } from './types';
import { IImportBatchRepository } from './repositories';

/**
 * Convert database row to ImportBatch domain model
 */
function mapRowToImportBatch(row: any): ImportBatch {
  return {
    id: row.id,
    accountId: row.account_id,
    uploadedBy: row.uploaded_by,
    uploadedAt: new Date(row.uploaded_at),
    fileChecksum: row.file_checksum,
    periodMonth: row.period_month,
    periodYear: row.period_year,
    encoding: row.encoding as EncodingType,
    rowCount: row.row_count,
  };
}

export class ImportBatchRepository implements IImportBatchRepository {
  /**
   * Find import batch by ID
   */
  async findById(id: string): Promise<ImportBatch | null> {
    const result = await query('SELECT * FROM import_batch WHERE id = $1', [id]);
    return result.length > 0 ? mapRowToImportBatch(result[0]) : null;
  }

  /**
   * Find batches for an account, optionally for a specific period
   */
  async findByAccountId(
    accountId: string,
    periodMonth?: number,
    periodYear?: number
  ): Promise<ImportBatch[]> {
    let sql = 'SELECT * FROM import_batch WHERE account_id = $1';
    const params: any[] = [accountId];
    let paramIndex = 2;

    if (periodMonth !== undefined) {
      sql += ` AND period_month = $${paramIndex++}`;
      params.push(periodMonth);
    }

    if (periodYear !== undefined) {
      sql += ` AND period_year = $${paramIndex++}`;
      params.push(periodYear);
    }

    sql += ' ORDER BY uploaded_at DESC';
    const result = await query(sql, params);
    return result.map(mapRowToImportBatch);
  }

  /**
   * Find batch by checksum to detect duplicates
   */
  async findByChecksum(
    accountId: string,
    fileChecksum: string,
    periodMonth: number,
    periodYear: number
  ): Promise<ImportBatch | null> {
    const result = await query(
      `SELECT * FROM import_batch
       WHERE account_id = $1 AND file_checksum = $2 AND period_month = $3 AND period_year = $4`,
      [accountId, fileChecksum, periodMonth, periodYear]
    );
    return result.length > 0 ? mapRowToImportBatch(result[0]) : null;
  }

  /**
   * Create a new import batch
   */
  async create(input: CreateImportBatchInput): Promise<ImportBatch> {
    const encoding = input.encoding || 'UTF8';
    const rowCount = input.rowCount || 0;

    const result = await query(
      `INSERT INTO import_batch (account_id, uploaded_by, file_checksum, period_month, period_year, encoding, row_count, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
       RETURNING *`,
      [
        input.accountId,
        input.uploadedBy,
        input.fileChecksum,
        input.periodMonth,
        input.periodYear,
        encoding,
        rowCount,
      ]
    );

    return mapRowToImportBatch(result[0]);
  }

  /**
   * Update row count after import completion
   */
  async updateRowCount(id: string, rowCount: number): Promise<ImportBatch> {
    const result = await query('UPDATE import_batch SET row_count = $1 WHERE id = $2 RETURNING *', [
      rowCount,
      id,
    ]);

    if (result.length === 0) {
      throw new Error(`ImportBatch with id ${id} not found`);
    }

    return mapRowToImportBatch(result[0]);
  }

  /**
   * Find all batches for an account (paginated)
   */
  async findAllByAccountId(
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ batches: ImportBatch[]; total: number }> {
    const batches = await query(
      'SELECT * FROM import_batch WHERE account_id = $1 ORDER BY uploaded_at DESC LIMIT $2 OFFSET $3',
      [accountId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as count FROM import_batch WHERE account_id = $1',
      [accountId]
    );

    return {
      batches: batches.map(mapRowToImportBatch),
      total: parseInt(countResult[0].count, 10),
    };
  }
}
