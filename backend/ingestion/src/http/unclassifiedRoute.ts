import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PostgresTransactionRepository } from '../infrastructure/repositories';

export async function registerUnclassifiedRoutes(server: FastifyInstance): Promise<void> {
  const transactionRepo = new PostgresTransactionRepository();

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
}




