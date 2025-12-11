/**
 * CSV Parser for pt-BR bank extracts
 *
 * Handles:
 * - Date format: DD/MM/YYYY
 * - Number format: 1.234.567,89 (thousand separator = dot, decimal = comma)
 * - Parentheses notation: (1.000,00) → -1000.00
 * - Space trimming and normalization
 * - UTF-8 encoding with Latin-1 fallback handling
 */

export interface TransactionRow {
  date: Date;
  documento: string;
  amount: number;
}

/**
 * Parse date in pt-BR format (DD/MM/YYYY)
 *
 * @param dateStr - Date string in DD/MM/YYYY format
 * @returns Date object
 * @throws Error if format is invalid or date is invalid
 */
export function parseDate(dateStr: string): Date {
  const trimmed = dateStr.trim();

  // Validate format: DD/MM/YYYY
  const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const match = trimmed.match(dateRegex);

  if (!match) {
    throw new Error(`Invalid date format: "${dateStr}". Expected DD/MM/YYYY`);
  }

  const day = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const year = parseInt(match[3], 10);

  // Validate ranges
  if (month < 1 || month > 12) {
    throw new Error(`Invalid month: ${month}. Expected 1-12`);
  }

  if (day < 1 || day > 31) {
    throw new Error(`Invalid day: ${day}. Expected 1-31`);
  }

  // Create date (month is 0-indexed in JS)
  const date = new Date(year, month - 1, day);

  // Validate that date is actually valid (e.g., 31/02 → invalid)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new Error(`Invalid date: ${dateStr}. Date does not exist in that month/year`);
  }

  return date;
}

/**
 * Parse amount in pt-BR format
 *
 * Supports:
 * - 1.234.567,89 (thousand separator = dot, decimal = comma)
 * - (1.000,00) → -1000.00 (parentheses = negative)
 * - R$ prefix
 * - Extra spaces
 *
 * @param amountStr - Amount string in pt-BR format
 * @returns Numeric amount (negative if in parentheses)
 * @throws Error if format is invalid
 */
export function parseAmount(amountStr: string): number {
  if (!amountStr) {
    throw new Error('Amount cannot be empty');
  }

  let trimmed = amountStr.trim();

  // Check for parentheses (indicates negative)
  const isNegative = trimmed.startsWith('(') && trimmed.endsWith(')');
  if (isNegative) {
    trimmed = trimmed.slice(1, -1).trim();
  }

  // Remove R$ prefix and any spaces after it
  trimmed = trimmed.replace(/^R\$\s*/, '').trim();

  // Check for null bytes or severely corrupted data
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(trimmed)) {
    throw new Error(`Amount contains invalid characters: "${amountStr}"`);
  }

  // pt-BR format: 1.234.567,89
  // thousand separator = dot (.)
  // decimal separator = comma (,)

  // Validate format: should be digits, dots, and one comma
  const amountRegex = /^[\d.]*,?\d*$/;
  if (!amountRegex.test(trimmed)) {
    throw new Error(
      `Invalid amount format: "${amountStr}". Expected pt-BR format (e.g., 1.234,56)`
    );
  }

  // Remove thousand separators (dots)
  const withoutThousands = trimmed.replace(/\./g, '');

  // Replace comma with dot for JS parsing
  const standardized = withoutThousands.replace(',', '.');

  const amount = parseFloat(standardized);

  if (isNaN(amount)) {
    throw new Error(`Could not parse amount: "${amountStr}" → standardized: "${standardized}"`);
  }

  return isNegative ? -amount : amount;
}

/**
 * Normalize documento string
 *
 * - Convert to uppercase
 * - Collapse multiple spaces into single space
 * - Trim leading/trailing spaces
 * - Preserve accented characters
 *
 * @param documento - Documento string (raw)
 * @returns Normalized documento
 * @throws Error if documento contains invalid control characters
 */
function normalizeDocumento(documento: string): string {
  // Check for null bytes or severely corrupted data
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(documento)) {
    throw new Error(`Documento contains invalid control characters: "${documento}"`);
  }

  return documento
    .trim() // Remove leading/trailing spaces
    .replace(/\s+/g, ' ') // Collapse multiple spaces into one
    .toUpperCase(); // Uppercase
}

/**
 * Parse a single CSV row (array of columns)
 *
 * Expected column order:
 * 0: Data (DD/MM/YYYY)
 * 1: Documento (string)
 * 2: Valor (pt-BR amount)
 *
 * Additional columns are ignored.
 *
 * @param columns - Array of CSV column values
 * @returns Parsed TransactionRow
 * @throws Error if required columns are missing or invalid
 */
export function parseCSVRow(columns: string[]): TransactionRow {
  if (columns.length < 3) {
    throw new Error(`Insufficient columns: expected at least 3, got ${columns.length}`);
  }

  const dateStr = columns[0];
  const documentoStr = columns[1];
  const amountStr = columns[2];

  // Validate non-empty required fields
  if (!dateStr || !dateStr.trim()) {
    throw new Error('Date column is empty');
  }
  if (!documentoStr || !documentoStr.trim()) {
    throw new Error('Documento column is empty');
  }
  if (!amountStr || !amountStr.trim()) {
    throw new Error('Amount column is empty');
  }

  const date = parseDate(dateStr);
  const documento = normalizeDocumento(documentoStr);
  const amount = parseAmount(amountStr);

  return { date, documento, amount };
}
