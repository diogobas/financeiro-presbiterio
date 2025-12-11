/**
 * TransactionRepository - PostgreSQL implementation
 * Handles all database operations for Transaction entities
 */

import { query } from '../config/db';
import {
  Transaction,
  CreateTransactionInput,
  TransactionType,
  ClassificationSource,
} from './types';
import { ITransactionRepository } from './repositories';

/**
 * Convert database row to Transaction domain model
 */
function mapRowToTransaction(row: any): Transaction {
  return {
    id: row.id,
    accountId: row.account_id,
    batchId: row.batch_id,
    date: new Date(row.date),
    documento: row.documento,
    documentoNormalized: row.documento_normalized,
    amount: parseFloat(row.amount),
    currency: row.currency,
    categoryId: row.category_id,
    tipo: row.tipo as TransactionType | undefined,
    classificationSource: row.classification_source as ClassificationSource,
    ruleId: row.rule_id,
    ruleVersion: row.rule_version,
    rationale: row.rationale,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class TransactionRepository implements ITransactionRepository {
  /**
   * Find transaction by ID
   */
  async findById(id: string): Promise<Transaction | null> {
    const result = await query('SELECT * FROM transaction WHERE id = $1', [id]);
    return result.length > 0 ? mapRowToTransaction(result[0]) : null;
  }

  /**
   * Find all transactions for a batch
   */
  async findByBatchId(batchId: string): Promise<Transaction[]> {
    const result = await query(
      'SELECT * FROM transaction WHERE batch_id = $1 ORDER BY date ASC, created_at ASC',
      [batchId]
    );
    return result.map(mapRowToTransaction);
  }

  /**
   * Find unclassified transactions for an account
   */
  async findUnclassified(
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const transactions = await query(
      `SELECT * FROM transaction 
       WHERE account_id = $1 AND category_id IS NULL
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as count FROM transaction WHERE account_id = $1 AND category_id IS NULL',
      [accountId]
    );

    return {
      transactions: transactions.map(mapRowToTransaction),
      total: parseInt(countResult[0].count, 10),
    };
  }

  /**
   * Find transactions by batch and status
   */
  async findByBatchAndStatus(
    batchId: string,
    status: 'classified' | 'unclassified'
  ): Promise<Transaction[]> {
    let sql = 'SELECT * FROM transaction WHERE batch_id = $1';
    const params: any[] = [batchId];

    if (status === 'classified') {
      sql += ' AND category_id IS NOT NULL';
    } else {
      sql += ' AND category_id IS NULL';
    }

    sql += ' ORDER BY date ASC';
    const result = await query(sql, params);
    return result.map(mapRowToTransaction);
  }

  /**
   * Find transactions by account (paginated)
   */
  async findByAccountId(
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const transactions = await query(
      'SELECT * FROM transaction WHERE account_id = $1 ORDER BY date DESC, created_at DESC LIMIT $2 OFFSET $3',
      [accountId, limit, offset]
    );

    const countResult = await query(
      'SELECT COUNT(*) as count FROM transaction WHERE account_id = $1',
      [accountId]
    );

    return {
      transactions: transactions.map(mapRowToTransaction),
      total: parseInt(countResult[0].count, 10),
    };
  }

  /**
   * Create a new transaction
   */
  async create(input: CreateTransactionInput): Promise<Transaction> {
    const classificationSource = input.classificationSource || 'NONE';

    const result = await query(
      `INSERT INTO transaction (
        account_id, batch_id, date, documento, amount, currency,
        category_id, tipo, classification_source, rule_id, rule_version, rationale,
        created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *`,
      [
        input.accountId,
        input.batchId,
        input.date,
        input.documento,
        input.amount,
        input.currency || 'BRL',
        input.categoryId || null,
        input.tipo || null,
        classificationSource,
        input.ruleId || null,
        input.ruleVersion || null,
        input.rationale || null,
      ]
    );

    return mapRowToTransaction(result[0]);
  }

  /**
   * Create multiple transactions in batch
   */
  async createMany(inputs: CreateTransactionInput[]): Promise<Transaction[]> {
    if (inputs.length === 0) {
      return [];
    }

    // Use a transaction for atomicity
    const sqlStatements = inputs.map((input, index) => {
      const classificationSource = input.classificationSource || 'NONE';
      const paramStart = index * 12 + 1;

      return `(
          $${paramStart}, $${paramStart + 1}, $${paramStart + 2}, $${paramStart + 3}, $${paramStart + 4}, $${paramStart + 5},
          $${paramStart + 6}, $${paramStart + 7}, $${paramStart + 8}, $${paramStart + 9}, $${paramStart + 10}, $${paramStart + 11}
        )`;
    });

    const allParams = inputs.flatMap((input) => [
      input.accountId,
      input.batchId,
      input.date,
      input.documento,
      input.amount,
      input.currency || 'BRL',
      input.categoryId || null,
      input.tipo || null,
      input.classificationSource || 'NONE',
      input.ruleId || null,
      input.ruleVersion || null,
      input.rationale || null,
    ]);

    const sql = `
      INSERT INTO transaction (
        account_id, batch_id, date, documento, amount, currency,
        category_id, tipo, classification_source, rule_id, rule_version, rationale,
        created_at, updated_at
      ) VALUES ${sqlStatements.join(', ')}
      RETURNING *
    `;

    const results = await query(sql, allParams);
    return results.map(mapRowToTransaction);
  }

  /**
   * Update transaction (typically for classification)
   */
  async update(
    id: string,
    updates: Partial<{
      categoryId: string;
      tipo: TransactionType;
      classificationSource: ClassificationSource;
      ruleId: string;
      ruleVersion: number;
      rationale: string;
    }>
  ): Promise<Transaction> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.categoryId !== undefined) {
      setClauses.push(`category_id = $${paramIndex++}`);
      values.push(updates.categoryId);
    }

    if (updates.tipo !== undefined) {
      setClauses.push(`tipo = $${paramIndex++}`);
      values.push(updates.tipo);
    }

    if (updates.classificationSource !== undefined) {
      setClauses.push(`classification_source = $${paramIndex++}`);
      values.push(updates.classificationSource);
    }

    if (updates.ruleId !== undefined) {
      setClauses.push(`rule_id = $${paramIndex++}`);
      values.push(updates.ruleId);
    }

    if (updates.ruleVersion !== undefined) {
      setClauses.push(`rule_version = $${paramIndex++}`);
      values.push(updates.ruleVersion);
    }

    if (updates.rationale !== undefined) {
      setClauses.push(`rationale = $${paramIndex++}`);
      values.push(updates.rationale);
    }

    if (setClauses.length === 0) {
      return this.findById(id) as Promise<Transaction>;
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE transaction SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await query(sql, values);

    if (result.length === 0) {
      throw new Error(`Transaction with id ${id} not found`);
    }

    return mapRowToTransaction(result[0]);
  }

  /**
   * Count transactions in a batch
   */
  async countByBatchId(batchId: string): Promise<number> {
    const result = await query('SELECT COUNT(*) as count FROM transaction WHERE batch_id = $1', [
      batchId,
    ]);
    return parseInt(result[0].count, 10);
  }

  /**
   * Count classified vs unclassified for a batch
   */
  async getClassificationStats(batchId: string): Promise<{
    classified: number;
    unclassified: number;
  }> {
    const result = await query(
      `SELECT
        COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END) as classified,
        COUNT(CASE WHEN category_id IS NULL THEN 1 END) as unclassified
      FROM transaction
      WHERE batch_id = $1`,
      [batchId]
    );

    return {
      classified: parseInt(result[0].classified, 10),
      unclassified: parseInt(result[0].unclassified, 10),
    };
  }
}
