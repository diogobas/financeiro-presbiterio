/**
 * AccountRepository - PostgreSQL implementation
 * Handles all database operations for Account entities
 */

import { query } from '../config/db';
import { Account, CreateAccountInput, AccountStatus } from './types';
import { IAccountRepository } from './repositories';

/**
 * Convert database row to Account domain model
 */
function mapRowToAccount(row: any): Account {
  return {
    id: row.id,
    name: row.name,
    bankName: row.bank_name,
    status: row.status as AccountStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export class AccountRepository implements IAccountRepository {
  /**
   * Find account by ID
   */
  async findById(id: string): Promise<Account | null> {
    const result = await query('SELECT * FROM account WHERE id = $1', [id]);
    return result.length > 0 ? mapRowToAccount(result[0]) : null;
  }

  /**
   * Find all accounts, optionally filtered by status
   */
  async findAll(status?: AccountStatus): Promise<Account[]> {
    let sql = 'SELECT * FROM account';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }

    sql += ' ORDER BY created_at DESC';
    const result = await query(sql, params);
    return result.map(mapRowToAccount);
  }

  /**
   * Create a new account
   */
  async create(input: CreateAccountInput): Promise<Account> {
    const status = input.status || 'ACTIVE';
    const result = await query(
      `INSERT INTO account (name, bank_name, status, created_at, updated_at)
       VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       RETURNING *`,
      [input.name, input.bankName || null, status]
    );
    return mapRowToAccount(result[0]);
  }

  /**
   * Update an existing account
   */
  async update(id: string, updates: Partial<CreateAccountInput>): Promise<Account> {
    const setClauses: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      setClauses.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }

    if (updates.bankName !== undefined) {
      setClauses.push(`bank_name = $${paramIndex++}`);
      values.push(updates.bankName || null);
    }

    if (updates.status !== undefined) {
      setClauses.push(`status = $${paramIndex++}`);
      values.push(updates.status);
    }

    if (setClauses.length === 0) {
      // No updates, just return current
      return this.findById(id) as Promise<Account>;
    }

    setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const sql = `UPDATE account SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`;
    const result = await query(sql, values);

    if (result.length === 0) {
      throw new Error(`Account with id ${id} not found`);
    }

    return mapRowToAccount(result[0]);
  }

  /**
   * Delete (soft delete by archiving) an account
   */
  async delete(id: string): Promise<void> {
    const result = await query(
      'UPDATE account SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['ARCHIVED', id]
    );

    if (result.length === 0) {
      throw new Error(`Account with id ${id} not found`);
    }
  }

  /**
   * Count accounts with optional status filter
   */
  async count(status?: AccountStatus): Promise<number> {
    let sql = 'SELECT COUNT(*) as count FROM account';
    const params: any[] = [];

    if (status) {
      sql += ' WHERE status = $1';
      params.push(status);
    }

    const result = await query(sql, params);
    return parseInt(result[0].count, 10);
  }
}
