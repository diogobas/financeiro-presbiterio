/**
 * POST /imports - Upload monthly CSV and map to account
 * Handles multipart form data with file upload
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { PostgresAccountRepository } from '../infrastructure/repositories';
import { PostgresImportBatchRepository } from '../infrastructure/repositories';
import { PostgresTransactionRepository } from '../infrastructure/repositories';
import { extractAccountSections } from '../ingest/csvParser';

const accountRepo = new PostgresAccountRepository();
const importBatchRepo = new PostgresImportBatchRepository();
const transactionRepo = new PostgresTransactionRepository();

/**
 * Calculate SHA256 checksum of file content
 */
function calculateChecksum(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * Detect period (month/year) from account section transactions
 * Returns the most common month/year in the transactions
 */
function detectPeriodFromTransactions(section: any): { month: number; year: number } {
  if (!section.transactions || section.transactions.length === 0) {
    // Fallback to current month/year
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  // Count occurrences of each month/year combination
  const periodCounts: { [key: string]: number } = {};

  for (const transaction of section.transactions) {
    if (transaction.date) {
      const month = transaction.date.getMonth() + 1;
      const year = transaction.date.getFullYear();
      const key = `${year}-${month}`;
      periodCounts[key] = (periodCounts[key] || 0) + 1;
    }
  }

  // Find the most common month/year
  let maxCount = 0;
  let mostCommonPeriod = { month: new Date().getMonth() + 1, year: new Date().getFullYear() };

  for (const [key, count] of Object.entries(periodCounts)) {
    if (count > maxCount) {
      maxCount = count;
      const [year, month] = key.split('-').map(Number);
      mostCommonPeriod = { month, year };
    }
  }

  return mostCommonPeriod;
}

/**
 * POST /imports handler
 * Request: multipart/form-data with file
 * Response: 202 Accepted with array of ImportBatch metadata (one per account)
 */
export async function uploadImportsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Extract file from multipart data
    let fileBuffer: Buffer | undefined;

    // Iterate through all parts of the multipart form
    const parts = request.parts();
    for await (const part of parts) {
      if (part.type === 'file') {
        // This is the file field
        fileBuffer = await part.toBuffer();
      }
    }

    // Validate required fields
    if (!fileBuffer) {
      reply.code(400).send({
        error: 'MISSING_FILE',
        message: 'File is required',
      });
      return;
    }

    // Calculate file checksum
    const fileChecksum = calculateChecksum(fileBuffer);

    // Detect encoding (UTF8 or LATIN1)
    const encoding = detectEncoding(fileBuffer);

    // Decode file content
    const fileContent = fileBuffer.toString(encoding.toLowerCase() === 'utf8' ? 'utf8' : 'latin1');

    // Extract account sections from CSV
    const accountSections = extractAccountSections(fileContent);

    if (accountSections.length === 0) {
      reply.code(400).send({
        error: 'NO_ACCOUNTS_FOUND',
        message:
          'CSV file contains no account sections. Expected "Conta: [account-number]" headers.',
      });
      return;
    }

    // Process each account
    const uploadedBy = (request.user as any)?.sub || 'anonymous';
    const results = [];

    for (const section of accountSections) {
      const accountNumber = section.accountNumber;

      // Auto-detect period from transaction dates
      const { month, year } = detectPeriodFromTransactions(section);

      // Get or create account
      let account = await accountRepo.findByAccountNumber(accountNumber);
      if (!account) {
        account = await accountRepo.create({
          accountNumber,
          name: `Conta ${accountNumber}`,
        });
      }

      // Check for duplicate import (same file, same account, same period)
      const existingBatch = await importBatchRepo.findByChecksum(
        account.id,
        fileChecksum,
        month,
        year
      );

      if (existingBatch) {
        results.push({
          accountNumber,
          accountId: account.id,
          status: 'DUPLICATE',
          batchId: existingBatch.id,
          message: `File already imported for this account (${accountNumber}) and period (${month}/${year})`,
          uploadedAt: existingBatch.uploadedAt,
        });
        continue;
      }

      // Create import batch record
      const batch = await importBatchRepo.create({
        accountId: account.id,
        uploadedBy,
        fileChecksum,
        periodMonth: month,
        periodYear: year,
        encoding: encoding as 'UTF8' | 'LATIN1',
        rowCount: 0,
      });

      // Create transaction records
      const transactions = section.transactions.map((row) => ({
        accountId: account.id,
        batchId: batch.id,
        date: row.date,
        documento: row.documento,
        amount: row.amount,
        classificationSource: 'NONE' as const,
      }));

      if (transactions.length > 0) {
        await transactionRepo.createMany(transactions);
      }

      // Update batch row count
      await importBatchRepo.updateRowCount(batch.id, transactions.length);

      results.push({
        accountNumber,
        accountId: account.id,
        id: batch.id,
        uploadedBy: batch.uploadedBy,
        uploadedAt: batch.uploadedAt,
        fileChecksum: batch.fileChecksum,
        periodMonth: batch.periodMonth,
        periodYear: batch.periodYear,
        encoding: batch.encoding,
        rowCount: transactions.length,
        status: 'ACCEPTED',
        message: `Imported ${transactions.length} transactions`,
      });
    }

    // Return 202 Accepted with results for all accounts
    reply.code(202).send({
      total: results.length,
      results,
      message: `Processed ${results.length} account(s)`,
    });
  } catch (err) {
    console.error('Error in POST /imports:', err);
    reply.code(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Simple encoding detection: check for UTF8 BOM or high-bit characters
 */
function detectEncoding(buffer: Buffer): 'UTF8' | 'LATIN1' {
  // Check for UTF8 BOM
  if (buffer.length >= 3 && buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
    return 'UTF8';
  }

  // Try UTF8 decoding - if it fails with replacement chars, it's likely LATIN1
  const utf8String = buffer.toString('utf8');
  const latinString = buffer.toString('latin1');

  // Simple heuristic: count non-ASCII chars that decode differently
  let differences = 0;
  for (let i = 0; i < Math.min(1000, utf8String.length); i++) {
    if (utf8String[i] !== latinString[i]) {
      differences++;
    }
  }

  // If more than 5% of chars are different, likely LATIN1
  return differences > utf8String.length * 0.05 ? 'LATIN1' : 'UTF8';
}

/**
 * Export handler for registration
 */
export default {
  method: 'POST' as const,
  url: '/imports',
  handler: uploadImportsHandler,
};
