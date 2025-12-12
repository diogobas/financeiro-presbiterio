import { parseCSVRow, parseDate, parseAmount } from '../../src/ingest/csvParser';

describe('CSVParser - Date Parsing (pt-BR DD/MM/YYYY)', () => {
  it('parses valid date in DD/MM/YYYY format', () => {
    const date = parseDate('03/01/2025');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(0); // January (0-indexed)
    expect(date.getDate()).toBe(3);
  });

  it('parses end-of-month date', () => {
    const date = parseDate('31/12/2024');
    expect(date.getFullYear()).toBe(2024);
    expect(date.getMonth()).toBe(11); // December
    expect(date.getDate()).toBe(31);
  });

  it('parses first day of year', () => {
    const date = parseDate('01/01/2025');
    expect(date.getFullYear()).toBe(2025);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(1);
  });

  it('throws error for invalid date format', () => {
    expect(() => parseDate('2025-01-03')).toThrow();
  });

  it('throws error for invalid month', () => {
    expect(() => parseDate('03/13/2025')).toThrow();
  });

  it('throws error for invalid day', () => {
    expect(() => parseDate('32/01/2025')).toThrow();
  });

  it('handles date with leading/trailing spaces', () => {
    const date = parseDate('  03/01/2025  ');
    expect(date.getDate()).toBe(3);
  });

  it('throws error for missing date parts', () => {
    expect(() => parseDate('03/01')).toThrow();
  });
});

describe('CSVParser - Amount Parsing (pt-BR format)', () => {
  it('parses simple amount with comma decimal', () => {
    const amount = parseAmount('1.000,50');
    expect(amount).toBe(1000.5);
  });

  it('parses amount with thousand separators', () => {
    const amount = parseAmount('2.000,00');
    expect(amount).toBe(2000.0);
  });

  it('parses amount with multiple thousand separators', () => {
    const amount = parseAmount('1.234.567,89');
    expect(amount).toBe(1234567.89);
  });

  it('parses small amount with comma decimal', () => {
    const amount = parseAmount('10,50');
    expect(amount).toBe(10.5);
  });

  it('parses zero amount', () => {
    const amount = parseAmount('0,00');
    expect(amount).toBe(0);
  });

  it('parses amount with currency prefix (R$)', () => {
    const amount = parseAmount('R$ 2.000,00');
    expect(amount).toBe(2000.0);
  });

  it('parses amount with spaces after currency', () => {
    const amount = parseAmount('R$2.000,00 ');
    expect(amount).toBe(2000.0);
  });

  it('parses amount with no thousand separator', () => {
    const amount = parseAmount('500,00');
    expect(amount).toBe(500);
  });

  it('converts parentheses notation to negative', () => {
    const amount = parseAmount('(1.000,00)');
    expect(amount).toBe(-1000.0);
  });

  it('converts parentheses with currency prefix', () => {
    const amount = parseAmount('(R$ 2.000,00)');
    expect(amount).toBe(-2000.0);
  });

  it('converts parentheses with spaces', () => {
    const amount = parseAmount('  (1.000,00)  ');
    expect(amount).toBe(-1000.0);
  });

  it('throws error for invalid format', () => {
    expect(() => parseAmount('invalid')).toThrow();
  });

  it('throws error for empty string', () => {
    expect(() => parseAmount('')).toThrow();
  });

  it('preserves precision for decimal amounts', () => {
    const amount = parseAmount('123,45');
    expect(amount).toBeCloseTo(123.45, 2);
  });
});

describe('CSVParser - Row Parsing', () => {
  it('parses valid CSV row with all required columns', () => {
    const row = parseCSVRow(['03/01/2025', 'DESCRIÇÃO', 'TRANSF PADARIA', '100,50']);
    expect(row.date.getDate()).toBe(3);
    expect(row.documento).toBe('TRANSF PADARIA');
    expect(row.amount).toBe(100.5);
  });

  it('normalizes documento to uppercase', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', 'transf padaria', '100,50']);
    expect(row.documento).toBe('TRANSF PADARIA');
  });

  it('normalizes documento removing extra spaces', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', '  TRANSF   PADARIA  ', '100,50']);
    expect(row.documento).toBe('TRANSF PADARIA');
  });

  it('trims spaces from all fields', () => {
    const row = parseCSVRow(['  03/01/2025  ', '  DESC  ', '  TRANSF  ', '  100,50  ']);
    expect(row.date.getDate()).toBe(3);
    expect(row.documento).toBe('TRANSF');
    expect(row.amount).toBe(100.5);
  });

  it('handles negative amounts from parentheses', () => {
    const row = parseCSVRow(['03/01/2025', 'DESCRIPTION', 'DESPESA', '(1.000,00)']);
    expect(row.amount).toBe(-1000.0);
  });

  it('preserves positive amount', () => {
    const row = parseCSVRow(['03/01/2025', 'DESCRIPTION', 'RECEITA', '1.000,00']);
    expect(row.amount).toBe(1000.0);
  });

  it('handles special characters in documento', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', 'PGTO PADARIA JOSÉ-CENTRAL', '100,00']);
    expect(row.documento).toContain('JOSÉ');
  });

  it('throws error for missing date', () => {
    expect(() => parseCSVRow(['', 'DESC', 'TRANSF', '100,00'])).toThrow();
  });

  it('throws error for missing documento', () => {
    expect(() => parseCSVRow(['03/01/2025', 'DESC', '', '100,00'])).toThrow();
  });

  it('throws error for missing amount', () => {
    expect(() => parseCSVRow(['03/01/2025', 'DESC', 'TRANSF', ''])).toThrow();
  });

  it('throws error for insufficient columns', () => {
    expect(() => parseCSVRow(['03/01/2025', 'DESC', 'TRANSF'])).toThrow();
  });

  it('ignores extra columns beyond Data, Documento, Valor', () => {
    const row = parseCSVRow([
      '03/01/2025',
      'DESC',
      'TRANSF',
      '100,50',
      'R$ 100,50',
      'Saldo anterior',
      'Extra',
    ]);
    expect(row.date).toBeDefined();
    expect(row.documento).toBe('TRANSF');
    expect(row.amount).toBe(100.5);
  });
});

