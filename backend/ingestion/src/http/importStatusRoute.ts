/**
 * GET /imports/{id} - Get import status and summary
 * Returns ImportBatch metadata and classification statistics
 */

import { FastifyRequest, FastifyReply } from 'fastify';
import { ImportBatchRepository } from '../domain/importBatchRepository';
import { TransactionRepository } from '../domain/transactionRepository';

const importBatchRepo = new ImportBatchRepository();
const transactionRepo = new TransactionRepository();

/**
 * GET /imports/{id} handler
 * Returns import batch metadata and transaction classification statistics
 */
export async function getImportStatusHandler(
  request: FastifyRequest<{
    Params: {
      id: string;
    };
  }>,
  reply: FastifyReply
): Promise<void> {
  try {
    const { id } = request.params;

    // Fetch batch
    const batch = await importBatchRepo.findById(id);

    if (!batch) {
      reply.code(404).send({
        error: 'NOT_FOUND',
        message: `Import batch ${id} not found`,
      });
      return;
    }

    // Get classification statistics
    const stats = await transactionRepo.getClassificationStats(batch.id);

    // Return batch with statistics
    reply.code(200).send({
      id: batch.id,
      accountId: batch.accountId,
      uploadedBy: batch.uploadedBy,
      uploadedAt: batch.uploadedAt,
      fileChecksum: batch.fileChecksum,
      periodMonth: batch.periodMonth,
      periodYear: batch.periodYear,
      encoding: batch.encoding,
      rowCount: batch.rowCount,
      status: batch.rowCount > 0 ? 'COMPLETED' : 'EMPTY',
      classification: {
        classified: stats.classified,
        unclassified: stats.unclassified,
        total: stats.classified + stats.unclassified,
        percentClassified:
          stats.classified + stats.unclassified > 0
            ? Math.round((stats.classified / (stats.classified + stats.unclassified)) * 100)
            : 0,
      },
    });
  } catch (err) {
    console.error('Error in GET /imports/{id}:', err);
    reply.code(500).send({
      error: 'INTERNAL_SERVER_ERROR',
      message: err instanceof Error ? err.message : 'Unknown error',
    });
  }
}

/**
 * Export handler for registration
 */
export default {
  method: 'GET' as const,
  url: '/imports/:id',
  handler: getImportStatusHandler,
};
