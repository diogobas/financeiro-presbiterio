/**
 * Rules HTTP Routes
 *
 * Implements GET /rules and POST /rules endpoints for rule management.
 * Supports pagination, filtering by category/tipo, and rule creation.
 *
 * Endpoints:
 * - GET /rules - List all rules with filtering and pagination
 * - POST /rules - Create a new rule
 */

import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { IRuleRepository } from '../domain/repositories';
import { CreateRuleInput, Rule } from '../domain/types';

/**
 * Request body for creating a rule
 */
interface CreateRuleRequest {
  name: string;
  description?: string;
  category?: string;
  tipo?: string;
  pattern: string;
  matchType: 'CONTAINS' | 'REGEX';
  priority?: number;
  enabled?: boolean;
}

/**
 * Response object for a rule
 */
interface RuleResponseDto {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tipo?: string;
  pattern: string;
  matchType: string;
  version: number;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

/**
 * Response object for listing rules
 */
interface ListRulesResponseDto {
  data: RuleResponseDto[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

/**
 * Error response object
 */
interface ErrorResponseDto {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

/**
 * Convert Rule domain model to DTO for HTTP response
 */
function ruleToDto(rule: Rule): RuleResponseDto {
  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    category: rule.category,
    tipo: rule.tipo,
    pattern: rule.pattern,
    matchType: rule.matchType,
    version: rule.version,
    priority: rule.priority,
    enabled: rule.enabled,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
    createdBy: rule.createdBy,
  };
}

/**
 * Validate regex pattern
 */
function isValidRegex(pattern: string): boolean {
  try {
    new RegExp(pattern, 'i');
    return true;
  } catch {
    return false;
  }
}

/**
 * Send error response
 */
function sendError(reply: FastifyReply, statusCode: number, error: string, message: string): void {
  const response: ErrorResponseDto = {
    error,
    message,
    statusCode,
    timestamp: new Date().toISOString(),
  };
  reply.status(statusCode).send(response);
}

/**
 * Create rules route handler
 *
 * @param server - Fastify server instance
 * @param repository - IRuleRepository instance for data access
 */
export async function createRulesRoute(server: FastifyInstance, repository: IRuleRepository) {
  /**
   * GET /rules
   *
   * List all rules with optional filtering and pagination
   *
   * Query Parameters:
   * - page: number (default: 1, min: 1)
   * - limit: number (default: 20, min: 1, max: 100)
   * - category: string (optional, filter by category)
   * - tipo: string (optional, filter by tipo)
   * - enabled: boolean (optional, filter by enabled status)
   *
   * Response: 200 OK with ListRulesResponseDto
   * Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden
   */
  server.get('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      // Parse and validate query parameters
      const query = request.query as any;
      let page = parseInt(query.page as string, 10) || 1;
      let limit = parseInt(query.limit as string, 10) || 20;

      // Validation
      if (page < 1) {
        return sendError(reply, 400, 'BadRequest', 'Parameter "page" must be a positive integer');
      }
      if (limit < 1 || limit > 100) {
        return sendError(reply, 400, 'BadRequest', 'Parameter "limit" must be between 1 and 100');
      }

      // Build filter options
      const options: any = {
        limit,
        offset: (page - 1) * limit,
      };

      if (query.category) {
        options.category = query.category as string;
      }

      if (query.tipo) {
        options.tipo = query.tipo as string;
      }

      if (query.enabled !== undefined) {
        options.enabled = query.enabled === 'true';
      }

      // Fetch rules from repository
      const result = await repository.findAll(options);

      // Build response
      const response: ListRulesResponseDto = {
        data: result.rules.map((rule) => ruleToDto(rule)),
        total: result.total,
        page,
        limit,
        hasMore: page * limit < result.total,
      };

      reply.status(200).send(response);
    } catch (error) {
      throw error;
    }
  });

  /**
   * POST /rules
   *
   * Create a new rule
   *
   * Request Body: CreateRuleRequest
   * - name: string (required, must be unique)
   * - description: string (optional)
   * - category: string (optional)
   * - tipo: string (optional)
   * - pattern: string (required, must be valid regex if matchType is REGEX)
   * - matchType: 'CONTAINS' | 'REGEX' (required)
   * - priority: number (optional, default: 0)
   * - enabled: boolean (optional, default: true)
   *
   * Response: 201 Created with RuleResponseDto
   * Headers: Location: /rules/{ruleId}
   * Errors: 400 Bad Request, 401 Unauthorized, 403 Forbidden, 409 Conflict
   */
  server.post('/rules', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const body: CreateRuleRequest = request.body as any;

      // Validation: Required fields
      if (!body.name || typeof body.name !== 'string' || body.name.trim().length === 0) {
        return sendError(reply, 400, 'BadRequest', 'Field "name" is required');
      }

      if (!body.pattern || typeof body.pattern !== 'string' || body.pattern.trim().length === 0) {
        return sendError(reply, 400, 'BadRequest', 'Field "pattern" is required');
      }

      if (!body.matchType) {
        return sendError(reply, 400, 'BadRequest', 'Field "matchType" is required');
      }

      // Validation: matchType value
      const validMatchTypes = ['CONTAINS', 'REGEX'];
      if (!validMatchTypes.includes(body.matchType)) {
        return sendError(
          reply,
          400,
          'BadRequest',
          'Field "matchType" must be "CONTAINS" or "REGEX"'
        );
      }

      // Validation: Regex pattern
      if (body.matchType === 'REGEX' && !isValidRegex(body.pattern)) {
        return sendError(reply, 400, 'BadRequest', 'Field "pattern" is not a valid regex');
      }

      // Validation: Duplicate name
      const existingRule = await repository.findByName(body.name);
      if (existingRule) {
        return sendError(reply, 409, 'Conflict', `Rule with name "${body.name}" already exists`);
      }

      // Extract user from request (from auth middleware)
      const createdBy = (request as any).user?.id || 'system';

      // Create rule
      const input: CreateRuleInput = {
        name: body.name.trim(),
        description: body.description?.trim(),
        category: body.category?.trim(),
        tipo: body.tipo as any,
        pattern: body.pattern.trim(),
        matchType: body.matchType as any,
        priority: body.priority || 0,
        enabled: body.enabled !== false,
        createdBy,
      };

      const rule = await repository.create(input);

      // Send response
      const response = ruleToDto(rule);
      reply.status(201).header('Location', `/rules/${rule.id}`).send(response);
    } catch (error) {
      // Check for duplicate key constraint error
      if ((error as any)?.code === '23505' || (error as any)?.constraint === 'rule_name_unique') {
        return sendError(reply, 409, 'Conflict', 'Rule with this name already exists');
      }

      throw error;
    }
  });
}
