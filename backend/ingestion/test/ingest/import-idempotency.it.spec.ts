/**
 * Integration tests for idempotent CSV import logic
 *
 * These are logic-level tests that verify deduplication logic
 * can work correctly. These test the dedup algorithm without requiring
 * Docker/Testcontainers.
 *
 * Production implementation will validate this logic in a full
 * integration test with PostgreSQL when running in CI/CD.
 */

import { parseCSVRow } from '../../src/ingest/csvParser';
import { createHash } from 'crypto';

/**
 * Simple CSV line parser (handles quoted values with commas)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      // Field separator
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current.trim());
  return result;
}

describe('Import Idempotency - Dedup Logic', () => {
  /**
   * Calculate SHA256 checksum for file content
   */
  function calculateFileChecksum(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  /**
   * Calculate row hash for deduplication
   */
  function calculateRowHash(date: Date, documento: string, amount: number): string {
    const rowContent = `${date.toISOString()}|${documento}|${amount}`;
    return createHash('sha256').update(rowContent).digest('hex');
  }

  // Sample CSV content (as string, as if uploaded)
  const csvContent = `Data,Documento,Valor
03/01/2025,TRANSF PADARIA,"100,50"
05/01/2025,PGTO CENTRAL,"125,00"
10/01/2025,SALÁRIO JANEIRO,"5000,00"
15/01/2025,DEPO CHECK,"2000,00"
20/01/2025,TAXA SAQUE,"(25,50)"`;

  const csvLines = csvContent.trim().split('\n');
  const dataRows = csvLines.slice(1); // Skip header

  it('first import creates all rows', () => {
    // Parse rows
    const parsedRows = dataRows.map((line) => {
      const cols = parseCSVLine(line);
      return parseCSVRow(cols);
    });

    expect(parsedRows).toHaveLength(5);

    // Verify all amounts are parsed correctly
    expect(parsedRows[0].amount).toBe(100.5);
    expect(parsedRows[1].amount).toBe(125);
    expect(parsedRows[2].amount).toBe(5000);
    expect(parsedRows[3].amount).toBe(2000);
    expect(parsedRows[4].amount).toBe(-25.5); // Parentheses → negative
  });

  it('re-import of same CSV would produce zero new rows (idempotent)', () => {
    // Simulate import 1: Parse rows and create hashes
    const parsedRows = dataRows.map((line) => {
      const cols = parseCSVLine(line);
      return parseCSVRow(cols);
    });

    const rowHashes1 = parsedRows.map((row) =>
      calculateRowHash(row.date, row.documento, row.amount)
    );

    // Simulate import 2: Parse same CSV again
    const parsedRows2 = dataRows.map((line) => {
      const cols = parseCSVLine(line);
      return parseCSVRow(cols);
    });

    const rowHashes2 = parsedRows2.map((row) =>
      calculateRowHash(row.date, row.documento, row.amount)
    );

    // Check that all hashes are identical (no new rows)
    expect(rowHashes1).toEqual(rowHashes2);
    expect(rowHashes1).toHaveLength(5);

    // Verify all rows would be skipped during re-import
    const newRowsDetected = rowHashes2.filter((hash) => !rowHashes1.includes(hash)).length;
    expect(newRowsDetected).toBe(0);
  });

  it('re-import with one new row detects exactly 1 new row', () => {
    // Simulate import 1: Parse rows and create hashes
    const parsedRows = dataRows.map((line) => {
      const cols = parseCSVLine(line);
      return parseCSVRow(cols);
    });

    const rowHashes1 = new Set(
      parsedRows.map((row) => calculateRowHash(row.date, row.documento, row.amount))
    );

    // Modify CSV to add one new row
    const newCsvContent = `Data,Documento,Valor
03/01/2025,TRANSF PADARIA,"100,50"
05/01/2025,PGTO CENTRAL,"125,00"
10/01/2025,SALÁRIO JANEIRO,"5000,00"
15/01/2025,DEPO CHECK,"2000,00"
20/01/2025,TAXA SAQUE,"(25,50)"
25/01/2025,BONUS EXTRA,"1500,00"`;

    const newCsvLines = newCsvContent.trim().split('\n');
    const newDataRows = newCsvLines.slice(1);

    // Simulate import 2: Parse modified CSV
    const parsedRows2 = newDataRows.map((line) => {
      const cols = parseCSVLine(line);
      return parseCSVRow(cols);
    });

    const rowHashes2 = parsedRows2.map((row) =>
      calculateRowHash(row.date, row.documento, row.amount)
    );

    // Count new rows
    const newRows = rowHashes2.filter((hash) => !rowHashes1.has(hash));
    expect(newRows).toHaveLength(1);

    // Verify the new row is the BONUS EXTRA
    expect(parsedRows2[5].documento).toBe('BONUS EXTRA');
    expect(parsedRows2[5].amount).toBe(1500);
  });

  it('dedup works on checksum + row hash', () => {
    const fileChecksum1 = calculateFileChecksum(csvContent);
    const fileChecksum2 = calculateFileChecksum(csvContent);

    // Same content → same checksum
    expect(fileChecksum1).toBe(fileChecksum2);

    // Different content → different checksum
    const differentCsv = csvContent + '\n25/01/2025,EXTRA,100,00';
    const fileChecksum3 = calculateFileChecksum(differentCsv);
    expect(fileChecksum1).not.toBe(fileChecksum3);
  });

  it('handles amounts correctly including negatives from parentheses', () => {
    const parsedRows = dataRows.map((line) => {
      const cols = parseCSVLine(line);
      return parseCSVRow(cols);
    });

    // Find the negative amount row
    const negativeRow = parsedRows.find((r) => r.amount < 0);
    expect(negativeRow).toBeDefined();
    expect(negativeRow!.amount).toBe(-25.5);
    expect(negativeRow!.documento).toBe('TAXA SAQUE');
  });

  it('handles normalized documento values', () => {
    const parsedRows = dataRows.map((line) => {
      const cols = parseCSVLine(line);
      return parseCSVRow(cols);
    });

    // All should be uppercase
    for (const row of parsedRows) {
      expect(row.documento).toBe(row.documento.toUpperCase());
    }

    // Verify no extra spaces
    for (const row of parsedRows) {
      expect(row.documento).not.toMatch(/  /); // No double spaces
    }
  });

  it('correctly identifies duplicate row with minor variation', () => {
    // Parse original row
    const originalCols = ['03/01/2025', 'TRANSF PADARIA', '100,50'];
    const originalRow = parseCSVRow(originalCols);
    const originalHash = calculateRowHash(
      originalRow.date,
      originalRow.documento,
      originalRow.amount
    );

    // Parse similar row with space variation
    const spaceVariationCols = ['03/01/2025', '  TRANSF   PADARIA  ', ' 100,50 '];
    const spaceRow = parseCSVRow(spaceVariationCols);
    const spaceHash = calculateRowHash(spaceRow.date, spaceRow.documento, spaceRow.amount);

    // Should be same after normalization
    expect(originalHash).toBe(spaceHash);
  });

  it('distinguishes rows with different amounts', () => {
    // Two rows with same date and documento but different amounts
    const row1Cols = ['03/01/2025', 'TRANSF PADARIA', '100,50'];
    const row1 = parseCSVRow(row1Cols);
    const hash1 = calculateRowHash(row1.date, row1.documento, row1.amount);

    const row2Cols = ['03/01/2025', 'TRANSF PADARIA', '100,55'];
    const row2 = parseCSVRow(row2Cols);
    const hash2 = calculateRowHash(row2.date, row2.documento, row2.amount);

    // Should be different hashes
    expect(hash1).not.toBe(hash2);
  });

  it('distinguishes rows with different dates', () => {
    // Two rows with same documento/amount but different dates
    const row1Cols = ['03/01/2025', 'TRANSF PADARIA', '100,50'];
    const row1 = parseCSVRow(row1Cols);
    const hash1 = calculateRowHash(row1.date, row1.documento, row1.amount);

    const row2Cols = ['04/01/2025', 'TRANSF PADARIA', '100,50'];
    const row2 = parseCSVRow(row2Cols);
    const hash2 = calculateRowHash(row2.date, row2.documento, row2.amount);

    // Should be different hashes
    expect(hash1).not.toBe(hash2);
  });
});
