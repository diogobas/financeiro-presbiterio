import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import {
  PostgresTransactionRepository,
  PostgresClassificationOverrideRepository,
} from '../infrastructure/repositories';
import { CreateClassificationOverrideInput } from '../domain/types';

export async function registerOverrideRoutes(server: FastifyInstance): Promise<void> {
  const transactionRepo = new PostgresTransactionRepository();
  const overrideRepo = new PostgresClassificationOverrideRepository();

  // GET /transactions/unclassified?accountId=&page=&limit=
  server.get('/transactions/unclassified', async (request: FastifyRequest, reply: FastifyReply) => {
    const q = request.query as any;
    const accountId = q.accountId as string;
    const page = Math.max(parseInt(q.page as string, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(q.limit as string, 10) || 50, 1), 100);
    const offset = (page - 1) * limit;

    if (!accountId) {
      return reply.status(400).send({ error: 'BadRequest', message: 'accountId is required' });
    }

    const result = await transactionRepo.findUnclassified(accountId, limit, offset);
    return reply.status(200).send({ data: result.transactions, total: result.total, page, limit });
  });

  // POST /transactions/:id/override
  server.post('/transactions/:id/override', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as any;
    const body = request.body as any;

    if (!id) return reply.status(400).send({ error: 'BadRequest', message: 'Transaction id required' });
    if (!body || !body.newCategoryId || !body.newTipo) {
      return reply.status(400).send({ error: 'BadRequest', message: 'newCategoryId and newTipo are required' });
    }

    // Get existing transaction
    const tx = await transactionRepo.findById(id);
    if (!tx) return reply.status(404).send({ error: 'NotFound', message: 'Transaction not found' });

    // Build override input
    const input: CreateClassificationOverrideInput = {
      transactionId: id,
      previousCategoryId: tx.categoryId,
      previousTipo: tx.tipo,
      newCategoryId: body.newCategoryId,
      newTipo: body.newTipo,
      actor: (request as any).user?.id || 'system',
      reason: body.reason || null,
    };

    // Create override and update transaction inside a DB transaction
    const pool = (await import('../config/db')).getPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Insert override
      const overrideRow = await client.query(
        `INSERT INTO classification_override (transaction_id, previous_category_id, previous_tipo, new_category_id, new_tipo, actor, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
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

      // Update transaction classification
      await client.query(
        `UPDATE transaction SET category_id = $1, tipo = $2, classification_source = 'OVERRIDE', rule_id = NULL, rationale = $3, updated_at = NOW() WHERE id = $4`,
        [input.newCategoryId, input.newTipo, input.reason || null, id]
      );

      await client.query('COMMIT');

      return reply.status(200).send({ override: overrideRow.rows[0] });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  });
}
