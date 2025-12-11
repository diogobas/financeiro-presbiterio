/**
 * POST /imports - Upload monthly CSV and map to account
 * Handles multipart form data with file upload
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { createHash } from 'crypto';
import { Readable } from 'stream';
import { AccountRepository } from '../domain/accountRepository';
import { ImportBatchRepository } from '../domain/importBatchRepository';
import { TransactionRepository } from '../domain/transactionRepository';
import { ImportService } from './importService';
import { CSVParser } from './csvParser';

const accountRepo = new AccountRepository();
const importBatchRepo = new ImportBatchRepository();
const transactionRepo = new TransactionRepository();
const importService = new ImportService(importBatchRepo, transactionRepo);
const csvParser = new CSVParser();

/**
 * Calculate SHA256 checksum of file content
 */
function calculateChecksum(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

/**
 * POST /imports handler
 * Request: multipart/form-data with file, accountId, periodMonth, periodYear
 * Response: 202 Accepted with ImportBatch metadata
 */
export async function uploadImportsHandler(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  try {
    // Parse multipart data
    const data = await request.file();

    if (!data) {
      reply.code(400).send({
        error: 'MISSING_FILE',
        message: 'File is required',
      });
      return;
    }

    // Get form fields
    const { accountId, periodMonth, periodYear } = request.body as any;

    // Validation
    if (!accountId || !periodMonth || !periodYear) {
      reply.code(400).send({
        error: 'MISSING_FIELDS',
        message: 'accountId, periodMonth, and periodYear are required',
      });
      return;
    }

    const month = parseInt(periodMonth, 10);
    const year = parseInt(periodYear, 10);

    if (month < 1 || month > 12) {
      reply.code(400).send({
        error: 'INVALID_PERIOD',
        message: 'periodMonth must be 1-12',
      });
      return;
    }

    if (year < 2000 || year > 2100) {
      reply.code(400).send({
        error: 'INVALID_PERIOD',
        message: 'periodYear must be between 2000 and 2100',
      });
      return;
    }

    // Verify account exists
    const account = await accountRepo.findById(accountId);
    if (!account) {
      reply.code(404).send({
        error: 'ACCOUNT_NOT_FOUND',
        message: `Account ${accountId} not found`,
      });
      return;
    }

    // Read file content into buffer
    const fileBuffer = await data.toBuffer();
    const fileChecksum = calculateChecksum(fileBuffer);

    // Check for duplicate import
    const existingBatch = await importBatchRepo.findByChecksum(
      accountId,
      fileChecksum,
      month,
      year
    );

    if (existingBatch) {
      reply.code(409).send({
        error: 'DUPLICATE_IMPORT',
        message: 'This file has already been imported for this account and period',
        batchId: existingBatch.id,
        uploadedAt: existingBatch.uploadedAt,
      });
      return;
    }

    // Detect encoding (UTF8 or LATIN1)
    const encoding = detectEncoding(fileBuffer);

    // Decode file content
    const fileContent = fileBuffer.toString(encoding.toLowerCase() === 'utf8' ? 'utf8' : 'latin1');
    const lines = fileContent.split('\n');

    // Create import batch record
    const uploadedBy = (request.user as any)?.sub || 'anonymous';
    const batch = await importBatchRepo.create({
      accountId,
      uploadedBy,
      fileChecksum,
      periodMonth: month,
      periodYear: year,
      encoding: encoding as 'UTF8' | 'LATIN1',
      rowCount: 0,
    });

    // Parse CSV and create transactions (asynchronously)
    // For MVP, we'll do this synchronously but you could make it async with a job queue
    let rowCount = 0;
    const transactions: any[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const row = csvParser.parseCSVRow(line);
        transactions.push({
          accountId,
          batchId: batch.id,
          date: row.date,
          documento: row.documento,
          amount: row.amount,
          classificationSource: 'NONE',
        });
        rowCount++;
      } catch (err) {
        // Log parsing errors but continue with next row
        console.warn(
          `Error parsing row ${i}: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }

    // Insert transactions
    if (transactions.length > 0) {
      await transactionRepo.createMany(transactions);
    }

    // Update batch row count
    await importBatchRepo.updateRowCount(batch.id, rowCount);

    // Return 202 Accepted with batch metadata
    reply.code(202).send({
      id: batch.id,
      accountId: batch.accountId,
      uploadedBy: batch.uploadedBy,
      uploadedAt: batch.uploadedAt,
      fileChecksum: batch.fileChecksum,
      periodMonth: batch.periodMonth,
      periodYear: batch.periodYear,
      encoding: batch.encoding,
      rowCount: rowCount,
      status: 'ACCEPTED',
      message: `Import ${rowCount} transactions from CSV file`,
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
