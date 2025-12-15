import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PostgresTransactionRepository } from '../infrastructure/repositories';
import { CreateClassificationOverrideInput } from '../domain/types';

export async function registerOverrideRoutes(server: FastifyInstance): Promise<void> {
  const transactionRepo = new PostgresTransactionRepository();

  // GET /transactions/unclassified?accountId=&page=&limit=
  // POST /transactions/:id/override
  server.post(
    '/transactions/:id/override',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const params = request.params as { id?: string };
      const { id } = params;
      const body = request.body as
        | { newCategoryId?: string; newTipo?: string; reason?: string }
        | undefined;

      if (!id)
        return reply.status(400).send({ error: 'BadRequest', message: 'Transaction id required' });
      if (!body || !body.newCategoryId || !body.newTipo) {
        return reply
          .status(400)
          .send({ error: 'BadRequest', message: 'newCategoryId and newTipo are required' });
      }

      // Get existing transaction
      const tx = await transactionRepo.findById(id);
      if (!tx)
        return reply.status(404).send({ error: 'NotFound', message: 'Transaction not found' });

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
    }
  );
}
