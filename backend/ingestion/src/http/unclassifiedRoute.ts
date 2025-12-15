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
import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { ITransactionRepository } from '../domain/repositories';

interface ListUnclassifiedQuery {
  page?: string | number;
  limit?: string | number;
}

export async function createUnclassifiedRoute(server: FastifyInstance, repo: ITransactionRepository) {
  server.get('/transactions/unclassified', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as unknown as ListUnclassifiedQuery;
    const page = parseInt(String(query.page || '1'), 10) || 1;
    const limit = Math.min(Math.max(parseInt(String(query.limit || '20'), 10) || 20, 1), 100);

    const offset = (page - 1) * limit;

    // Repository is expected to provide a method to list unclassified transactions with pagination
    const result = await repo.findUnclassified({ limit, offset });

    reply.header('X-Total-Count', String(result.total)).send({
      data: result.transactions,
      total: result.total,
      page,
      limit,
      hasMore: page * limit < result.total,
    });
  });
}

export default createUnclassifiedRoute;
