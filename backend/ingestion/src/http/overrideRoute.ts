import { FastifyInstance, FastifyRequest } from 'fastify';
import {
  PostgresTransactionRepository,
  PostgresClassificationOverrideRepository,
} from '../infrastructure/repositories';
import { CreateClassificationOverrideInput, TransactionType } from '../domain/types';
import { UserContext } from '../middleware/auth.types';

interface OverrideRequestParams {
  id: string;
}

interface OverrideRequestBody {
  newCategoryId: string;
  newTipo: TransactionType;
  reason?: string;
}

interface AuthenticatedRequest extends FastifyRequest<{
  Params: OverrideRequestParams;
  Body: OverrideRequestBody;
}> {
  user?: UserContext;
}

export async function registerOverrideRoutes(server: FastifyInstance): Promise<void> {
  const transactionRepo = new PostgresTransactionRepository();
  const overrideRepo = new PostgresClassificationOverrideRepository();

  // POST /transactions/:id/override
  server.post<{ Params: OverrideRequestParams; Body: OverrideRequestBody }>(
    '/transactions/:id/override',
    async (request: AuthenticatedRequest, reply) => {
      const { id } = request.params;
      const body = request.body;

      if (!body.newCategoryId || !body.newTipo) {
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
        actor: request.user?.userId || 'system',
        reason: body.reason,
      };

      // Create override and update transaction using repository method
      const override = await overrideRepo.createWithTransactionUpdate(input);

      return reply.status(200).send({ override });
    }
  );
}
