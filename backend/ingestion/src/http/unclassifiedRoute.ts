import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { PostgresTransactionRepository } from '../infrastructure/repositories';

interface UnclassifiedQuery {
  accountId: string;
  page?: string;
  limit?: string;
}

export async function registerUnclassifiedRoutes(server: FastifyInstance): Promise<void> {
  const transactionRepo = new PostgresTransactionRepository();

  // GET /transactions/unclassified?accountId=&page=&limit=
  server.get(
    '/transactions/unclassified',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['accountId'],
          properties: {
            accountId: { type: 'string' },
            page: { type: 'string', pattern: '^[0-9]+$' },
            limit: { type: 'string', pattern: '^[0-9]+$' },
          },
        },
      },
    },
    async (request: FastifyRequest<{ Querystring: UnclassifiedQuery }>, reply: FastifyReply) => {
      const { accountId, page, limit } = request.query;
      const pageNum = Math.max(parseInt(page ?? '1', 10) || 1, 1);
      const limitNum = Math.min(Math.max(parseInt(limit ?? '50', 10) || 50, 1), 100);
      const offset = (pageNum - 1) * limitNum;

      if (!accountId) {
        return reply.status(400).send({ error: 'BadRequest', message: 'accountId is required' });
      }

      const result = await transactionRepo.findUnclassified(accountId, limitNum, offset);
      return reply
        .status(200)
        .send({ data: result.transactions, total: result.total, page: pageNum, limit: limitNum });
    }
  );
}
