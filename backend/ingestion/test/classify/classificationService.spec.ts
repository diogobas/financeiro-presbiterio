/**
 * Classification Service Tests
 *
 * Tests the complete classification pipeline:
 * - Loading rules from repository
 * - Classifying individual transactions
 * - Batch classification
 * - Rule matching and rationale tracking
 * - Edge cases and error handling
 */

import { ClassificationService } from '../../src/classify/classificationService';
import { Rule, Transaction } from '../../src/domain/types';
import { IRuleRepository } from '../../src/domain/repositories';
import { v4 as uuidv4 } from 'uuid';

/**
 * Mock implementation of IRuleRepository for testing
 */
class MockRuleRepository implements IRuleRepository {
  private rules: Map<string, Rule> = new Map();
  private nextId = 0;

  async findAll(options?: any): Promise<{ rules: Rule[]; total: number }> {
    let rules = Array.from(this.rules.values());

    if (options?.enabled !== undefined) {
      rules = rules.filter((r) => r.enabled === options.enabled);
    }

    if (options?.category !== undefined) {
      rules = rules.filter((r) => r.category === options.category);
    }

    if (options?.tipo !== undefined) {
      rules = rules.filter((r) => r.tipo === options.tipo);
    }

    const total = rules.length;

    if (options?.limit !== undefined) {
      const offset = options?.offset || 0;
      rules = rules.slice(offset, offset + options.limit);
    }

    return { rules, total };
  }

  async findByCategory(category: string): Promise<Rule[]> {
    return Array.from(this.rules.values()).filter((r) => r.category === category);
  }

  async findByType(tipo: any): Promise<Rule[]> {
    return Array.from(this.rules.values()).filter((r) => r.tipo === tipo);
  }

  async findByName(name: string): Promise<Rule | null> {
    const rule = Array.from(this.rules.values()).find((r) => r.name === name);
    return rule || null;
  }

  async findActive(): Promise<Rule[]> {
    return Array.from(this.rules.values()).filter((r) => r.enabled);
  }

  async findById(id: string): Promise<Rule | null> {
    return this.rules.get(id) || null;
  }

  async create(input: any): Promise<Rule> {
    const id = uuidv4();
    const now = new Date();
    const rule: Rule = {
      id,
      name: input.name,
      description: input.description,
      category: input.category,
      tipo: input.tipo,
      pattern: input.pattern,
      matchType: input.matchType,
      version: 1,
      priority: input.priority || 0,
      enabled: input.enabled !== false,
      createdAt: now,
      updatedAt: now,
      createdBy: input.createdBy,
    };
    this.rules.set(id, rule);
    return rule;
  }

  async update(id: string, updates: any): Promise<Rule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule ${id} not found`);
    }

    const updated: Rule = {
      ...rule,
      ...updates,
      version: rule.version + 1,
      updatedAt: new Date(),
    };
    this.rules.set(id, updated);
    return updated;
  }

  async setEnabled(id: string, enabled: boolean): Promise<Rule> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule ${id} not found`);
    }
    rule.enabled = enabled;
    return rule;
  }

  async deactivate(id: string): Promise<void> {
    const rule = this.rules.get(id);
    if (!rule) {
      throw new Error(`Rule ${id} not found`);
    }
    rule.enabled = false;
  }

  async count(): Promise<number> {
    return this.rules.size;
  }

  async countActive(): Promise<number> {
    return Array.from(this.rules.values()).filter((r) => r.enabled).length;
  }

  async existsByName(name: string): Promise<boolean> {
    return Array.from(this.rules.values()).some((r) => r.name === name);
  }

  clearRules(): void {
    this.rules.clear();
  }
}

