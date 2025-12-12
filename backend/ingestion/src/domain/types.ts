/**
 * Domain Models for Bank CSV Reporting System
 * These interfaces match the PostgreSQL schema exactly
 */

/**
 * Account Status enumeration
 * Maps to PostgreSQL account_status enum
 */
export type AccountStatus = 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';

/**
 * Transaction Type enumeration
 * Maps to PostgreSQL transaction_type enum
 */
export type TransactionType = 'RECEITA' | 'DESPESA';

/**
 * Classification Source enumeration
 * Maps to PostgreSQL classification_source enum
 */
export type ClassificationSource = 'RULE' | 'OVERRIDE' | 'NONE';

/**
 * Matcher Type enumeration for classification rules
 * Maps to PostgreSQL matcher_type enum
 */
export type MatcherType = 'CONTAINS' | 'REGEX';

/**
 * Encoding Type enumeration for CSV files
 * Maps to PostgreSQL encoding_type enum
 */
export type EncodingType = 'UTF8' | 'LATIN1';

/**
 * Bank Account entity
 * Represents a bank account that users upload CSV data for
 */
export interface Account {
  id: string;
  name: string;
  bankName?: string;
  accountNumber?: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Account creation input (without id, timestamps)
 */
export interface CreateAccountInput {
  name: string;
  bankName?: string;
  accountNumber?: string;
  status?: AccountStatus;
}

/**
 * Category entity
 * Represents transaction categories for classification
 */
export interface Category {
  id: string;
  name: string;
  tipo: TransactionType;
  createdAt: Date;
}

/**
 * Category creation input
 */
export interface CreateCategoryInput {
  name: string;
  tipo: TransactionType;
}

/**
 * ImportBatch entity
 * Metadata for each CSV file import
 */
export interface ImportBatch {
  id: string;
  accountId: string;
  uploadedBy: string;
  uploadedAt: Date;
  fileChecksum: string;
  periodMonth: number;
  periodYear: number;
  encoding: EncodingType;
  rowCount: number;
}

/**
 * ImportBatch creation input
 */
export interface CreateImportBatchInput {
  accountId: string;
  uploadedBy: string;
  fileChecksum: string;
  periodMonth: number;
  periodYear: number;
  encoding?: EncodingType;
  rowCount?: number;
}

/**
 * Transaction entity
 * Represents imported bank transactions
 */
export interface Transaction {
  id: string;
  accountId: string;
  batchId: string;
  date: Date;
  documento: string;
  documentoNormalized: string;
  amount: number;
  currency: string;
  categoryId?: string;
  tipo?: TransactionType;
  classificationSource: ClassificationSource;
  ruleId?: string;
  ruleVersion?: number;
  rationale?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Transaction creation input
 */
export interface CreateTransactionInput {
  accountId: string;
  batchId: string;
  date: Date;
  documento: string;
  amount: number;
  currency?: string;
  categoryId?: string;
  tipo?: TransactionType;
  classificationSource?: ClassificationSource;
  ruleId?: string;
  ruleVersion?: number;
  rationale?: string;
}

/**
 * Rule entity
 * Automatic classification rules for transaction categorization
 */
export interface Rule {
  id: string;
  name: string;
  description?: string;
  categoryId?: string;
  category?: string;
  tipo?: TransactionType;
  pattern: string;
  matchType: MatcherType;
  version: number;
  priority: number;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy?: string;
}

/**
 * Rule creation input (without id, version, timestamps)
 */
export interface CreateRuleInput {
  name: string;
  description?: string;
  category?: string;
  tipo?: TransactionType;
  pattern: string;
  matchType: MatcherType;
  priority?: number;
  enabled?: boolean;
  createdBy?: string;
}

/**
 * Rule update input (partial)
 */
export interface UpdateRuleInput {
  name?: string;
  description?: string;
  category?: string;
  tipo?: TransactionType;
  pattern?: string;
  matchType?: MatcherType;
  priority?: number;
  enabled?: boolean;
}

/**
 * ClassificationOverride entity
 * Audit trail for manual classification changes
 */
export interface ClassificationOverride {
  id: string;
  transactionId: string;
  previousCategoryId?: string;
  previousTipo?: TransactionType;
  newCategoryId: string;
  newTipo: TransactionType;
  actor: string;
  reason?: string;
  createdAt: Date;
}

/**
 * ClassificationOverride creation input
 */
export interface CreateClassificationOverrideInput {
  transactionId: string;
  previousCategoryId?: string;
  previousTipo?: TransactionType;
  newCategoryId: string;
  newTipo: TransactionType;
  actor: string;
  reason?: string;
}

/**
 * Materialized View for reporting
 * Aggregated transaction totals by category, month, account
 */
export interface CategoryTotalsView {
  year: number;
  month: number;
  accountId: string;
  categoryId?: string;
  tipo?: TransactionType;
  totalAmount: number;
  rowCount: number;
}
