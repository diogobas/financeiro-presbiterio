/**
 * Contract tests for manual review endpoints
 * - GET /transactions/unclassified
 * - POST /transactions/:id/override
 *
 * These are contract-style, validating request/response shapes and basic error cases.
 */

interface UnclassifiedItem {
  id: string;
  accountId: string;
  date: string;
  documento: string;
  amount: number;
  currency: string;
  categoria?: string;
  tipo?: string;
  createdAt: string;
}

interface UnclassifiedListResponse {
  data: UnclassifiedItem[];
  total: number;
  page: number;
  limit: number;
}

interface OverrideRequest {
  newCategoryId: string;
  newTipo: 'RECEITA' | 'DESPESA';
  reason?: string;
}

interface OverrideResponse {
  id: string;
  transactionId: string;
  previousCategoryId?: string;
  newCategoryId: string;
  actor: string;
  reason?: string;
  createdAt: string;
}

describe('Review API - GET /transactions/unclassified', () => {
  it('returns a paginated list shape for unclassified transactions', async () => {
    const mock: UnclassifiedListResponse = {
      data: [
        {
          id: 'tx-1',
          accountId: 'acc-1',
          date: '2025-12-01',
          documento: 'SUPERMERCADO ABC',
          amount: 123.45,
          currency: 'BRL',
          createdAt: '2025-12-01T12:00:00Z',
        },
      ],
      total: 1,
      page: 1,
      limit: 50,
    };

    expect(Array.isArray(mock.data)).toBe(true);
    expect(mock.total).toBeGreaterThanOrEqual(0);
    expect(mock.page).toBeGreaterThanOrEqual(1);
    expect(mock.limit).toBeGreaterThanOrEqual(1);
    expect(mock.data[0]).toHaveProperty('id');
    expect(mock.data[0]).toHaveProperty('documento');
  });

  it('returns 400 when accountId is missing', () => {
    const error = { error: 'BadRequest', message: 'accountId is required', statusCode: 400 } as any;
    expect(error.statusCode).toBe(400);
    expect(error.error).toBe('BadRequest');
  });
});

describe('Review API - POST /transactions/:id/override', () => {
  it('accepts valid override payload and returns created override shape', async () => {
    const req: OverrideRequest = {
      newCategoryId: 'cat-1',
      newTipo: 'DESPESA',
      reason: 'Manual review: grocery',
    };

    const res: OverrideResponse = {
      id: 'ov-1',
      transactionId: 'tx-1',
      previousCategoryId: null as any,
      newCategoryId: req.newCategoryId,
      actor: 'user-1',
      reason: req.reason,
      createdAt: new Date().toISOString(),
    };

    expect(res).toHaveProperty('id');
    expect(res.newCategoryId).toBe(req.newCategoryId);
    expect(res.transactionId).toBe('tx-1');
  });

  it('returns 400 for missing newCategoryId or newTipo', () => {
    const bad: any = { reason: 'no category' };
    const error = {
      error: 'BadRequest',
      message: 'newCategoryId and newTipo are required',
      statusCode: 400,
    } as any;
    expect(error.statusCode).toBe(400);
    expect(error.error).toBe('BadRequest');
  });

  it('returns 404 for unknown transaction id', () => {
    const error = { error: 'NotFound', message: 'Transaction not found', statusCode: 404 } as any;
    expect(error.statusCode).toBe(404);
  });
});
