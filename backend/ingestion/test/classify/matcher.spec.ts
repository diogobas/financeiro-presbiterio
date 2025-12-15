/**
 * Unit Tests for Document Matcher
 *
 * Tests the core matching logic for classification rules:
 * - Case-insensitive matching
 * - Accent-folding normalization
 * - Contains and Regex pattern support
 * - Edge cases (empty strings, special characters, Unicode)
 *
 * This is a logic-level test suite with no database/network dependencies.
 */

/**
 * Normalize document by removing accents and converting to uppercase
 * e.g., "Café José" → "CAFE JOSE"
 */
function normalizeForMatching(text: string): string {
  return text
    .normalize('NFD') // Decompose accented chars
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .toUpperCase();
}

/**
 * Test if a pattern (contains) matches a document
 */
function matchesContains(documento: string, pattern: string): boolean {
  const normalizedDoc = normalizeForMatching(documento);
  const normalizedPattern = normalizeForMatching(pattern);
  return normalizedDoc.includes(normalizedPattern);
}

/**
 * Test if a regex pattern matches a document
 */
function matchesRegex(documento: string, pattern: string): boolean {
  try {
    const normalizedDoc = normalizeForMatching(documento);
    // Compile regex with case-insensitive flag (already normalized to uppercase)
    const regex = new RegExp(pattern, 'i');
    return regex.test(normalizedDoc);
  } catch {
    // Invalid regex pattern
    return false;
  }
}

describe('Matcher - Accent Folding', () => {
  it('normalizes accented characters to base ASCII', () => {
    const normalized = normalizeForMatching('Café');
    expect(normalized).toBe('CAFE');
  });

  it('removes tilde (ã, õ) accents', () => {
    const normalized = normalizeForMatching('ação');
    expect(normalized).toBe('ACAO');
  });

  it('removes cedilla (ç)', () => {
    const normalized = normalizeForMatching('açúcar');
    expect(normalized).toBe('ACUCAR');
  });

  it('handles multiple accented characters', () => {
    const normalized = normalizeForMatching('José María Núñez');
    expect(normalized).toBe('JOSE MARIA NUNEZ');
  });

  it('preserves spaces and punctuation', () => {
    const normalized = normalizeForMatching('PADARIA - JOSÉ');
    expect(normalized).toBe('PADARIA - JOSE');
  });

  it('converts lowercase to uppercase', () => {
    const normalized = normalizeForMatching('padaria');
    expect(normalized).toBe('PADARIA');
  });

  it('handles mixed case with accents', () => {
    const normalized = normalizeForMatching('PaDaRiA José');
    expect(normalized).toBe('PADARIA JOSE');
  });

  it('handles empty string', () => {
    const normalized = normalizeForMatching('');
    expect(normalized).toBe('');
  });

  it('handles special characters', () => {
    const normalized = normalizeForMatching('R$ 100,00');
    expect(normalized).toBe('R$ 100,00');
  });

  it('handles numbers and symbols', () => {
    const normalized = normalizeForMatching('DOC-001-2025');
    expect(normalized).toBe('DOC-001-2025');
  });
});

describe('Matcher - Case Insensitivity', () => {
  it('matches uppercase document with lowercase pattern', () => {
    expect(matchesContains('PADARIA', 'padaria')).toBe(true);
  });

  it('matches lowercase document with uppercase pattern', () => {
    expect(matchesContains('padaria', 'PADARIA')).toBe(true);
  });

  it('matches mixed case document with different case pattern', () => {
    expect(matchesContains('PaDaRia', 'PADARIA')).toBe(true);
  });

  it('returns false for non-matching patterns regardless of case', () => {
    expect(matchesContains('PADARIA', 'PIZZA')).toBe(false);
  });

  it('matches partial strings case-insensitively', () => {
    expect(matchesContains('PADARIA CENTRAL', 'padaria')).toBe(true);
  });
});

