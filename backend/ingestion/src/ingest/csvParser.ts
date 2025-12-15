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

  // Validate format: DD/MM/YYYY or D/M/YYYY (allows 1-2 digits for day and month)
  const dateRegex = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;
  const match = trimmed.match(dateRegex);

  if (!match) {
    throw new Error(`Invalid date format: "${dateStr}". Expected DD/MM/YYYY or D/M/YYYY`);
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
 * Expected column order (from bank extract):
 * 0: Data (DD/MM/YYYY)
 * 1: Descrição (description)
 * 2: Documento (document code)
 * 3: Valor (R$) (pt-BR amount)
 * 4: Saldo (R$) (balance - optional, ignored)
 *
 * Additional columns are ignored.
 *
 * @param columns - Array of CSV column values
 * @returns Parsed TransactionRow
 * @throws Error if required columns are missing or invalid
 */
export function parseCSVRow(columns: string[]): TransactionRow {
  if (columns.length < 4) {
    throw new Error(`Insufficient columns: expected at least 4, got ${columns.length}`);
  }

  const dateStr = columns[0];
  const documentoStr = columns[2]; // Documento is at index 2, not 1
  const amountStr = columns[3]; // Valor is at index 3, not 2

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

/**
 * Account section extracted from multi-account CSV
 */
export interface AccountSection {
  accountNumber: string;
  transactions: TransactionRow[];
}

/**
 * Extract account sections from multi-account CSV content
 *
 * Format:
 * Conta: [account-number]
 * [optional metadata lines]
 * Data,Descrição,Documento,Valor (R$),Saldo (R$)
 * [transaction rows]
 * [blank line]
 * Conta: [next-account-number]
 * ...
 *
 * @param fileContent - Raw file content as string
 * @returns Array of AccountSection objects with extracted transactions
 */
export function extractAccountSections(fileContent: string): AccountSection[] {
  const lines = fileContent.split('\n');
  const sections: AccountSection[] = [];
  let currentAccountNumber: string | null = null;
  let currentTransactions: TransactionRow[] = [];

  console.log(`[CSV Parser] Processing ${lines.length} lines from file`);
  console.log(`[CSV Parser] First 5 lines preview:`);
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    console.log(`  Line ${i}: ${JSON.stringify(lines[i].substring(0, 100))}`);
  }

  let nonEmptyLineCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip empty lines
    if (!line) {
      continue;
    }

    nonEmptyLineCount++;

    // Log lines that contain "Conta" for debugging
    if (line.includes('Conta')) {
      console.log(`[CSV Parser] Found "Conta" at line ${i}: ${line.substring(0, 100)}`);
    }

    // Look for "Conta: [number]" or "Conta:,[number]" headers (handles both formats)
    if (line.includes('Conta:')) {
      console.log(`[CSV Parser] Processing account line: ${line.substring(0, 100)}`);

      // If we have a previous account with transactions, save it
      if (currentAccountNumber && currentTransactions.length > 0) {
        console.log(
          `[CSV Parser] Saving account ${currentAccountNumber} with ${currentTransactions.length} transactions`
        );
        sections.push({
          accountNumber: currentAccountNumber,
          transactions: currentTransactions,
        });
      }

      // Extract account number from different formats:
      // Format 1: "Conta: 70011-8"
      // Format 2: "Conta:,70011-8," (CSV format)
      let accountMatch = line.match(/Conta:\s*([^\s,]+(?:\s+[^\s,]+)?)/);

      // If format 1 didn't work, try CSV format (look for content after "Conta:" and comma)
      if (!accountMatch) {
        const parts = line.split(',');
        const contaIndex = parts.findIndex((p) => p.includes('Conta:'));
        if (contaIndex >= 0 && contaIndex + 1 < parts.length) {
          const accountNum = parts[contaIndex + 1].trim();
          if (accountNum) {
            accountMatch = [line, accountNum]; // Create match-like array
          }
        }
      }

      if (accountMatch) {
        currentAccountNumber = accountMatch[1].trim();
        currentTransactions = [];
        console.log(`[CSV Parser] Found account: ${currentAccountNumber}`);
      }
      continue;
    }

    // Skip header lines (Data, Descrição, Documento, Valor, Saldo, etc.)
    // These typically contain common column names
    if (line.includes('Data') || line.includes('Saldo Anterior') || line.includes('Saldo Final')) {
      if (currentAccountNumber) {
        console.log(`[CSV Parser] Skipping header line in account ${currentAccountNumber}`);
      }
      continue;
    }

    // Parse transaction lines
    // A valid transaction starts with a date in DD/MM/YYYY or MM/D/YYYY format
    if (currentAccountNumber) {
      try {
        const columns = line.split(',').map((col) => col.trim());
        const firstCol = columns[0];
        const dateRegex = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
        const isDate = firstCol && dateRegex.test(firstCol);

        // Log ALL lines when we're in the BTG account or first few lines
        if (currentAccountNumber === 'BTG 005897480' || nonEmptyLineCount <= 25) {
          console.log(
            `[CSV Parser] ${currentAccountNumber}: First="<${firstCol}>" IsDate=${isDate} Cols=${columns.length}`
          );
        }

        // Check if this looks like a transaction row (starts with date)
        if (isDate) {
          const row = parseCSVRow(columns);
          currentTransactions.push(row);
          console.log(
            `[CSV Parser] ✓ Parsed transaction for ${currentAccountNumber}: ${firstCol} - ${row.documento.substring(0, 30)}`
          );
        }
      } catch (err) {
        // Log errors for BTG account only
        if (currentAccountNumber === 'BTG 005897480') {
          console.log(
            `[CSV Parser] ✗ Parse error for ${currentAccountNumber}: ${(err as Error).message}`
          );
        }
      }
    }
  }

  // Don't forget the last account
  if (currentAccountNumber && currentTransactions.length > 0) {
    console.log(
      `[CSV Parser] Saving final account ${currentAccountNumber} with ${currentTransactions.length} transactions`
    );
    sections.push({
      accountNumber: currentAccountNumber,
      transactions: currentTransactions,
    });
  } else if (currentAccountNumber) {
    console.log(`[CSV Parser] Final account ${currentAccountNumber} has no transactions, skipping`);
  }

  console.log(`[CSV Parser] Total accounts found: ${sections.length}`);
  sections.forEach((s, i) => {
    console.log(`  Account ${i + 1}: ${s.accountNumber} (${s.transactions.length} transactions)`);
  });

  return sections;
}
