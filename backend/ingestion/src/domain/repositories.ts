/**
 * Repository interfaces for data access
 * These define the contract for database operations
 */

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
} from './types';

/**
 * AccountRepository - Data access for Account entities
 */
export interface IAccountRepository {
  /**
   * Find account by ID
   */
  findById(id: string): Promise<Account | null>;

  /**
   * Find all accounts for a user/organization
   */
  findAll(status?: AccountStatus): Promise<Account[]>;

  /**
   * Create a new account
   */
  create(input: CreateAccountInput): Promise<Account>;

  /**
   * Update existing account
   */
  update(id: string, updates: Partial<CreateAccountInput>): Promise<Account>;

  /**
   * Delete (archive) account
   */
  delete(id: string): Promise<void>;

  /**
   * Count accounts with specific status
   */
  count(status?: AccountStatus): Promise<number>;
}

/**
 * CategoryRepository - Data access for Category entities
 */
export interface ICategoryRepository {
  /**
   * Find category by ID
   */
  findById(id: string): Promise<Category | null>;

  /**
   * Find category by name
   */
  findByName(name: string): Promise<Category | null>;

  /**
   * Find all categories
   */
  findAll(): Promise<Category[]>;

  /**
   * Find categories by type (RECEITA or DESPESA)
   */
  findByType(tipo: 'RECEITA' | 'DESPESA'): Promise<Category[]>;

  /**
   * Create a new category
   */
  create(input: CreateCategoryInput): Promise<Category>;

  /**
   * Update existing category
   */
  update(id: string, updates: Partial<CreateCategoryInput>): Promise<Category>;

  /**
   * Delete category
   */
  delete(id: string): Promise<void>;

  /**
   * Count all categories
   */
  count(): Promise<number>;
}

/**
 * ImportBatchRepository - Data access for ImportBatch entities
 */
export interface IImportBatchRepository {
  /**
   * Find batch by ID
   */
  findById(id: string): Promise<ImportBatch | null>;

  /**
   * Find batch by checksum with account and period (duplicate detection)
   */
  findByChecksum(
    accountId: string,
    fileChecksum: string,
    periodMonth: number,
    periodYear: number
  ): Promise<ImportBatch | null>;

  /**
   * Find all batches for an account
   */
  findByAccountId(
    accountId: string,
    periodMonth?: number,
    periodYear?: number
  ): Promise<ImportBatch[]>;

  /**
   * Find batches by account (paginated)
   */
  findAllByAccountId(
    accountId: string,
    limit?: number,
    offset?: number
  ): Promise<{ batches: ImportBatch[]; total: number }>;

  /**
   * Create a new batch
   */
  create(input: CreateImportBatchInput): Promise<ImportBatch>;

  /**
   * Update row count after import
   */
  updateRowCount(id: string, rowCount: number): Promise<ImportBatch>;

  /**
   * Get batch statistics
   */
  getStats?(accountId: string): Promise<{
    totalBatches: number;
    totalTransactions: number;
    dateRange: { from: Date; to: Date };
  }>;
}

/**
 * TransactionRepository - Data access for Transaction entities
 */
export interface ITransactionRepository {
  /**
   * Find transaction by ID
   */
  findById(id: string): Promise<Transaction | null>;

  /**
   * Find all transactions in a batch
   */
  findByBatchId(batchId: string): Promise<Transaction[]>;

  /**
   * Find transactions by batch and classification status
   */
  findByBatchAndStatus(
    batchId: string,
    status: 'classified' | 'unclassified'
  ): Promise<Transaction[]>;

  /**
   * Find unclassified transactions for an account (paginated)
   */
  findUnclassified(
    accountId: string,
    limit?: number,
    offset?: number
  ): Promise<{ transactions: Transaction[]; total: number }>;

  /**
   * Find transactions by account (paginated)
   */
  findByAccountId(
    accountId: string,
    limit?: number,
    offset?: number
  ): Promise<{ transactions: Transaction[]; total: number }>;

  /**
   * Create a new transaction
   */
  create(input: CreateTransactionInput): Promise<Transaction>;

  /**
   * Create multiple transactions (batch insert)
   */
  createMany(inputs: CreateTransactionInput[]): Promise<Transaction[]>;

  /**
   * Update transaction classification
   */
  update(
    id: string,
    updates: Partial<{
      categoryId: string;
      tipo: 'RECEITA' | 'DESPESA';
      classificationSource: ClassificationSource;
      ruleId: string;
      ruleVersion: number;
      rationale: string;
    }>
  ): Promise<Transaction>;

  /**
   * Count transactions in a batch
   */
  countByBatchId(batchId: string): Promise<number>;

  /**
   * Get classification stats for a batch
   */
  getClassificationStats(batchId: string): Promise<{
    classified: number;
    unclassified: number;
  }>;
}

/**
 * RuleRepository - Data access for Rule entities
 */
export interface IRuleRepository {
  /**
   * Find rule by ID
   */
  findById(id: string): Promise<Rule | null>;

  /**
   * Find all active rules
   */
  findActive(): Promise<Rule[]>;

  /**
   * Find rules for a specific category
   */
  findByCategory(categoryId: string): Promise<Rule[]>;

  /**
   * Find rules by type (RECEITA or DESPESA)
   */
  findByType(tipo: 'RECEITA' | 'DESPESA'): Promise<Rule[]>;

  /**
   * Create a new rule
   */
  create(input: CreateRuleInput): Promise<Rule>;

  /**
   * Update rule (increments version)
   */
  update(id: string, updates: Partial<Omit<CreateRuleInput, 'createdBy'>>): Promise<Rule>;

  /**
   * Deactivate rule (soft delete)
   */
  deactivate(id: string): Promise<void>;

  /**
   * Count active rules
   */
  countActive(): Promise<number>;
}

/**
 * ClassificationOverrideRepository - Data access for ClassificationOverride entities
 */
export interface IClassificationOverrideRepository {
  /**
   * Find override by ID
   */
  findById(id: string): Promise<ClassificationOverride | null>;

  /**
   * Find override for a transaction
   */
  findByTransaction(transactionId: string): Promise<ClassificationOverride | null>;

  /**
   * Find all overrides by actor (user)
   */
  findByActor(actor: string): Promise<ClassificationOverride[]>;

  /**
   * Find overrides in date range
   */
  findByDateRange(startDate: Date, endDate: Date): Promise<ClassificationOverride[]>;

  /**
   * Create a new override
   */
  create(input: CreateClassificationOverrideInput): Promise<ClassificationOverride>;

  /**
   * Get override statistics
   */
  getStats(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    byActor: Record<string, number>;
    byCategory: Record<string, number>;
  }>;
}

/**
 * ReportingRepository - Data access for materialized views
 */
export interface IReportingRepository {
  /**
   * Get category totals for reporting
   */
  getCategoryTotals(
    year?: number,
    month?: number,
    accountId?: string
  ): Promise<CategoryTotalsView[]>;

  /**
   * Get category totals for a specific account
   */
  getCategoryTotalsByAccount(accountId: string, year?: number): Promise<CategoryTotalsView[]>;

  /**
   * Refresh materialized view
   * Should be called after significant data imports
   */
  refreshCategoryTotals(): Promise<void>;

  /**
   * Get summary statistics
   */
  getSummaryStats(accountId?: string): Promise<{
    totalTransactions: number;
    totalAmount: number;
    averageAmount: number;
    byCategory: Array<{ category: string; total: number; count: number }>;
  }>;
}
