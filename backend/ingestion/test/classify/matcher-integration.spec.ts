/**
 * Integration Tests for Matcher Library
 *
 * Tests the DocumentMatcher and BatchDocumentMatcher classes:
 * - Basic matching (contains and regex)
 * - Accent folding and case insensitivity
 * - Priority-based rule evaluation
 * - Error handling
 * - Real-world banco transaction patterns
 */

import {
  DocumentMatcher,
  BatchDocumentMatcher,
  normalizeDocumento,
  matchesContains,
  matchesRegex,
} from '../../src/classify/matcher';

describe('DocumentMatcher - Class-based Matching', () => {
  describe('Construction', () => {
    it('should create matcher with CONTAINS type', () => {
      const matcher = new DocumentMatcher('PADARIA', 'CONTAINS');
      expect(matcher).toBeDefined();
      expect(matcher.getDetails().matchType).toBe('CONTAINS');
    });

    it('should create matcher with REGEX type', () => {
      const matcher = new DocumentMatcher('PADARIA|SUPER', 'REGEX');
      expect(matcher).toBeDefined();
      expect(matcher.getDetails().matchType).toBe('REGEX');
    });

    it('should throw error for empty pattern', () => {
      expect(() => new DocumentMatcher('', 'CONTAINS')).toThrow();
      expect(() => new DocumentMatcher('   ', 'CONTAINS')).toThrow();
    });

    it('should throw error for invalid regex pattern', () => {
      expect(() => new DocumentMatcher('[invalid(', 'REGEX')).toThrow();
    });

    it('should normalize pattern for CONTAINS matching', () => {
      const matcher = new DocumentMatcher('Café', 'CONTAINS');
      const details = matcher.getDetails();
      expect(details.normalized).toBe('CAFE');
    });
  });

  describe('CONTAINS Matching', () => {
    it('should match exact substring', () => {
      const matcher = new DocumentMatcher('PADARIA', 'CONTAINS');
      const result = matcher.matches('PAGAMENTO PADARIA CENTRAL');
      expect(result.matches).toBe(true);
    });

    it('should match case-insensitively', () => {
      const matcher = new DocumentMatcher('padaria', 'CONTAINS');
      const result = matcher.matches('PAGAMENTO PADARIA CENTRAL');
      expect(result.matches).toBe(true);
    });

    it('should match with accent-folding', () => {
      const matcher = new DocumentMatcher('JOSE', 'CONTAINS');
      const result = matcher.matches('PAGAMENTO PADARIA JOSÉ');
      expect(result.matches).toBe(true);
    });

    it('should not match non-matching pattern', () => {
      const matcher = new DocumentMatcher('PIZZA', 'CONTAINS');
      const result = matcher.matches('PAGAMENTO PADARIA CENTRAL');
      expect(result.matches).toBe(false);
    });

    it('should provide reason message', () => {
      const matcher = new DocumentMatcher('PADARIA', 'CONTAINS');
      const result = matcher.matches('PAGAMENTO PADARIA CENTRAL');
      expect(result.reason).toContain('PADARIA');
    });

    it('should return false for empty documento', () => {
      const matcher = new DocumentMatcher('PADARIA', 'CONTAINS');
      const result = matcher.matches('');
      expect(result.matches).toBe(false);
    });
  });

  describe('REGEX Matching', () => {
    it('should match simple regex pattern', () => {
      const matcher = new DocumentMatcher('PADARIA', 'REGEX');
      const result = matcher.matches('PAGAMENTO PADARIA CENTRAL');
      expect(result.matches).toBe(true);
    });

    it('should match regex with alternation', () => {
      const matcher = new DocumentMatcher('PADARIA|SUPER', 'REGEX');
      expect(matcher.matches('PADARIA CENTRAL').matches).toBe(true);
      expect(matcher.matches('SUPERMERCADO').matches).toBe(true);
      expect(matcher.matches('PIZZA').matches).toBe(false);
    });

    it('should match regex with quantifiers', () => {
      const matcher = new DocumentMatcher('PADARIA[0-9]{3}', 'REGEX');
      expect(matcher.matches('PADARIA123').matches).toBe(true);
      expect(matcher.matches('PADARIA12').matches).toBe(false);
    });

    it('should match regex with anchors', () => {
      const matcher = new DocumentMatcher('^PADARIA', 'REGEX');
      expect(matcher.matches('PADARIA CENTRAL').matches).toBe(true);
      expect(matcher.matches('PAGAMENTO PADARIA').matches).toBe(false);
    });

    it('should match regex case-insensitively', () => {
      const matcher = new DocumentMatcher('padaria', 'REGEX');
      const result = matcher.matches('PAGAMENTO PADARIA CENTRAL');
      expect(result.matches).toBe(true);
    });

    it('should return false for non-matching regex', () => {
      const matcher = new DocumentMatcher('PIZZA', 'REGEX');
      const result = matcher.matches('PADARIA CENTRAL');
      expect(result.matches).toBe(false);
    });
  });

  describe('Real-World Patterns', () => {
    it('should match grocery stores', () => {
      const matcher = new DocumentMatcher('PADARIA|SUPER|MERCEARIA', 'REGEX');
      const documentos = ['PADARIA JOSÉ', 'SUPERMERCADO ABC', 'MERCEARIA CENTRAL'];
      documentos.forEach((doc) => {
        expect(matcher.matches(doc).matches).toBe(true);
      });
    });

    it('should match salary payments', () => {
      const matcher = new DocumentMatcher('SALARIO|SALÁRIO|VENCIMENTO', 'REGEX');
      expect(matcher.matches('SALARIO JANEIRO').matches).toBe(true);
      expect(matcher.matches('SALÁRIO FEVEREIRO').matches).toBe(true);
      expect(matcher.matches('VENCIMENTO MARCO').matches).toBe(true);
    });

    it('should match utility payments', () => {
      const matcher = new DocumentMatcher('AGUA|LUZ|GAS|INTERNET|TELEFONE', 'REGEX');
      expect(matcher.matches('PAGAMENTO AGUA').matches).toBe(true);
      expect(matcher.matches('FATURA LUZ').matches).toBe(true);
      expect(matcher.matches('INTERNET BANDA LARGA').matches).toBe(true);
    });

    it('should match financial instruments', () => {
      const matcher = new DocumentMatcher('PIX|BOLETO|TRANSFERENCIA|DEPOSITO', 'REGEX');
      expect(matcher.matches('PIX RECEBIDO').matches).toBe(true);
      expect(matcher.matches('BOLETO PAGAMENTO').matches).toBe(true);
      expect(matcher.matches('DEPOSITO CHECK').matches).toBe(true);
    });
  });
});

