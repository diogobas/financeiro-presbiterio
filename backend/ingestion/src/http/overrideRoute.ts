import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ITransactionRepository } from '../domain/repositories';

interface OverrideRequest {
  transactionId: string;
  category: string;
  ruleId?: string; // optional: create rule from decision
  createRuleFromDecision?: boolean;
  note?: string;
}

export async function createOverrideRoute(server: FastifyInstance, repo: ITransactionRepository) {
  server.post('/transactions/:id/override', async (request: FastifyRequest, reply: FastifyReply) => {
    const id = (request.params as any).id as string;
    const body = request.body as unknown as OverrideRequest;

    if (!body || !body.category) {
      return reply.status(400).send({ error: 'BadRequest', message: 'Field "category" is required' });
    }

    // Persist override via repository (expected API: applyOverride)
    try {
      const result = await repo.applyOverride(id, {
        category: body.category,
        ruleId: body.ruleId,
        createdBy: (request as any).user?.id || 'system',
        note: body.note,
      });

      reply.status(200).send(result);
    } catch (err) {
      reply.status(500).send({ error: 'InternalError', message: String(err) });
    }
  });
}

export default createOverrideRoute;