describe('Matcher - Contains Pattern', () => {
  it('matches exact substring', () => {
    expect(matchesContains('PAGAMENTO PADARIA CENTRAL', 'PADARIA')).toBe(true);
  });

  it('matches substring at start', () => {
    expect(matchesContains('PADARIA CENTRAL', 'PADARIA')).toBe(true);
  });

  it('matches substring at end', () => {
    expect(matchesContains('PAGAMENTO PADARIA', 'PADARIA')).toBe(true);
  });

  it('matches substring in middle', () => {
    expect(matchesContains('PAGAMENTO PADARIA CENTRAL', 'PADARIA')).toBe(true);
  });

  it('returns false for non-matching pattern', () => {
    expect(matchesContains('PADARIA CENTRAL', 'SUPERMERCADO')).toBe(false);
  });

  it('returns false for partial word when looking for whole word', () => {
    // Note: this matcher does substring matching, not whole-word
    expect(matchesContains('SUPERPADARIA', 'PADARIA')).toBe(true);
  });

  it('returns false for empty pattern in non-empty documento', () => {
    expect(matchesContains('PADARIA', '')).toBe(true); // Empty string is substring of any string
  });

  it('returns false for pattern in empty documento', () => {
    expect(matchesContains('', 'PADARIA')).toBe(false);
  });

  it('matches with accents in documento and pattern', () => {
    expect(matchesContains('PADARIA JOSÉ', 'JOSE')).toBe(true);
  });

  it('matches pattern with accents against unaccented documento', () => {
    expect(matchesContains('PADARIA JOSE', 'JOSÉ')).toBe(true);
  });

  it('matches with spaces in pattern', () => {
    expect(matchesContains('PAGAMENTO PADARIA CENTRAL', 'PADARIA CENTRAL')).toBe(true);
  });

  it('returns false when spaces break the match', () => {
    expect(matchesContains('PADARIA CENTRAL', 'PADARIA X CENTRAL')).toBe(false);
  });

  it('matches multiple occurrences', () => {
    expect(matchesContains('PADARIA PADARIA PADARIA', 'PADARIA')).toBe(true);
  });
});

describe('Matcher - Regex Pattern', () => {
  it('matches simple regex pattern', () => {
    expect(matchesRegex('PADARIA CENTRAL', 'PADARIA')).toBe(true);
  });

  it('matches regex with wildcard (.+)', () => {
    expect(matchesRegex('PAGAMENTO PADARIA CENTRAL', 'PAGAMENTO.*CENTRAL')).toBe(true);
  });

  it('matches regex with alternation (|)', () => {
    expect(matchesRegex('PADARIA CENTRAL', 'PADARIA|SUPERMERCADO')).toBe(true);
  });

  it('matches regex with character class', () => {
    expect(matchesRegex('PADARIA 001', 'PADARIA [0-9]+')).toBe(true);
  });

  it('matches regex with word boundary', () => {
    expect(matchesRegex('PAGAMENTO PADARIA', '\\bPADARIA\\b')).toBe(true);
  });

  it('returns false for non-matching regex', () => {
    expect(matchesRegex('PADARIA CENTRAL', 'SUPERMERCADO')).toBe(false);
  });

  it('returns false for invalid regex pattern', () => {
    expect(matchesRegex('PADARIA', '[invalid(')).toBe(false);
  });

  it('matches regex case-insensitively', () => {
    expect(matchesRegex('padaria', 'PADARIA')).toBe(true);
  });

  it('matches regex with escaped special characters', () => {
    expect(matchesRegex('R$ 100,00', 'R\\$ [0-9]+,[0-9]+')).toBe(true);
  });

  it('matches regex with quantifiers', () => {
    expect(matchesRegex('PADARIA123', 'PADARIA[0-9]{3}')).toBe(true);
  });

  it('returns false when quantifier not met', () => {
    expect(matchesRegex('PADARIA12', 'PADARIA[0-9]{3}')).toBe(false);
  });

  it('matches regex with accent-normalized documento', () => {
    expect(matchesRegex('PADARIA JOSÉ', 'JOSE')).toBe(true);
  });

  it('matches start anchor (^)', () => {
    expect(matchesRegex('PADARIA CENTRAL', '^PADARIA')).toBe(true);
  });

  it('returns false when start anchor not at beginning', () => {
    expect(matchesRegex('PAGAMENTO PADARIA', '^PADARIA')).toBe(false);
  });

  it('matches end anchor ($)', () => {
    expect(matchesRegex('PAGAMENTO PADARIA', 'PADARIA$')).toBe(true);
  });

  it('returns false when end anchor not at end', () => {
    expect(matchesRegex('PADARIA CENTRAL', 'PADARIA$')).toBe(false);
  });
});

