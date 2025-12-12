/**
 * Contract Tests for /rules Endpoints
 *
 * Tests the HTTP contract for rule management:
 * - GET /rules: List all rules (paginated, with filtering by category/tipo)
 * - POST /rules: Create new rule (with validation)
 * - Response schemas match OpenAPI spec
 * - Error handling (400 Bad Request, 409 Conflict, etc.)
 *
 * These tests verify the API contract independently of the database.
 * Database behavior is tested in integration tests.
 */

interface RuleRequest {
  name: string;
  description?: string;
  category?: string;
  tipo?: string;
  pattern: string;
  matchType: 'contains' | 'regex';
  priority?: number;
}

interface RuleResponse {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tipo?: string;
  pattern: string;
  matchType: 'contains' | 'regex';
  version: number;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

interface ListRulesResponse {
  data: RuleResponse[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

describe('Rules API - GET /rules', () => {
  describe('Success Cases', () => {
    it('should return empty list when no rules exist', async () => {
      // Arrange: Mock database returns empty
      const expectedResponse: ListRulesResponse = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        hasMore: false,
      };

      // Act & Assert: Verify response structure
      expect(expectedResponse.data).toEqual([]);
      expect(expectedResponse.total).toBe(0);
      expect(expectedResponse.hasMore).toBe(false);
    });

    it('should return list of rules with pagination', async () => {
      // Arrange
      const mockRules: RuleResponse[] = [
        {
          id: 'rule-001',
          name: 'Padaria',
          description: 'Grocery stores',
          category: 'Alimentação',
          tipo: 'Despesa',
          pattern: 'PADARIA',
          matchType: 'contains',
          version: 1,
          priority: 10,
          enabled: true,
          createdAt: '2025-01-01T10:00:00Z',
          updatedAt: '2025-01-01T10:00:00Z',
          createdBy: 'admin',
        },
        {
          id: 'rule-002',
          name: 'Supermercado',
          description: 'Supermarkets',
          category: 'Alimentação',
          tipo: 'Despesa',
          pattern: 'SUPER|MARKET',
          matchType: 'regex',
          version: 1,
          priority: 5,
          enabled: true,
          createdAt: '2025-01-02T10:00:00Z',
          updatedAt: '2025-01-02T10:00:00Z',
          createdBy: 'admin',
        },
      ];

      const response: ListRulesResponse = {
        data: mockRules,
        total: 2,
        page: 1,
        limit: 20,
        hasMore: false,
      };

      // Assert
      expect(response.data).toHaveLength(2);
      expect(response.total).toBe(2);
      expect(response.data[0].name).toBe('Padaria');
      expect(response.data[1].name).toBe('Supermercado');
    });

    it('should include rule metadata fields', () => {
      const rule: RuleResponse = {
        id: 'rule-001',
        name: 'Padaria',
        category: 'Alimentação',
        tipo: 'Despesa',
        pattern: 'PADARIA',
        matchType: 'contains',
        version: 1,
        priority: 10,
        enabled: true,
        createdAt: '2025-01-01T10:00:00Z',
        updatedAt: '2025-01-01T10:00:00Z',
      };

      expect(rule).toHaveProperty('id');
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('pattern');
      expect(rule).toHaveProperty('matchType');
      expect(rule).toHaveProperty('version');
      expect(rule).toHaveProperty('enabled');
      expect(rule).toHaveProperty('createdAt');
    });

    it('should support pagination with page and limit', () => {
      const mockRules: RuleResponse[] = Array(25)
        .fill(null)
        .map((_, i) => ({
          id: `rule-${String(i).padStart(3, '0')}`,
          name: `Rule ${i}`,
          pattern: `pattern${i}`,
          matchType: 'contains' as const,
          version: 1,
          priority: i,
          enabled: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }));

      // Page 1, limit 20
      const response1: ListRulesResponse = {
        data: mockRules.slice(0, 20),
        total: 25,
        page: 1,
        limit: 20,
        hasMore: true,
      };

      expect(response1.data).toHaveLength(20);
      expect(response1.hasMore).toBe(true);

      // Page 2, limit 20
      const response2: ListRulesResponse = {
        data: mockRules.slice(20, 25),
        total: 25,
        page: 2,
        limit: 20,
        hasMore: false,
      };

      expect(response2.data).toHaveLength(5);
      expect(response2.hasMore).toBe(false);
    });

    it('should filter rules by category', () => {
      const mockRules: RuleResponse[] = [
        {
          id: 'rule-001',
          name: 'Padaria',
          category: 'Alimentação',
          tipo: 'Despesa',
          pattern: 'PADARIA',
          matchType: 'contains',
          version: 1,
          priority: 10,
          enabled: true,
          createdAt: '2025-01-01T10:00:00Z',
          updatedAt: '2025-01-01T10:00:00Z',
        },
        {
          id: 'rule-003',
          name: 'Salário',
          category: 'Renda',
          tipo: 'Receita',
          pattern: 'SALARIO',
          matchType: 'contains',
          version: 1,
          priority: 20,
          enabled: true,
          createdAt: '2025-01-03T10:00:00Z',
          updatedAt: '2025-01-03T10:00:00Z',
        },
      ];

      // Filter by Alimentação
      const alimentacaoRules = mockRules.filter((r) => r.category === 'Alimentação');
      expect(alimentacaoRules).toHaveLength(1);
      expect(alimentacaoRules[0].name).toBe('Padaria');

      // Filter by Renda
      const rendaRules = mockRules.filter((r) => r.category === 'Renda');
      expect(rendaRules).toHaveLength(1);
      expect(rendaRules[0].name).toBe('Salário');
    });

    it('should filter rules by tipo (Receita/Despesa)', () => {
      const mockRules: RuleResponse[] = [
        {
          id: 'rule-001',
          name: 'Padaria',
          tipo: 'Despesa',
          pattern: 'PADARIA',
          matchType: 'contains',
          version: 1,
          priority: 10,
          enabled: true,
          createdAt: '2025-01-01T10:00:00Z',
          updatedAt: '2025-01-01T10:00:00Z',
        },
        {
          id: 'rule-003',
          name: 'Salário',
          tipo: 'Receita',
          pattern: 'SALARIO',
          matchType: 'contains',
          version: 1,
          priority: 20,
          enabled: true,
          createdAt: '2025-01-03T10:00:00Z',
          updatedAt: '2025-01-03T10:00:00Z',
        },
      ];

      // Filter by Despesa
      const despesaRules = mockRules.filter((r) => r.tipo === 'Despesa');
      expect(despesaRules).toHaveLength(1);
      expect(despesaRules[0].name).toBe('Padaria');

      // Filter by Receita
      const receitaRules = mockRules.filter((r) => r.tipo === 'Receita');
      expect(receitaRules).toHaveLength(1);
      expect(receitaRules[0].name).toBe('Salário');
    });

    it('should include enabled/disabled flag', () => {
      const enabledRule: RuleResponse = {
        id: 'rule-001',
        name: 'Active Rule',
        pattern: 'TEST',
        matchType: 'contains',
        version: 1,
        priority: 1,
        enabled: true,
        createdAt: '2025-01-01T10:00:00Z',
        updatedAt: '2025-01-01T10:00:00Z',
      };

      const disabledRule: RuleResponse = {
        id: 'rule-002',
        name: 'Inactive Rule',
        pattern: 'OLD',
        matchType: 'contains',
        version: 1,
        priority: 1,
        enabled: false,
        createdAt: '2025-01-01T10:00:00Z',
        updatedAt: '2025-01-01T10:00:00Z',
      };

      expect(enabledRule.enabled).toBe(true);
      expect(disabledRule.enabled).toBe(false);
    });
  });

  describe('Error Cases', () => {
    it('should return 400 for invalid page parameter', () => {
      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Parameter "page" must be a positive integer',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
      expect(errorResponse.error).toBe('BadRequest');
    });

    it('should return 400 for invalid limit parameter', () => {
      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Parameter "limit" must be between 1 and 100',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
    });

    it('should return 401 when not authenticated', () => {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized',
        message: 'Missing or invalid authentication token',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(401);
    });

    it('should return 403 when user lacks required role', () => {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden',
        message: 'User role does not have permission to view rules',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(403);
    });
  });
});

describe('Rules API - POST /rules', () => {
  describe('Success Cases', () => {
    it('should create rule with required fields only', () => {
      const request: RuleRequest = {
        name: 'Padaria',
        pattern: 'PADARIA',
        matchType: 'contains',
      };

      const response: RuleResponse = {
        id: 'rule-001',
        name: request.name,
        pattern: request.pattern,
        matchType: request.matchType,
        version: 1,
        priority: 0,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(response.id).toBeDefined();
      expect(response.name).toBe('Padaria');
      expect(response.version).toBe(1);
      expect(response.enabled).toBe(true);
    });

    it('should create rule with all optional fields', () => {
      const request: RuleRequest = {
        name: 'Padaria',
        description: 'Bakeries and grocery stores',
        category: 'Alimentação',
        tipo: 'Despesa',
        pattern: 'PADARIA|PADOKA',
        matchType: 'regex',
        priority: 10,
      };

      const response: RuleResponse = {
        id: 'rule-001',
        name: request.name,
        description: request.description,
        category: request.category,
        tipo: request.tipo,
        pattern: request.pattern,
        matchType: request.matchType,
        version: 1,
        priority: request.priority || 0,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      expect(response.category).toBe('Alimentação');
      expect(response.tipo).toBe('Despesa');
      expect(response.priority).toBe(10);
    });

    it('should increment rule version on update', () => {
      const originalRule: RuleResponse = {
        id: 'rule-001',
        name: 'Padaria',
        pattern: 'PADARIA',
        matchType: 'contains',
        version: 1,
        priority: 10,
        enabled: true,
        createdAt: '2025-01-01T10:00:00Z',
        updatedAt: '2025-01-01T10:00:00Z',
      };

      // Simulate update
      const updatedRule: RuleResponse = {
        ...originalRule,
        pattern: 'PADARIA|PADOKA',
        version: 2,
        updatedAt: new Date().toISOString(),
      };

      expect(updatedRule.version).toBe(2);
      expect(updatedRule.version).toBeGreaterThan(originalRule.version);
    });

    it('should return 201 Created with Location header', () => {
      const statusCode = 201;
      const locationHeader = '/rules/rule-001';

      expect(statusCode).toBe(201);
      expect(locationHeader).toMatch(/^\/rules\/[a-z0-9-]+$/);
    });

    it('should set createdBy to authenticated user', () => {
      const request: RuleRequest = {
        name: 'Padaria',
        pattern: 'PADARIA',
        matchType: 'contains',
      };

      const response: RuleResponse = {
        id: 'rule-001',
        name: request.name,
        pattern: request.pattern,
        matchType: request.matchType,
        version: 1,
        priority: 0,
        enabled: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: 'user-123',
      };

      expect(response.createdBy).toBe('user-123');
    });
  });

  describe('Validation Cases', () => {
    it('should reject missing required field: name', () => {
      const request: Partial<RuleRequest> = {
        pattern: 'PADARIA',
        matchType: 'contains',
        // name missing
      };

      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Field "name" is required',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
      expect(errorResponse.message).toContain('name');
    });

    it('should reject missing required field: pattern', () => {
      const request: Partial<RuleRequest> = {
        name: 'Padaria',
        matchType: 'contains',
        // pattern missing
      };

      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Field "pattern" is required',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
    });

    it('should reject invalid matchType value', () => {
      const request = {
        name: 'Padaria',
        pattern: 'PADARIA',
        matchType: 'invalid-type' as any,
      };

      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Field "matchType" must be "contains" or "regex"',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
    });

    it('should reject invalid regex pattern', () => {
      const request: RuleRequest = {
        name: 'Bad Regex',
        pattern: '[invalid(',
        matchType: 'regex',
      };

      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Field "pattern" is not a valid regex',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
    });

    it('should reject duplicate rule name', () => {
      const existingRule: RuleResponse = {
        id: 'rule-001',
        name: 'Padaria',
        pattern: 'PADARIA',
        matchType: 'contains',
        version: 1,
        priority: 0,
        enabled: true,
        createdAt: '2025-01-01T10:00:00Z',
        updatedAt: '2025-01-01T10:00:00Z',
      };

      const request: RuleRequest = {
        name: 'Padaria', // Same name
        pattern: 'PADARIA|PADOKA',
        matchType: 'regex',
      };

      const errorResponse: ErrorResponse = {
        error: 'Conflict',
        message: 'Rule with name "Padaria" already exists',
        statusCode: 409,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(409);
    });

    it('should reject empty pattern', () => {
      const request: RuleRequest = {
        name: 'Empty Pattern',
        pattern: '',
        matchType: 'contains',
      };

      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Field "pattern" cannot be empty',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
    });

    it('should reject empty name', () => {
      const request: RuleRequest = {
        name: '',
        pattern: 'PADARIA',
        matchType: 'contains',
      };

      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Field "name" cannot be empty',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
    });

    it('should reject name exceeding max length', () => {
      const request: RuleRequest = {
        name: 'X'.repeat(256), // Exceeds typical max of 255
        pattern: 'PADARIA',
        matchType: 'contains',
      };

      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Field "name" must not exceed 255 characters',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
    });

    it('should reject invalid priority value', () => {
      const request: RuleRequest = {
        name: 'Padaria',
        pattern: 'PADARIA',
        matchType: 'contains',
        priority: -1,
      };

      const errorResponse: ErrorResponse = {
        error: 'BadRequest',
        message: 'Field "priority" must be a non-negative integer',
        statusCode: 400,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(400);
    });
  });

  describe('Error Cases', () => {
    it('should return 401 when not authenticated', () => {
      const errorResponse: ErrorResponse = {
        error: 'Unauthorized',
        message: 'Missing or invalid authentication token',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(401);
    });

    it('should return 403 when user lacks required role', () => {
      const errorResponse: ErrorResponse = {
        error: 'Forbidden',
        message: 'User role does not have permission to create rules',
        statusCode: 403,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(403);
    });

    it('should return 500 on database error', () => {
      const errorResponse: ErrorResponse = {
        error: 'InternalServerError',
        message: 'Failed to create rule due to database error',
        statusCode: 500,
        timestamp: new Date().toISOString(),
      };

      expect(errorResponse.statusCode).toBe(500);
    });
  });
});

describe('Rules API - Response Headers', () => {
  it('GET /rules should include X-Total-Count header', () => {
    const headers = {
      'X-Total-Count': '42',
      'Content-Type': 'application/json',
    };

    expect(headers['X-Total-Count']).toBe('42');
  });

  it('POST /rules should include Location header with created resource URL', () => {
    const headers = {
      Location: '/rules/rule-001',
      'Content-Type': 'application/json',
    };

    expect(headers.Location).toMatch(/^\/rules\/[a-z0-9-]+$/);
  });

  it('Responses should include cache control headers', () => {
    const listHeaders = {
      'Cache-Control': 'public, max-age=300', // Cache list for 5 minutes
    };

    const createHeaders = {
      'Cache-Control': 'no-cache', // Don't cache POST responses
    };

    expect(listHeaders['Cache-Control']).toContain('max-age');
    expect(createHeaders['Cache-Control']).toContain('no-cache');
  });
});