describe('CSVParser - Accent Folding', () => {
  it('preserves accented characters in documento', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', 'CAFÉ JOSÉ', '100,00']);
    expect(row.documento).toBe('CAFÉ JOSÉ');
  });

  it('handles tilde (ã, õ) in documento', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', 'AÇÃO PÚBLICA', '100,00']);
    expect(row.documento).toBe('AÇÃO PÚBLICA');
  });

  it('handles cedilla (ç) in documento', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', 'AÇÚCAR LTDA', '100,00']);
    expect(row.documento).toBe('AÇÚCAR LTDA');
  });
});

describe('CSVParser - Encoding Edge Cases', () => {
  it('handles UTF-8 encoded strings', () => {
    const utf8String = Buffer.from('PADARIA JOSÉ', 'utf8').toString('utf8');
    const row = parseCSVRow(['03/01/2025', 'DESC', utf8String, '100,00']);
    expect(row.documento).toContain('JOSÉ');
  });

  it('throws error for completely invalid encoding', () => {
    // Test with null bytes or severely corrupted data
    expect(() => parseCSVRow(['03/01/2025', 'DESC', '\x00\x01', '100,00'])).toThrow();
  });
});

describe('CSVParser - Export Types', () => {
  it('returns object with correct structure', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', 'TRANSF', '100,50']);
    expect(row).toHaveProperty('date');
    expect(row).toHaveProperty('documento');
    expect(row).toHaveProperty('amount');
  });

  it('date is a Date object', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', 'TRANSF', '100,50']);
    expect(row.date instanceof Date).toBe(true);
  });

  it('amount is a number', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', 'TRANSF', '100,50']);
    expect(typeof row.amount).toBe('number');
  });

  it('documento is a string', () => {
    const row = parseCSVRow(['03/01/2025', 'DESC', 'TRANSF', '100,50']);
    expect(typeof row.documento).toBe('string');
  });
});

describe('CSVParser - Real-World Examples', () => {
  it('parses real bank CSV line 1', () => {
    const row = parseCSVRow(['03/01/2025', 'TRANSF ENTRE CONTAS', '239...', 'R$ 2.000,00 ']);
    expect(row.date.getDate()).toBe(3);
    expect(row.documento).toBe('239...');
    expect(row.amount).toBe(2000);
  });

  it('parses real bank CSV line 2 - with negative in parentheses', () => {
    const row = parseCSVRow(['05/01/2025', 'PAGAMENTO', 'PADARIA CENTRAL', '(125,50)']);
    expect(row.date.getDate()).toBe(5);
    expect(row.documento).toBe('PADARIA CENTRAL');
    expect(row.amount).toBe(-125.5);
  });

  it('parses real bank CSV line 3 - with spaces and prefix', () => {
    const row = parseCSVRow([
      '  10/01/2025  ',
      '  DEPOSITO  ',
      '  CHECK 1234  ',
      '  R$ 5.000,00  ',
    ]);
    expect(row.date.getDate()).toBe(10);
    expect(row.documento).toBe('CHECK 1234');
    expect(row.amount).toBe(5000);
  });

  it('parses real bank CSV line 4 - large amount', () => {
    const row = parseCSVRow(['15/01/2025', 'SALÁRIO', 'JANEIRO', 'R$ 12.345,67']);
    expect(row.amount).toBe(12345.67);
  });

  it('parses real bank CSV line 5 - zero amount', () => {
    const row = parseCSVRow(['20/01/2025', 'TAXA', 'SAQUE', '0,00']);
    expect(row.amount).toBe(0);
  });
});