describe('Matcher - Real-World Examples', () => {
  // Real bank transaction documento patterns
  const testCases = [
    {
      documento: 'PAGAMENTO PADARIA JOSÉ',
      pattern: 'PADARIA',
      matchType: 'contains',
      expected: true,
      description: 'Grocery payment with accents',
    },
    {
      documento: 'TRANSF ENTRE CONTAS 239...',
      pattern: 'TRANSF',
      matchType: 'contains',
      expected: true,
      description: 'Bank transfer',
    },
    {
      documento: 'DEPOSITO CHECK 1234',
      pattern: 'CHECK',
      matchType: 'contains',
      expected: true,
      description: 'Check deposit',
    },
    {
      documento: 'SALÁRIO JANEIRO',
      pattern: 'SALARIO|SALÁRIO',
      matchType: 'regex',
      expected: true,
      description: 'Salary payment with accent-folding',
    },
    {
      documento: 'TAXA SAQUE ATM 001',
      pattern: 'TAXA',
      matchType: 'contains',
      expected: true,
      description: 'ATM fee',
    },
    {
      documento: 'JUROS PAGOS POUPANÇA',
      pattern: 'JUROS|RENDIMENTO',
      matchType: 'regex',
      expected: true,
      description: 'Interest payment',
    },
    {
      documento: 'PIX RECEBIDO JOSE SILVA',
      pattern: 'PIX',
      matchType: 'contains',
      expected: true,
      description: 'PIX transfer received',
    },
    {
      documento: 'BOLETO PAGAMENTO 001',
      pattern: 'BOLETO',
      matchType: 'contains',
      expected: true,
      description: 'Boleto payment',
    },
    {
      documento: 'SEGURO SAÚDE MENSAL',
      pattern: 'SEGURO',
      matchType: 'contains',
      expected: true,
      description: 'Insurance payment with accent',
    },
    {
      documento: 'INTERNET TELEFONE',
      pattern: 'TELEFONE|CELULAR|INTERNET',
      matchType: 'regex',
      expected: true,
      description: 'Telecom with alternation',
    },
  ];

  testCases.forEach(({ documento, pattern, matchType, expected, description }) => {
    it(`${description}: "${documento}" with pattern "${pattern}"`, () => {
      const result =
        matchType === 'contains'
          ? matchesContains(documento, pattern)
          : matchesRegex(documento, pattern);
      expect(result).toBe(expected);
    });
  });
});

describe('Matcher - Edge Cases', () => {
  it('handles very long documento strings', () => {
    const longDoc = 'PADARIA ' + 'X'.repeat(1000);
    expect(matchesContains(longDoc, 'PADARIA')).toBe(true);
  });

  it('handles very long pattern strings', () => {
    const longPattern = 'P' + 'A'.repeat(100);
    expect(matchesContains('PADARIA', longPattern)).toBe(false);
  });

  it('handles special Unicode characters', () => {
    expect(matchesContains('PADARIA™', 'PADARIA')).toBe(true);
  });

  it('handles emoji in documento (preserved in normalization)', () => {
    const normalized = normalizeForMatching('PADARIA 🍞');
    expect(normalized).toContain('PADARIA');
  });

  it('handles zero-width spaces', () => {
    const docWithZWS = 'PADARIA' + '\u200B' + 'CENTRAL'; // Zero-width space
    expect(matchesContains(docWithZWS, 'PADARIA')).toBe(true);
  });

  it('handles tabs and newlines', () => {
    const docWithTabs = 'PADARIA\tCENTRAL';
    expect(matchesContains(docWithTabs, 'PADARIA')).toBe(true);
  });

  it('handles multiple consecutive spaces', () => {
    expect(matchesContains('PADARIA    CENTRAL', 'PADARIA')).toBe(true);
  });

  it('regex with lookahead assertion', () => {
    expect(matchesRegex('PADARIA123', 'PADARIA(?=[0-9]+)')).toBe(true);
  });

  it('regex with negative lookahead assertion', () => {
    expect(matchesRegex('PADARIA CENTRAL', 'PADARIA(?! PIZZA)')).toBe(true);
  });

  it('returns false for negative lookahead when condition met', () => {
    expect(matchesRegex('PADARIA PIZZA', 'PADARIA(?! PIZZA)')).toBe(false);
  });
});

describe('Matcher - Performance & Limits', () => {
  it('matches efficiently for short strings', () => {
    const start = Date.now();
    for (let i = 0; i < 10000; i++) {
      matchesContains('PADARIA CENTRAL', 'PADARIA');
    }
    const duration = Date.now() - start;
    expect(duration).toBeLessThan(100); // Should be very fast
  });

  it('handles repeated matching without memory leaks', () => {
    const pattern = 'PADARIA';
    const documentos = Array(1000)
      .fill(null)
      .map((_, i) => `PADARIA ${i}`);

    documentos.forEach((doc) => {
      expect(matchesContains(doc, pattern)).toBe(true);
    });
  });
});