describe('BatchDocumentMatcher - Multiple Rules', () => {
  describe('Adding Rules', () => {
    it('should add CONTAINS rule', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Padaria', 'PADARIA', 'CONTAINS', 10);
      expect(batch.getRuleCount()).toBe(1);
    });

    it('should add REGEX rule', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Groceries', 'PADARIA|SUPER', 'REGEX', 10);
      expect(batch.getRuleCount()).toBe(1);
    });

    it('should throw error for invalid rule', () => {
      const batch = new BatchDocumentMatcher();
      expect(() => batch.addRule('rule-001', 'Bad Regex', '[invalid(', 'REGEX', 10)).toThrow();
    });

    it('should sort rules by priority (highest first)', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Low Priority', 'A', 'CONTAINS', 5);
      batch.addRule('rule-002', 'High Priority', 'B', 'CONTAINS', 20);
      batch.addRule('rule-003', 'Medium Priority', 'C', 'CONTAINS', 10);

      const rules = batch.getRules();
      expect(rules[0].ruleName).toBe('High Priority'); // Priority 20
      expect(rules[1].ruleName).toBe('Medium Priority'); // Priority 10
      expect(rules[2].ruleName).toBe('Low Priority'); // Priority 5
    });

    it('should clear all rules', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Test', 'PATTERN', 'CONTAINS', 10);
      expect(batch.getRuleCount()).toBe(1);

      batch.clear();
      expect(batch.getRuleCount()).toBe(0);
    });
  });

  describe('Finding Matches', () => {
    it('should find first matching rule', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Padaria', 'PADARIA', 'CONTAINS', 10);
      batch.addRule('rule-002', 'Super', 'SUPER', 'CONTAINS', 5);

      const match = batch.findFirstMatch('PAGAMENTO PADARIA');
      expect(match).not.toBeNull();
      expect(match?.ruleName).toBe('Padaria');
    });

    it('should respect priority when finding first match', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Padaria', 'PADARIA', 'CONTAINS', 5);
      batch.addRule('rule-002', 'Generic', '.*', 'REGEX', 20);

      // Both match, but generic has higher priority
      const match = batch.findFirstMatch('PAGAMENTO PADARIA');
      expect(match?.ruleName).toBe('Generic');
    });

    it('should return null when no rules match', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Padaria', 'PADARIA', 'CONTAINS', 10);

      const match = batch.findFirstMatch('PAGAMENTO PIZZA');
      expect(match).toBeNull();
    });

    it('should find all matching rules', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Padaria', 'PADARIA', 'CONTAINS', 10);
      batch.addRule('rule-002', 'Grocery', 'CENTRO', 'CONTAINS', 5);
      batch.addRule('rule-003', 'Any', '.*', 'REGEX', 1);

      const matches = batch.findAllMatches('PADARIA CENTRO');
      expect(matches.length).toBe(3);
      expect(matches.some((m) => m.ruleName === 'Padaria')).toBe(true);
      expect(matches.some((m) => m.ruleName === 'Grocery')).toBe(true);
      expect(matches.some((m) => m.ruleName === 'Any')).toBe(true);
    });

    it('should test if any rule matches', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Padaria', 'PADARIA', 'CONTAINS', 10);

      expect(batch.hasMatch('PADARIA CENTRAL')).toBe(true);
      expect(batch.hasMatch('PIZZA')).toBe(false);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should classify real transaction with multiple rules', () => {
      const batch = new BatchDocumentMatcher();

      // Add a comprehensive ruleset
      batch.addRule('rule-001', 'Alimentação', 'PADARIA|SUPER|MERCEARIA', 'REGEX', 15);
      batch.addRule('rule-002', 'Salário', 'SALARIO|VENCIMENTO', 'REGEX', 20);
      batch.addRule('rule-003', 'Utilidades', 'AGUA|LUZ|GAS|INTERNET', 'REGEX', 10);
      batch.addRule('rule-004', 'Transporte', 'COMBUSTIVEL|UBER|TAXI', 'REGEX', 5);

      // Test various transactions
      expect(batch.findFirstMatch('PAGAMENTO PADARIA JOSÉ')?.ruleName).toBe('Alimentação');
      expect(batch.findFirstMatch('SALARIO JANEIRO')?.ruleName).toBe('Salário');
      expect(batch.findFirstMatch('FATURA AGUA')?.ruleName).toBe('Utilidades');
      expect(batch.findFirstMatch('UBER 5.00')?.ruleName).toBe('Transporte');
    });

    it('should handle overlapping patterns with priority', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Specific Grocery', 'PADARIA', 'CONTAINS', 20);
      batch.addRule('rule-002', 'General Grocery', 'PADARIA|SUPER', 'REGEX', 10);

      const match = batch.findFirstMatch('PADARIA CENTRAL');
      expect(match?.ruleName).toBe('Specific Grocery'); // Higher priority wins
    });

    it('should provide classification reasons', () => {
      const batch = new BatchDocumentMatcher();
      batch.addRule('rule-001', 'Padaria', 'PADARIA', 'CONTAINS', 10);

      const match = batch.findFirstMatch('PAGAMENTO PADARIA');
      expect(match?.reason).toBeDefined();
      expect(match?.reason).toContain('PADARIA');
    });
  });
});