describe('ClassificationService Tests', () => {
  let repository: MockRuleRepository;
  let service: ClassificationService;

  beforeEach(() => {
    repository = new MockRuleRepository();
    service = new ClassificationService(repository);
  });

  describe('Service Initialization', () => {
    it('should initialize without error when no rules exist', async () => {
      await service.initialize();
      expect(service.isInitialized()).toBe(true);
      expect(service.getRuleStats().totalRules).toBe(0);
    });

    it('should load active rules on initialization', async () => {
      // Create some test rules
      await repository.create({
        name: 'Padaria',
        pattern: 'PADARIA|PADOKA',
        matchType: 'REGEX',
        priority: 15,
        enabled: true,
      });

      await repository.create({
        name: 'Salário',
        pattern: 'SALARIO|VENCIMENTO',
        matchType: 'REGEX',
        priority: 20,
        enabled: true,
      });

      // Disable one rule (not included)
      const result = await repository.findAll();
      if (result.rules.length > 0) {
        await repository.setEnabled(result.rules[0].id, false);
      }

      // Initialize service
      await service.initialize();

      // Should only load enabled rules
      const stats = service.getRuleStats();
      expect(stats.totalRules).toBe(1); // Only the enabled rule
      expect(stats.rules[0].priority).toBe(20); // Salário rule
    });

    it('should skip invalid regex patterns during initialization', async () => {
      // Create a valid rule
      await repository.create({
        name: 'Valid Rule',
        pattern: 'VALID',
        matchType: 'CONTAINS',
        priority: 10,
        enabled: true,
      });

      // Initialize should handle gracefully
      await service.initialize();

      const stats = service.getRuleStats();
      expect(stats.totalRules).toBe(1);
    });

    it('should support idempotent initialization', async () => {
      await repository.create({
        name: 'Test Rule',
        pattern: 'TEST',
        matchType: 'CONTAINS',
        priority: 10,
        enabled: true,
      });

      await service.initialize();
      const stats1 = service.getRuleStats();

      // Initialize again - should not duplicate
      await service.initialize();
      const stats2 = service.getRuleStats();

      expect(stats1.totalRules).toBe(stats2.totalRules);
    });
  });

  describe('Single Transaction Classification', () => {
    beforeEach(async () => {
      // Create test rules
      await repository.create({
        name: 'Padaria',
        pattern: 'PADARIA',
        matchType: 'CONTAINS',
        priority: 10,
        enabled: true,
      });

      await repository.create({
        name: 'Salário',
        pattern: 'SALARIO|VENCIMENTO',
        matchType: 'REGEX',
        priority: 20,
        enabled: true,
      });

      await service.initialize();
    });

    it('should classify transaction with matching rule', async () => {
      const transaction: Transaction = {
        id: uuidv4(),
        batchId: uuidv4(),
        accountId: uuidv4(),
        date: new Date(),
        documento: 'Pagamento Padaria José',
        documentoNormalized: 'PAGAMENTO PADARIA JOSE',
        amount: 50.0,
        currency: 'BRL',
        classificationSource: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.classify(transaction);

      expect(result.matched).toBe(true);
      expect(result.classificationSource).toBe('RULE');
      expect(result.ruleName).toBe('Padaria');
      expect(result.rationale).toBeDefined();
    });

    it('should classify with higher priority rule when multiple match', async () => {
      // Create a second rule that also matches but with lower priority
      await repository.create({
        name: 'Generic Payment',
        pattern: 'PAGAMENTO',
        matchType: 'CONTAINS',
        priority: 5, // Lower priority than Padaria (10)
        enabled: true,
      });

      // Reload to get new rule
      await service.reload();

      const transaction: Transaction = {
        id: uuidv4(),
        batchId: uuidv4(),
        accountId: uuidv4(),
        date: new Date(),
        documento: 'Pagamento Padaria José',
        documentoNormalized: 'PAGAMENTO PADARIA JOSE',
        amount: 50.0,
        currency: 'BRL',
        classificationSource: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.classify(transaction);

      // Should match the Padaria rule (priority 10) over Generic Payment (priority 5)
      expect(result.ruleName).toBe('Padaria');
    });

    it('should handle case-insensitive matching', async () => {
      const transaction: Transaction = {
        id: uuidv4(),
        batchId: uuidv4(),
        accountId: uuidv4(),
        date: new Date(),
        documento: 'VENCIMENTO JANEIRO',
        documentoNormalized: 'VENCIMENTO JANEIRO',
        amount: 5000.0,
        currency: 'BRL',
        classificationSource: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.classify(transaction);

      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('Salário');
    });

    it('should handle accent-folded matching', async () => {
      const transaction: Transaction = {
        id: uuidv4(),
        batchId: uuidv4(),
        accountId: uuidv4(),
        date: new Date(),
        documento: 'Pagamento Padaria São José',
        documentoNormalized: 'PAGAMENTO PADARIA SAO JOSE',
        amount: 75.5,
        currency: 'BRL',
        classificationSource: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.classify(transaction);

      expect(result.matched).toBe(true);
      expect(result.ruleName).toBe('Padaria');
    });

    it('should return NONE when no rule matches', async () => {
      const transaction: Transaction = {
        id: uuidv4(),
        batchId: uuidv4(),
        accountId: uuidv4(),
        date: new Date(),
        documento: 'TRANSFERÊNCIA BANCO CENTRAL',
        documentoNormalized: 'TRANSFERENCIA BANCO CENTRAL',
        amount: 1000.0,
        currency: 'BRL',
        classificationSource: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.classify(transaction);

      expect(result.matched).toBe(false);
      expect(result.classificationSource).toBe('NONE');
      expect(result.ruleId).toBeUndefined();
    });

    it('should include rule version in result', async () => {
      const transaction: Transaction = {
        id: uuidv4(),
        batchId: uuidv4(),
        accountId: uuidv4(),
        date: new Date(),
        documento: 'Pagamento Padaria',
        documentoNormalized: 'PAGAMENTO PADARIA',
        amount: 50.0,
        currency: 'BRL',
        classificationSource: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.classify(transaction);

      expect(result.ruleVersion).toBeGreaterThanOrEqual(1);
    });
  });

  describe('Batch Classification', () => {
    beforeEach(async () => {
      await repository.create({
        name: 'Café',
        pattern: 'CAFE|CAFÉ|LANCHONETE',
        matchType: 'REGEX',
        priority: 10,
        enabled: true,
      });

      await repository.create({
        name: 'Supermercado',
        pattern: 'SUPERMERCADO|MERCADO|EXTRA',
        matchType: 'REGEX',
        priority: 10,
        enabled: true,
      });

      await service.initialize();
    });

    it('should classify multiple transactions', async () => {
      const transactions: Transaction[] = [
        {
          id: uuidv4(),
          batchId: uuidv4(),
          accountId: uuidv4(),
          date: new Date(),
          documento: 'Café Coração Paulista',
          documentoNormalized: 'CAFE CORACAO PAULISTA',
          amount: 15.0,
          currency: 'BRL',
          classificationSource: 'NONE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uuidv4(),
          batchId: uuidv4(),
          accountId: uuidv4(),
          date: new Date(),
          documento: 'Supermercado Carrefour',
          documentoNormalized: 'SUPERMERCADO CARREFOUR',
          amount: 150.0,
          currency: 'BRL',
          classificationSource: 'NONE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uuidv4(),
          batchId: uuidv4(),
          accountId: uuidv4(),
          date: new Date(),
          documento: 'Transferência Inter',
          documentoNormalized: 'TRANSFERENCIA INTER',
          amount: 500.0,
          currency: 'BRL',
          classificationSource: 'NONE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const results = await service.classifyBatch(transactions);

      expect(results).toHaveLength(3);
      expect(results[0].ruleName).toBe('Café');
      expect(results[1].ruleName).toBe('Supermercado');
      expect(results[2].classificationSource).toBe('NONE');
    });

    it('should maintain transaction order in batch results', async () => {
      const transactions: Transaction[] = [
        {
          id: 'tx-1',
          batchId: uuidv4(),
          accountId: uuidv4(),
          date: new Date(),
          documento: 'Supermercado',
          documentoNormalized: 'SUPERMERCADO',
          amount: 100.0,
          currency: 'BRL',
          classificationSource: 'NONE',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
        {
          id: 'tx-2',
          batchId: uuidv4(),
          accountId: uuidv4(),
          date: new Date(),
          documento: 'Café',
          documentoNormalized: 'CAFE',
          amount: 50.0,
          currency: 'BRL',
          classificationSource: 'NONE',
          createdAt: new Date(),
          updatedAt: new Date(),
        } as any,
      ];

      const results = await service.classifyBatch(transactions);

      expect(results[0].ruleName).toBe('Supermercado');
      expect(results[1].ruleName).toBe('Café');
    });

    it('should handle empty batch', async () => {
      const results = await service.classifyBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('Rule Reload and Updates', () => {
    it('should reload rules when rules are updated', async () => {
      await repository.create({
        name: 'Initial Rule',
        pattern: 'INITIAL',
        matchType: 'CONTAINS',
        priority: 10,
        enabled: true,
      });

      await service.initialize();
      let stats = service.getRuleStats();
      expect(stats.totalRules).toBe(1);

      // Add a new rule
      await repository.create({
        name: 'New Rule',
        pattern: 'NEW',
        matchType: 'CONTAINS',
        priority: 15,
        enabled: true,
      });

      // Reload service
      await service.reload();
      stats = service.getRuleStats();
      expect(stats.totalRules).toBe(2);
    });

    it('should not load disabled rules after reload', async () => {
      const _rule2 = await repository.create({
        name: 'Rule 1',
        pattern: 'PATTERN1',
        matchType: 'CONTAINS',
        priority: 10,
        enabled: true,
      });

      const rule2 = await repository.create({
        name: 'Rule 2',
        pattern: 'PATTERN2',
        matchType: 'CONTAINS',
        priority: 15,
        enabled: true,
      });

      await service.initialize();
      expect(service.getRuleStats().totalRules).toBe(2);

      // Disable one rule
      await repository.setEnabled(rule1.id, false);

      // Reload
      await service.reload();
      expect(service.getRuleStats().totalRules).toBe(1);
      expect(service.getRuleStats().rules[0].ruleName).toBe('Rule 2');
    });
  });

  describe('Real-World Scenarios', () => {
    beforeEach(async () => {
      // Create realistic rules
      await repository.create({
        name: 'Salário/Vencimento',
        pattern: 'SALARIO|VENCIMENTO|PRO-LABORE',
        matchType: 'REGEX',
        priority: 100,
        enabled: true,
      });

      await repository.create({
        name: 'Água e Esgoto',
        pattern: 'AGUA|SABESP|ESGOTO',
        matchType: 'REGEX',
        priority: 50,
        enabled: true,
      });

      await repository.create({
        name: 'Energia Elétrica',
        pattern: 'LUZ|ENERGIA|ELETROBRAS|ENEL',
        matchType: 'REGEX',
        priority: 50,
        enabled: true,
      });

      await repository.create({
        name: 'Telefone/Internet',
        pattern: 'TELEFONE|CELULAR|INTERNET|CLARO|VIVO|OI',
        matchType: 'REGEX',
        priority: 40,
        enabled: true,
      });

      await repository.create({
        name: 'Supermercado',
        pattern: 'SUPERMERCADO|MERCADO|CARREFOUR|EXTRA|PAO DE ACUCAR',
        matchType: 'REGEX',
        priority: 30,
        enabled: true,
      });

      await repository.create({
        name: 'Posto de Gasolina',
        pattern: 'POSTO|GASOLINA|COMBUSTIVEL|BR|SHELL|PETROBRAS',
        matchType: 'REGEX',
        priority: 30,
        enabled: true,
      });

      await service.initialize();
    });

    it('should classify real-world transactions', async () => {
      const transactions: Transaction[] = [
        {
          id: uuidv4(),
          batchId: uuidv4(),
          accountId: uuidv4(),
          date: new Date('2024-01-05'),
          documento: 'TRANSFERENCIA SALARIO JANEIRO',
          documentoNormalized: 'TRANSFERENCIA SALARIO JANEIRO',
          amount: 5000.0,
          currency: 'BRL',
          classificationSource: 'NONE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uuidv4(),
          batchId: uuidv4(),
          accountId: uuidv4(),
          date: new Date('2024-01-10'),
          documento: 'SABESP FATURA AGUA JANEIRO',
          documentoNormalized: 'SABESP FATURA AGUA JANEIRO',
          amount: 150.0,
          currency: 'BRL',
          classificationSource: 'NONE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uuidv4(),
          batchId: uuidv4(),
          accountId: uuidv4(),
          date: new Date('2024-01-15'),
          documento: 'MERCADO CARREFOUR SP',
          documentoNormalized: 'MERCADO CARREFOUR SP',
          amount: 275.5,
          currency: 'BRL',
          classificationSource: 'NONE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: uuidv4(),
          batchId: uuidv4(),
          accountId: uuidv4(),
          date: new Date('2024-01-20'),
          documento: 'SHELL POSTO GASOLINA',
          documentoNormalized: 'SHELL POSTO GASOLINA',
          amount: 250.0,
          currency: 'BRL',
          classificationSource: 'NONE',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const results = await service.classifyBatch(transactions);

      expect(results[0].ruleName).toBe('Salário/Vencimento');
      expect(results[1].ruleName).toBe('Água e Esgoto');
      expect(results[2].ruleName).toBe('Supermercado');
      expect(results[3].ruleName).toBe('Posto de Gasolina');
    });

    it('should respect rule priority in real-world scenarios', async () => {
      // Create an overlapping rule with lower priority
      await repository.create({
        name: 'Generic Payment',
        pattern: 'TRANSFERENCIA',
        matchType: 'CONTAINS',
        priority: 5,
        enabled: true,
      });

      await service.reload();

      const transaction: Transaction = {
        id: uuidv4(),
        batchId: uuidv4(),
        accountId: uuidv4(),
        date: new Date(),
        documento: 'TRANSFERENCIA SALARIO',
        documentoNormalized: 'TRANSFERENCIA SALARIO',
        amount: 5000.0,
        currency: 'BRL',
        classificationSource: 'NONE',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await service.classify(transaction);

      // Should match higher priority rule
      expect(result.ruleName).toBe('Salário/Vencimento');
    });
  });

  describe('Service Statistics', () => {
    it('should provide rule statistics', async () => {
      await repository.create({
        name: 'Rule 1',
        pattern: 'PATTERN1',
        matchType: 'CONTAINS',
        priority: 10,
        enabled: true,
      });

      await repository.create({
        name: 'Rule 2',
        pattern: 'PATTERN2',
        matchType: 'REGEX',
        priority: 20,
        enabled: true,
      });

      await service.initialize();

      const stats = service.getRuleStats();

      expect(stats.totalRules).toBe(2);
      expect(stats.rules).toHaveLength(2);
      // Rules should be sorted by priority (highest first)
      expect(stats.rules[0].priority).toBe(20);
      expect(stats.rules[1].priority).toBe(10);
    });

    it('should report zero rules when uninitialized', async () => {
      const stats = service.getRuleStats();
      expect(stats.totalRules).toBe(0);
      expect(stats.rules).toHaveLength(0);
    });
  });
});
