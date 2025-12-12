/**
 * Repository Implementations using PostgreSQL via pg driver
 * Provides concrete implementations of domain repository interfaces
 */

import { getPool } from '../config/db';
import {
  IAccountRepository,
  ICategoryRepository,
  IImportBatchRepository,
  ITransactionRepository,
  IRuleRepository,
  IClassificationOverrideRepository,
  IReportingRepository,
} from '../domain/repositories';
import {
  Account,
  Category,
  ImportBatch,
  Transaction,
  Rule,
  ClassificationOverride,
  CategoryTotalsView,
  CreateAccountInput,
  CreateCategoryInput,
  CreateImportBatchInput,
  CreateTransactionInput,
  CreateRuleInput,
  CreateClassificationOverrideInput,
  AccountStatus,
} from '../domain/types';

/**
 * AccountRepository Implementation
 */
export class PostgresAccountRepository implements IAccountRepository {
  async findById(id: string): Promise<Account | null> {
    const result = await getPool().query<Account>('SELECT * FROM account WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByAccountNumber(accountNumber: string): Promise<Account | null> {
    const result = await getPool().query<Account>(
      'SELECT * FROM account WHERE account_number = $1',
      [accountNumber]
    );
    return result.rows[0] || null;
  }

  async findAll(status?: AccountStatus): Promise<Account[]> {
    const query = status
      ? 'SELECT * FROM account WHERE status = $1 ORDER BY name'
      : 'SELECT * FROM account ORDER BY name';
    const params = status ? [status] : [];
    const result = await getPool().query<Account>(query, params);
    return result.rows;
  }

  async create(input: CreateAccountInput): Promise<Account> {
    const result = await getPool().query<Account>(
      `INSERT INTO account (name, bank_name, account_number, status) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      [input.name, input.bankName || null, input.accountNumber || null, input.status || 'ACTIVE']
    );
    return result.rows[0];
  }

  async update(id: string, updates: Partial<CreateAccountInput>): Promise<Account> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.bankName !== undefined) {
      fields.push(`bank_name = $${paramCount++}`);
      values.push(updates.bankName);
    }
    if (updates.accountNumber !== undefined) {
      fields.push(`account_number = $${paramCount++}`);
      values.push(updates.accountNumber);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${paramCount++}`);
      values.push(updates.status);
    }

    if (fields.length === 0) {
      return this.findById(id) as Promise<Account>;
    }

    fields.push(`updated_at = NOW()`);
    values.push(id);

    const result = await getPool().query<Account>(
      `UPDATE account SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    await getPool().query('UPDATE account SET status = $1, updated_at = NOW() WHERE id = $2', [
      'ARCHIVED',
      id,
    ]);
  }

  async count(status?: AccountStatus): Promise<number> {
    const query = status
      ? 'SELECT COUNT(*) as count FROM account WHERE status = $1'
      : 'SELECT COUNT(*) as count FROM account';
    const params = status ? [status] : [];
    const result = await getPool().query<{ count: number }>(query, params);
    return parseInt(result.rows[0].count as any);
  }
}

/**
 * CategoryRepository Implementation
 */
export class PostgresCategoryRepository implements ICategoryRepository {
  async findById(id: string): Promise<Category | null> {
    const result = await getPool().query<Category>('SELECT * FROM category WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findByName(name: string): Promise<Category | null> {
    const result = await getPool().query<Category>('SELECT * FROM category WHERE name = $1', [
      name,
    ]);
    return result.rows[0] || null;
  }

  async findAll(): Promise<Category[]> {
    const result = await getPool().query<Category>('SELECT * FROM category ORDER BY name');
    return result.rows;
  }

  async findByType(tipo: 'RECEITA' | 'DESPESA'): Promise<Category[]> {
    const result = await getPool().query<Category>(
      'SELECT * FROM category WHERE tipo = $1 ORDER BY name',
      [tipo]
    );
    return result.rows;
  }

  async create(input: CreateCategoryInput): Promise<Category> {
    const result = await getPool().query<Category>(
      'INSERT INTO category (name, tipo) VALUES ($1, $2) RETURNING *',
      [input.name, input.tipo]
    );
    return result.rows[0];
  }

  async update(id: string, updates: Partial<CreateCategoryInput>): Promise<Category> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramCount = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramCount++}`);
      values.push(updates.name);
    }
    if (updates.tipo !== undefined) {
      fields.push(`tipo = $${paramCount++}`);
      values.push(updates.tipo);
    }