describe('Utility Functions', () => {
  describe('normalizeDocumento', () => {
    it('should remove accents', () => {
      expect(normalizeDocumento('CAFÉ')).toBe('CAFE');
      expect(normalizeDocumento('JOSÉ')).toBe('JOSE');
      expect(normalizeDocumento('AÇÚCAR')).toBe('ACUCAR');
    });

    it('should convert to uppercase', () => {
      expect(normalizeDocumento('padaria')).toBe('PADARIA');
      expect(normalizeDocumento('PaDaRia')).toBe('PADARIA');
    });

    it('should preserve special characters', () => {
      expect(normalizeDocumento('PADARIA-001')).toBe('PADARIA-001');
      expect(normalizeDocumento('R$ 100,00')).toBe('R$ 100,00');
    });
  });

  describe('matchesContains', () => {
    it('should match substring', () => {
      expect(matchesContains('PAGAMENTO PADARIA', 'PADARIA')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(matchesContains('PADARIA', 'padaria')).toBe(true);
    });

    it('should be accent-insensitive', () => {
      expect(matchesContains('PADARIA JOSÉ', 'JOSE')).toBe(true);
    });

    it('should return false for non-match', () => {
      expect(matchesContains('PADARIA', 'PIZZA')).toBe(false);
    });
  });

  describe('matchesRegex', () => {
    it('should match regex pattern', () => {
      expect(matchesRegex('PADARIA CENTRAL', 'PADARIA')).toBe(true);
    });

    it('should be case-insensitive', () => {
      expect(matchesRegex('PADARIA', 'padaria')).toBe(true);
    });

    it('should handle alternation', () => {
      expect(matchesRegex('PADARIA', 'PADARIA|SUPER')).toBe(true);
      expect(matchesRegex('SUPERMERCADO', 'PADARIA|SUPER')).toBe(true);
    });

    it('should return false for invalid regex', () => {
      expect(matchesRegex('TEST', '[invalid(')).toBe(false);
    });

    it('should return false for non-match', () => {
      expect(matchesRegex('PADARIA', 'PIZZA')).toBe(false);
    });
  });
});