    if (fields.length === 0) {
      return this.findById(id) as Promise<Category>;
    }

    values.push(id);
    const result = await getPool().query<Category>(
      `UPDATE category SET ${fields.join(', ')} WHERE id = $${paramCount} RETURNING *`,
      values
    );
    return result.rows[0];
  }

  async delete(id: string): Promise<void> {
    await getPool().query('DELETE FROM category WHERE id = $1', [id]);
  }

  async count(): Promise<number> {
    const result = await getPool().query<{ count: number }>(
      'SELECT COUNT(*) as count FROM category'
    );
    return parseInt(result.rows[0].count as any);
  }
}

/**
 * ImportBatchRepository Implementation
 */
export class PostgresImportBatchRepository implements IImportBatchRepository {
  async findById(id: string): Promise<ImportBatch | null> {
    const result = await getPool().query<ImportBatch>('SELECT * FROM import_batch WHERE id = $1', [
      id,
    ]);
    return result.rows[0] || null;
  }

  async findByAccountAndChecksum(accountId: string, checksum: string): Promise<ImportBatch | null> {
    const result = await getPool().query<ImportBatch>(
      'SELECT * FROM import_batch WHERE account_id = $1 AND file_checksum = $2',
      [accountId, checksum]
    );
    return result.rows[0] || null;
  }

  async findByAccount(accountId: string): Promise<ImportBatch[]> {
    const result = await getPool().query<ImportBatch>(
      'SELECT * FROM import_batch WHERE account_id = $1 ORDER BY uploaded_at DESC',
      [accountId]
    );
    return result.rows;
  }

  async findByPeriod(year: number, month: number): Promise<ImportBatch[]> {
    const result = await getPool().query<ImportBatch>(
      'SELECT * FROM import_batch WHERE period_year = $1 AND period_month = $2 ORDER BY uploaded_at DESC',
      [year, month]
    );
    return result.rows;
  }

  async create(input: CreateImportBatchInput): Promise<ImportBatch> {
    const result = await getPool().query<ImportBatch>(
      `INSERT INTO import_batch (account_id, uploaded_by, file_checksum, period_month, period_year, encoding, row_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.accountId,
        input.uploadedBy,
        input.fileChecksum,
        input.periodMonth,
        input.periodYear,
        input.encoding || 'UTF8',
        input.rowCount || 0,
      ]
    );
    return result.rows[0];
  }

  async getStats(accountId: string): Promise<{
    totalBatches: number;
    totalTransactions: number;
    dateRange: { from: Date; to: Date };
  }> {
    const result = await getPool().query<any>(
      `SELECT 
        COUNT(*) as total_batches,
        COALESCE(SUM(row_count), 0) as total_transactions,
        MIN(uploaded_at) as min_date,
        MAX(uploaded_at) as max_date
       FROM import_batch
       WHERE account_id = $1`,
      [accountId]
    );
    const row = result.rows[0];
    return {
      totalBatches: parseInt(row.total_batches),
      totalTransactions: parseInt(row.total_transactions),
      dateRange: { from: row.min_date, to: row.max_date },
    };
  }

  /**
   * Find batch by checksum with account and period (duplicate detection)
   */
  async findByChecksum(
    accountId: string,
    fileChecksum: string,
    periodMonth: number,
    periodYear: number
  ): Promise<ImportBatch | null> {
    const result = await getPool().query<ImportBatch>(
      `SELECT * FROM import_batch
       WHERE account_id = $1 AND file_checksum = $2 AND period_month = $3 AND period_year = $4`,
      [accountId, fileChecksum, periodMonth, periodYear]
    );
    return result.rows[0] || null;
  }

  /**
   * Find all batches for an account
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
    const result = await getPool().query<ImportBatch>(sql, params);
    return result.rows;
  }

  /**
   * Find batches by account (paginated)
   */
  async findAllByAccountId(
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ batches: ImportBatch[]; total: number }> {
    const batches = await getPool().query<ImportBatch>(
      'SELECT * FROM import_batch WHERE account_id = $1 ORDER BY uploaded_at DESC LIMIT $2 OFFSET $3',
      [accountId, limit, offset]
    );

    const countResult = await getPool().query<{ count: string }>(
      'SELECT COUNT(*) as count FROM import_batch WHERE account_id = $1',
      [accountId]
    );

    return {
      batches: batches.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }

  /**
   * Update row count after import
   */
  async updateRowCount(id: string, rowCount: number): Promise<ImportBatch> {
    const result = await getPool().query<ImportBatch>(
      'UPDATE import_batch SET row_count = $1 WHERE id = $2 RETURNING *',
      [rowCount, id]
    );

    if (result.rows.length === 0) {
      throw new Error(`ImportBatch with id ${id} not found`);
    }

    return result.rows[0];
  }

  /**
   * Get all unique months that have been uploaded
   */
  async getUploadedMonths(): Promise<Array<{ month: number; year: number }>> {
    const result = await getPool().query<{ period_month: number; period_year: number }>(
      `SELECT DISTINCT period_month, period_year FROM import_batch 
       WHERE period_month IS NOT NULL AND period_year IS NOT NULL
       ORDER BY period_year DESC, period_month DESC`
    );

    return result.rows.map((row) => ({
      month: row.period_month,
      year: row.period_year,
    }));
  }
}

/**
 * TransactionRepository Implementation
 */
export class PostgresTransactionRepository implements ITransactionRepository {
  async findById(id: string): Promise<Transaction | null> {
    const result = await getPool().query<Transaction>('SELECT * FROM transaction WHERE id = $1', [
      id,
    ]);
    return result.rows[0] || null;
  }

  async findByBatch(batchId: string): Promise<Transaction[]> {
    const result = await getPool().query<Transaction>(
      'SELECT * FROM transaction WHERE batch_id = $1 ORDER BY date, documento',
      [batchId]
    );
    return result.rows;
  }

  /**
   * Find all transactions in a batch
   */
  async findByBatchId(batchId: string): Promise<Transaction[]> {
    const result = await getPool().query<Transaction>(
      'SELECT * FROM transaction WHERE batch_id = $1 ORDER BY date ASC, created_at ASC',
      [batchId]
    );
    return result.rows;
  }

  /**
   * Find transactions by batch and classification status
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
    const result = await getPool().query<Transaction>(sql, params);
    return result.rows;
  }

  /**
   * Find unclassified transactions (paginated)
   */
  async findUnclassified(
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const transactions = await getPool().query<Transaction>(
      `SELECT * FROM transaction 
       WHERE account_id = $1 AND category_id IS NULL
       ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
      [accountId, limit, offset]
    );

    const countResult = await getPool().query<{ count: string }>(
      'SELECT COUNT(*) as count FROM transaction WHERE account_id = $1 AND category_id IS NULL',
      [accountId]
    );

    return {
      transactions: transactions.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
    accountId?: string
  ): Promise<Transaction[]> {
    const query = accountId
      ? 'SELECT * FROM transaction WHERE account_id = $1 AND date >= $2 AND date <= $3 ORDER BY date'
      : 'SELECT * FROM transaction WHERE date >= $1 AND date <= $2 ORDER BY date';
    const params = accountId ? [accountId, startDate, endDate] : [startDate, endDate];
    const result = await getPool().query<Transaction>(query, params);
    return result.rows;
  }

  async findByCategory(categoryId: string): Promise<Transaction[]> {
    const result = await getPool().query<Transaction>(
      'SELECT * FROM transaction WHERE category_id = $1 ORDER BY date DESC',
      [categoryId]
    );
    return result.rows;
  }

  async create(input: CreateTransactionInput): Promise<Transaction> {
    const result = await getPool().query<Transaction>(
      `INSERT INTO transaction (account_id, batch_id, date, documento, amount, currency, category_id, tipo, classification_source, rule_id, rule_version, rationale)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
        input.classificationSource || 'NONE',
        input.ruleId || null,
        input.ruleVersion || null,
        input.rationale || null,
      ]
    );
    return result.rows[0];
  }

  async createMany(inputs: CreateTransactionInput[]): Promise<Transaction[]> {
    if (inputs.length === 0) return [];

    const values: any[] = [];
    let paramCount = 1;
    const placeholders = inputs
      .map(() => {
        const ph = `($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`;
        return ph;
      })
      .join(', ');

    inputs.forEach((input) => {
      values.push(
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
        input.rationale || null
      );
    });

    const result = await getPool().query<Transaction>(
      `INSERT INTO transaction (account_id, batch_id, date, documento, amount, currency, category_id, tipo, classification_source, rule_id, rule_version, rationale)
       VALUES ${placeholders}
       RETURNING *`,
      values
    );
    return result.rows;
  }

  /**
   * Find transactions by account (paginated)
   */
  async findByAccountId(
    accountId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ transactions: Transaction[]; total: number }> {
    const transactions = await getPool().query<Transaction>(
      'SELECT * FROM transaction WHERE account_id = $1 ORDER BY date DESC, created_at DESC LIMIT $2 OFFSET $3',
      [accountId, limit, offset]
    );

    const countResult = await getPool().query<{ count: string }>(
      'SELECT COUNT(*) as count FROM transaction WHERE account_id = $1',
      [accountId]
    );

    return {
      transactions: transactions.rows,
      total: parseInt(countResult.rows[0].count),
    };
  }

  async updateClassification(
    id: string,
    categoryId: string,
    source: 'RULE' | 'OVERRIDE',
    ruleId?: string,
    rationale?: string
  ): Promise<Transaction> {
    const result = await getPool().query<Transaction>(
      `UPDATE transaction
       SET category_id = $1, classification_source = $2, rule_id = $3, rationale = $4, updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [categoryId, source, ruleId || null, rationale || null, id]
    );
    return result.rows[0];
  }

  /**
   * Update transaction (for classification)
   */
  async update(
    id: string,
    updates: Partial<{
      categoryId: string;
      tipo: 'RECEITA' | 'DESPESA';
      classificationSource: 'RULE' | 'OVERRIDE' | 'NONE';
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
    const result = await getPool().query<Transaction>(sql, values);

    if (result.rows.length === 0) {
      throw new Error(`Transaction with id ${id} not found`);
    }

    return result.rows[0];
  }

  /**
   * Count transactions in a batch
   */
  async countByBatchId(batchId: string): Promise<number> {
    const result = await getPool().query<{ count: string }>(
      'SELECT COUNT(*) as count FROM transaction WHERE batch_id = $1',
      [batchId]
    );
    return parseInt(result.rows[0].count);
  }

  /**
   * Count classified vs unclassified for a batch
   */
  async getClassificationStats(batchId: string): Promise<{
    classified: number;
    unclassified: number;
  }> {
    const result = await getPool().query<any>(
      `SELECT
        COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END) as classified,
        COUNT(CASE WHEN category_id IS NULL THEN 1 END) as unclassified
      FROM transaction
      WHERE batch_id = $1`,
      [batchId]
    );

    return {
      classified: parseInt(result.rows[0].classified),
      unclassified: parseInt(result.rows[0].unclassified),
    };
  }

  async countUnclassified(accountId?: string): Promise<number> {
    const query = accountId
      ? 'SELECT COUNT(*) as count FROM transaction WHERE account_id = $1 AND category_id IS NULL'
      : 'SELECT COUNT(*) as count FROM transaction WHERE category_id IS NULL';
    const params = accountId ? [accountId] : [];
    const result = await getPool().query<{ count: number }>(query, params);
    return parseInt(result.rows[0].count as any);
  }

  async getStats(
    accountId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    classified: number;
    unclassified: number;
    byType: Record<string, number>;
  }> {
    let query = `SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END) as classified,
        COUNT(CASE WHEN category_id IS NULL THEN 1 END) as unclassified
       FROM transaction
       WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 1;

    if (accountId !== undefined) {
      query += ` AND account_id = $${paramCount++}`;
      params.push(accountId);
    }
    if (startDate !== undefined) {
      query += ` AND date >= $${paramCount++}`;
      params.push(startDate);
    }
    if (endDate !== undefined) {
      query += ` AND date <= $${paramCount++}`;
      params.push(endDate);
    }

    const result = await getPool().query<any>(query, params);
    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      classified: parseInt(row.classified),
      unclassified: parseInt(row.unclassified),
      byType: {},
    };
  }
}

/**
 * RuleRepository Implementation
 */
export class PostgresRuleRepository implements IRuleRepository {
  async findById(id: string): Promise<Rule | null> {
    const result = await getPool().query<Rule>('SELECT * FROM rule WHERE id = $1', [id]);
    return result.rows[0] || null;
  }

  async findActive(): Promise<Rule[]> {
    const result = await getPool().query<Rule>(
      'SELECT * FROM rule WHERE active = true ORDER BY created_at DESC'
    );
    return result.rows;
  }

  async findByCategory(categoryId: string): Promise<Rule[]> {
    const result = await getPool().query<Rule>(
      'SELECT * FROM rule WHERE category_id = $1 ORDER BY version DESC',
      [categoryId]
    );
    return result.rows;
  }

  async findByType(tipo: 'RECEITA' | 'DESPESA'): Promise<Rule[]> {
    const result = await getPool().query<Rule>(
      'SELECT * FROM rule WHERE tipo = $1 ORDER BY created_at DESC',
      [tipo]
    );
    return result.rows;
  }

  async create(input: CreateRuleInput): Promise<Rule> {
    const result = await getPool().query<Rule>(
      `INSERT INTO rule (matcher_type, pattern, category_id, tipo, created_by, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        input.matcherType,
        input.pattern,
        input.categoryId,
        input.tipo,
        input.createdBy,
        input.active ?? true,
      ]
    );
    return result.rows[0];
  }

  async update(id: string, updates: Partial<Omit<CreateRuleInput, 'createdBy'>>): Promise<Rule> {
    const result = await getPool().query<Rule>(
      `UPDATE rule
       SET version = version + 1,
           matcher_type = COALESCE($1, matcher_type),
           pattern = COALESCE($2, pattern),
           category_id = COALESCE($3, category_id),
           tipo = COALESCE($4, tipo),
           active = COALESCE($5, active)
       WHERE id = $6
       RETURNING *`,
      [updates.matcherType, updates.pattern, updates.categoryId, updates.tipo, updates.active, id]
    );
    return result.rows[0];
  }

  async deactivate(id: string): Promise<void> {
    await getPool().query('UPDATE rule SET active = false WHERE id = $1', [id]);
  }

  async countActive(): Promise<number> {
    const result = await getPool().query<{ count: number }>(
      'SELECT COUNT(*) as count FROM rule WHERE active = true'
    );
    return parseInt(result.rows[0].count as any);
  }
}

/**
 * ClassificationOverrideRepository Implementation
 */
export class PostgresClassificationOverrideRepository implements IClassificationOverrideRepository {
  async findById(id: string): Promise<ClassificationOverride | null> {
    const result = await getPool().query<ClassificationOverride>(
      'SELECT * FROM classification_override WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  async findByTransaction(transactionId: string): Promise<ClassificationOverride | null> {
    const result = await getPool().query<ClassificationOverride>(
      'SELECT * FROM classification_override WHERE transaction_id = $1',
      [transactionId]
    );
    return result.rows[0] || null;
  }

  async findByActor(actor: string): Promise<ClassificationOverride[]> {
    const result = await getPool().query<ClassificationOverride>(
      'SELECT * FROM classification_override WHERE actor = $1 ORDER BY created_at DESC',
      [actor]
    );
    return result.rows;
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<ClassificationOverride[]> {
    const result = await getPool().query<ClassificationOverride>(
      'SELECT * FROM classification_override WHERE created_at >= $1 AND created_at <= $2 ORDER BY created_at DESC',
      [startDate, endDate]
    );
    return result.rows;
  }

  async create(input: CreateClassificationOverrideInput): Promise<ClassificationOverride> {
    const result = await getPool().query<ClassificationOverride>(
      `INSERT INTO classification_override (transaction_id, previous_category_id, previous_tipo, new_category_id, new_tipo, actor, reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.transactionId,
        input.previousCategoryId || null,
        input.previousTipo || null,
        input.newCategoryId,
        input.newTipo,
        input.actor,
        input.reason || null,
      ]
    );
    return result.rows[0];
  }

  async getStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    byActor: Record<string, number>;
    byCategory: Record<string, number>;
  }> {
    let query = `SELECT COUNT(*) as total FROM classification_override WHERE 1=1`;
    const params: any[] = [];
    let paramCount = 1;

    if (startDate !== undefined) {
      query += ` AND created_at >= $${paramCount++}`;
      params.push(startDate);
    }
    if (endDate !== undefined) {
      query += ` AND created_at <= $${paramCount++}`;
      params.push(endDate);
    }

    const result = await getPool().query<any>(query, params);
    return {
      total: parseInt(result.rows[0].total),
      byActor: {},
      byCategory: {},
    };
  }
}

/**
 * ReportingRepository Implementation
 */
export class PostgresReportingRepository implements IReportingRepository {
  async getCategoryTotals(
    year?: number,
    month?: number,
    accountId?: string
  ): Promise<CategoryTotalsView[]> {
    let query = 'SELECT * FROM mv_category_totals WHERE 1=1';
    const params: any[] = [];
    let paramCount = 1;

    if (year !== undefined) {
      query += ` AND year = $${paramCount++}`;
      params.push(year);
    }
    if (month !== undefined) {
      query += ` AND month = $${paramCount++}`;
      params.push(month);
    }
    if (accountId !== undefined) {
      query += ` AND account_id = $${paramCount++}`;
      params.push(accountId);
    }

    const result = await getPool().query<CategoryTotalsView>(query, params);
    return result.rows;
  }

  async getCategoryTotalsByAccount(
    accountId: string,
    year?: number
  ): Promise<CategoryTotalsView[]> {
    return this.getCategoryTotals(year, undefined, accountId);
  }

  async refreshCategoryTotals(): Promise<void> {
    await getPool().query('REFRESH MATERIALIZED VIEW CONCURRENTLY mv_category_totals');
  }

  async getSummaryStats(accountId?: string): Promise<{
    totalTransactions: number;
    totalAmount: number;
    averageAmount: number;
    byCategory: Array<{ category: string; total: number; count: number }>;
  }> {
    let query = `SELECT 
        COUNT(*) as total_transactions,
        COALESCE(SUM(amount), 0) as total_amount,
        COALESCE(AVG(amount), 0) as average_amount
       FROM transaction
       WHERE 1=1`;
    const params: any[] = [];

    if (accountId !== undefined) {
      query += ` AND account_id = $1`;
      params.push(accountId);
    }

    const result = await getPool().query<any>(query, params);
    const row = result.rows[0];
    return {
      totalTransactions: parseInt(row.total_transactions),
      totalAmount: parseFloat(row.total_amount),
      averageAmount: parseFloat(row.average_amount),
      byCategory: [],
    };
  }
}
