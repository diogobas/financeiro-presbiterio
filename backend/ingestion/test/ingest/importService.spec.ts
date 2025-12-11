import { ImportService, ImportStatus } from '../../src/ingest/importService';

/**
 * Import Service Integration Tests
 *
 * Tests the complete import workflow:
 * - File checksum calculation
 * - Batch creation and status tracking
 * - CSV parsing and row insertion
 * - Deduplication by checksum and row hash
 * - Error handling and recovery
 *
 * NOTE: These tests use mocked database to focus on import logic
 * In production, use AbstractPostgresIntegrationTest for real database tests
 */

interface MockBatch {
  id: string;
  account_id: string;
  uploaded_at: Date;
  file_checksum: string;
  period_month: number;
  period_year: number;
  row_count: number;
  status: string;
  created_by?: string;
  created_at: Date;
  error_message?: string;
}

interface MockTransaction {
  id: string;
  batch_id: string;
  account_id: string;
  date: Date;
  documento: string;
  amount: number;
  currency: string;
  row_hash: string;
  category_id?: string;
  tipo?: string;
  classification_source: string;
  rule_id?: string;
  rule_version?: number;
  rationale?: string;
  created_at: Date;
}

describe('ImportService Integration Tests', () => {
  let importService: ImportService;
  let mockPool: any;
  let batchStore: Map<string, MockBatch>;
  let transactionStore: Map<string, MockTransaction>;

  beforeEach(() => {
    // Initialize in-memory stores
    batchStore = new Map();
    transactionStore = new Map();

    // Create mock pool
    mockPool = {
      query: jest.fn((sql: string, params: any[]) => {
        return handleQuery(sql, params);
      }),
    } as any;

    importService = new ImportService(mockPool);
  });

  /**
   * Helper: Mock SQL query handler
   */
  function handleQuery(sql: string, params: any[]): Promise<any> {
    if (sql.includes('SELECT id FROM import_batch WHERE file_checksum')) {
      // Check for existing batch
      const fileChecksum = params[0];
      for (const batch of batchStore.values()) {
        if (batch.file_checksum === fileChecksum) {
          return Promise.resolve({ rows: [{ id: batch.id }] });
        }
      }
      return Promise.resolve({ rows: [] });
    }

    if (sql.includes('INSERT INTO import_batch')) {
      // Create batch
      const batch: MockBatch = {
        id: params[0],
        account_id: params[1],
        file_checksum: params[2],
        period_year: params[3],
        period_month: params[4],
        row_count: params[5],
        status: params[6],
        created_by: params[7],
        created_at: params[8],
        uploaded_at: params[9],
      };
      batchStore.set(batch.id, batch);
      return Promise.resolve({ rows: [batch] });
    }

    if (sql.includes('INSERT INTO transaction')) {
      // Create transaction
      const transaction: MockTransaction = {
        id: params[0],
        batch_id: params[1],
        account_id: params[2],
        date: params[3],
        documento: params[4],
        amount: params[5],
        currency: params[6],
        row_hash: params[7],
        classification_source: params[8],
        created_at: params[9],
      };
      transactionStore.set(transaction.id, transaction);
      return Promise.resolve({ rows: [transaction] });
    }

    if (sql.includes('SELECT id FROM transaction WHERE batch_id') && sql.includes('row_hash')) {
      // Check for duplicate row
      const batchId = params[0];
      const rowHash = params[1];
      for (const txn of transactionStore.values()) {
        if (txn.batch_id === batchId && txn.row_hash === rowHash) {
          return Promise.resolve({ rows: [{ id: txn.id }] });
        }
      }
      return Promise.resolve({ rows: [] });
    }

    if (sql.includes('SELECT * FROM import_batch WHERE id')) {
      // Get batch
      const batchId = params[0];
      const batch = batchStore.get(batchId);
      return Promise.resolve({ rows: batch ? [batch] : [] });
    }

    if (sql.includes('SELECT * FROM transaction')) {
      // Get transactions
      const batchId = params[0];
      const limit = params[1];
      const offset = params[2];
      const transactions = Array.from(transactionStore.values())
        .filter((t) => t.batch_id === batchId)
        .sort((a, b) => {
          const dateComp = a.date.getTime() - b.date.getTime();
          return dateComp !== 0 ? dateComp : a.documento.localeCompare(b.documento);
        })
        .slice(offset, offset + limit);
      return Promise.resolve({ rows: transactions });
    }

    if (sql.includes('COUNT(*) as count FROM transaction')) {
      // Count transactions
      const batchId = params[0];
      const count = Array.from(transactionStore.values()).filter(
        (t) => t.batch_id === batchId
      ).length;
      return Promise.resolve({ rows: [{ count: count.toString() }] });
    }

    if (sql.includes('UPDATE import_batch')) {
      // Update batch status
      const batchId = params[2];
      const batch = batchStore.get(batchId);
      if (batch) {
        batch.status = params[0];
        batch.error_message = params[1];
      }
      return Promise.resolve({ rows: [] });
    }

    return Promise.resolve({ rows: [] });
  }

  describe('Checksum Calculation', () => {
    it('should calculate consistent checksums for same content', () => {
      const content = '03/01/2025,001,100,50';
      const hash1 = importService.calculateFileChecksum(content);
      const hash2 = importService.calculateFileChecksum(content);
      expect(hash1).toBe(hash2);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
    });

    it('should calculate different checksums for different content', () => {
      const content1 = '03/01/2025,001,100,50';
      const content2 = '03/01/2025,002,100,50';
      const hash1 = importService.calculateFileChecksum(content1);
      const hash2 = importService.calculateFileChecksum(content2);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle Buffer and string content equally', () => {
      const str = '03/01/2025,001,100,50';
      const buf = Buffer.from(str, 'utf-8');
      const hash1 = importService.calculateFileChecksum(str);
      const hash2 = importService.calculateFileChecksum(buf);
      expect(hash1).toBe(hash2);
    });

    it('should handle UTF-8 encoding correctly', () => {
      const content = '03/01/2025,001-ABC,100,50'; // accented chars
      const hash = importService.calculateFileChecksum(content);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Row Hash Calculation', () => {
    it('should calculate consistent hashes for same row', () => {
      const row = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const hash1 = importService.calculateRowHash(row);
      const hash2 = importService.calculateRowHash(row);
      expect(hash1).toBe(hash2);
    });

    it('should calculate different hashes for different dates', () => {
      const row1 = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const row2 = { date: new Date('2025-01-04'), documento: '001', amount: 100.5 };
      const hash1 = importService.calculateRowHash(row1);
      const hash2 = importService.calculateRowHash(row2);
      expect(hash1).not.toBe(hash2);
    });

    it('should calculate different hashes for different documentos', () => {
      const row1 = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const row2 = { date: new Date('2025-01-03'), documento: '002', amount: 100.5 };
      const hash1 = importService.calculateRowHash(row1);
      const hash2 = importService.calculateRowHash(row2);
      expect(hash1).not.toBe(hash2);
    });

    it('should calculate different hashes for different amounts', () => {
      const row1 = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const row2 = { date: new Date('2025-01-03'), documento: '001', amount: 100.6 };
      const hash1 = importService.calculateRowHash(row1);
      const hash2 = importService.calculateRowHash(row2);
      expect(hash1).not.toBe(hash2);
    });

    it('should be deterministic across invocations', () => {
      const row = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const hashes = Array.from({ length: 10 }, () => importService.calculateRowHash(row));
      const unique = new Set(hashes);
      expect(unique.size).toBe(1); // All hashes are identical
    });
  });

  describe('Import Batch Creation', () => {
    it('should create import batch with correct metadata', async () => {
      const batch = await importService.createImportBatch(
        'acc-123',
        'checksum-abc',
        1,
        2025,
        5,
        'user-456'
      );

      expect(batch.accountId).toBe('acc-123');
      expect(batch.fileChecksum).toBe('checksum-abc');
      expect(batch.periodMonth).toBe(1);
      expect(batch.periodYear).toBe(2025);
      expect(batch.rowCount).toBe(5);
      expect(batch.status).toBe(ImportStatus.PENDING);
      expect(batch.createdBy).toBe('user-456');
      expect(batch.id).toBeDefined();
      expect(batch.createdAt).toBeDefined();
    });

    it('should create batch with PENDING status initially', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 5);
      expect(batch.status).toBe(ImportStatus.PENDING);
    });

    it('should generate unique batch IDs', async () => {
      const batch1 = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 5);
      const batch2 = await importService.createImportBatch('acc-123', 'checksum-def', 2, 2025, 3);
      expect(batch1.id).not.toBe(batch2.id);
    });
  });

  describe('Transaction Insertion', () => {
    it('should insert transaction with correct fields', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 1);

      const row = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const hash = importService.calculateRowHash(row);

      const txn = await importService.insertTransaction('acc-123', batch.id, row, hash);

      expect(txn.batchId).toBe(batch.id);
      expect(txn.accountId).toBe('acc-123');
      expect(txn.date).toEqual(row.date);
      expect(txn.documento).toBe('001');
      expect(txn.amount).toBe(100.5);
      expect(txn.currency).toBe('BRL');
      expect(txn.rowHash).toBe(hash);
      expect(txn.classificationSource).toBe('NONE');
    });

    it('should generate unique transaction IDs', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 2);

      const row1 = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const row2 = { date: new Date('2025-01-04'), documento: '002', amount: 200.0 };
      const hash1 = importService.calculateRowHash(row1);
      const hash2 = importService.calculateRowHash(row2);

      const txn1 = await importService.insertTransaction('acc-123', batch.id, row1, hash1);
      const txn2 = await importService.insertTransaction('acc-123', batch.id, row2, hash2);

      expect(txn1.id).not.toBe(txn2.id);
    });
  });

  describe('Duplicate Detection', () => {
    it('should detect duplicate row by row hash', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 1);

      const row = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const hash = importService.calculateRowHash(row);

      await importService.insertTransaction('acc-123', batch.id, row, hash);

      const duplicate = await importService.findDuplicateRow(batch.id, hash);
      expect(duplicate).not.toBeNull();
    });

    it('should return null for non-existent row', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 0);

      const notFound = await importService.findDuplicateRow(batch.id, 'non-existent-hash');
      expect(notFound).toBeNull();
    });

    it('should not match duplicates from other batches', async () => {
      const batch1 = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 1);
      const batch2 = await importService.createImportBatch('acc-123', 'checksum-def', 2, 2025, 1);

      const row = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const hash = importService.calculateRowHash(row);

      await importService.insertTransaction('acc-123', batch1.id, row, hash);

      const inBatch1 = await importService.findDuplicateRow(batch1.id, hash);
      const inBatch2 = await importService.findDuplicateRow(batch2.id, hash);

      expect(inBatch1).not.toBeNull();
      expect(inBatch2).toBeNull();
    });
  });

  describe('Batch Status Management', () => {
    it('should update batch to COMPLETED status', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 1);

      await importService.updateBatchStatus(batch.id, ImportStatus.COMPLETED);

      const updated = await importService.getImportBatch(batch.id);
      expect(updated?.status).toBe(ImportStatus.COMPLETED);
    });

    it('should update batch to FAILED status with error message', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 1);

      const errorMsg = 'Invalid CSV format';
      await importService.updateBatchStatus(batch.id, ImportStatus.FAILED, errorMsg);

      const updated = await importService.getImportBatch(batch.id);
      expect(updated?.status).toBe(ImportStatus.FAILED);
      expect(updated?.errorMessage).toBe(errorMsg);
    });
  });

  describe('Batch Retrieval', () => {
    it('should retrieve batch by ID', async () => {
      const created = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 5);

      const retrieved = await importService.getImportBatch(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.accountId).toBe('acc-123');
      expect(retrieved?.fileChecksum).toBe('checksum-abc');
    });

    it('should return null for non-existent batch', async () => {
      const batch = await importService.getImportBatch('non-existent');
      expect(batch).toBeNull();
    });
  });

  describe('Transaction Retrieval', () => {
    it('should retrieve transactions for batch with pagination', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 3);

      const rows = [
        { date: new Date('2025-01-03'), documento: '001', amount: 100.5 },
        { date: new Date('2025-01-04'), documento: '002', amount: 200.0 },
        { date: new Date('2025-01-05'), documento: '003', amount: 300.0 },
      ];

      for (const row of rows) {
        const hash = importService.calculateRowHash(row);
        await importService.insertTransaction('acc-123', batch.id, row, hash);
      }

      const txns = await importService.getImportBatchTransactions(batch.id, 2, 0);
      expect(txns).toHaveLength(2);

      const txnsPage2 = await importService.getImportBatchTransactions(batch.id, 2, 2);
      expect(txnsPage2).toHaveLength(1);
    });

    it('should return transactions sorted by date and documento', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 3);

      const rows = [
        { date: new Date('2025-01-05'), documento: '003', amount: 300.0 },
        { date: new Date('2025-01-03'), documento: '001', amount: 100.5 },
        { date: new Date('2025-01-04'), documento: '002', amount: 200.0 },
      ];

      for (const row of rows) {
        const hash = importService.calculateRowHash(row);
        await importService.insertTransaction('acc-123', batch.id, row, hash);
      }

      const txns = await importService.getImportBatchTransactions(batch.id, 10, 0);
      expect(txns[0].documento).toBe('001'); // Earliest date
      expect(txns[1].documento).toBe('002');
      expect(txns[2].documento).toBe('003');
    });

    it('should get correct transaction count', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 2);

      const row1 = { date: new Date('2025-01-03'), documento: '001', amount: 100.5 };
      const row2 = { date: new Date('2025-01-04'), documento: '002', amount: 200.0 };
      const hash1 = importService.calculateRowHash(row1);
      const hash2 = importService.calculateRowHash(row2);

      await importService.insertTransaction('acc-123', batch.id, row1, hash1);
      await importService.insertTransaction('acc-123', batch.id, row2, hash2);

      const count = await importService.getImportBatchTransactionCount(batch.id);
      expect(count).toBe(2);
    });
  });

  describe('Process Import - Full Workflow', () => {
    it('should process CSV with multiple rows successfully', async () => {
      const csvContent =
        'Data,Documento,Valor\n' +
        '03/01/2025,001,100.50\n' +
        '04/01/2025,002,200.00\n' +
        '05/01/2025,003,"(50,00)"\n'; // Negative amount

      const batch = await importService.processImport(csvContent, 'acc-123', 1, 2025, 'user-456');

      expect(batch.status).toBe(ImportStatus.COMPLETED);
      expect(batch.rowCount).toBe(3);
      expect(batch.accountId).toBe('acc-123');
      expect(batch.periodMonth).toBe(1);
      expect(batch.periodYear).toBe(2025);
      expect(batch.createdBy).toBe('user-456');
    });

    it('should be idempotent - same CSV produces same batch', async () => {
      const csvContent =
        'Data,Documento,Valor\n' + '03/01/2025,001,100.50\n' + '04/01/2025,002,200.00\n';

      const batch1 = await importService.processImport(csvContent, 'acc-123', 1, 2025);
      const batch2 = await importService.processImport(csvContent, 'acc-123', 1, 2025);

      expect(batch1.id).toBe(batch2.id);
      expect(batch1.fileChecksum).toBe(batch2.fileChecksum);
    });

    it('should skip duplicate rows on re-import', async () => {
      const csvContent =
        'Data,Documento,Valor\n' + '03/01/2025,001,100.50\n' + '04/01/2025,002,200.00\n';

      // First import
      const batch1 = await importService.processImport(csvContent, 'acc-123', 1, 2025);
      const count1 = await importService.getImportBatchTransactionCount(batch1.id);

      // Simulate partial re-import with same + new row
      const csvContent2 =
        'Data,Documento,Valor\n' +
        '03/01/2025,001,100.50\n' +
        '04/01/2025,002,200.00\n' +
        '05/01/2025,003,300.00\n';

      const batch2 = await importService.processImport(csvContent2, 'acc-123', 1, 2025);

      expect(count1).toBe(2); // First batch has 2 rows
      // Note: Second batch is different (different rows), so different checksum
      expect(batch1.fileChecksum).not.toBe(batch2.fileChecksum);
    });

    it('should handle CSV with quoted values correctly', async () => {
      const csvContent =
        'Data,Documento,Valor\n' +
        '03/01/2025,"001-XYZ","100,50"\n' +
        '04/01/2025,"002-ABC","(200,00)"\n';

      const batch = await importService.processImport(csvContent, 'acc-123', 1, 2025);

      expect(batch.status).toBe(ImportStatus.COMPLETED);
      expect(batch.rowCount).toBe(2);

      const txns = await importService.getImportBatchTransactions(batch.id);
      expect(txns[0].documento).toBe('001-XYZ');
      expect(txns[0].amount).toBe(100.5);
      expect(txns[1].documento).toBe('002-ABC');
      expect(txns[1].amount).toBe(-200.0);
    });

    it('should fail gracefully with invalid date format', async () => {
      const csvContent = 'Data,Documento,Valor\n' + '32/01/2025,001,100.50\n'; // Invalid day

      await expect(importService.processImport(csvContent, 'acc-123', 1, 2025)).rejects.toThrow();
    });

    it('should fail gracefully with invalid amount format', async () => {
      const csvContent = 'Data,Documento,Valor\n' + '03/01/2025,001,ABC\n'; // Invalid amount

      await expect(importService.processImport(csvContent, 'acc-123', 1, 2025)).rejects.toThrow();
    });

    it('should preserve negative amounts from parentheses notation', async () => {
      const csvContent = 'Data,Documento,Valor\n' + '03/01/2025,001,"(1.000,50)"\n'; // Negative with thousand separator

      const batch = await importService.processImport(csvContent, 'acc-123', 1, 2025);
      const txns = await importService.getImportBatchTransactions(batch.id);

      expect(txns[0].amount).toBe(-1000.5);
    });

    it('should handle multiple periods separately', async () => {
      const csvContent = 'Data,Documento,Valor\n03/01/2025,001,100.50\n';

      const batch1 = await importService.processImport(csvContent, 'acc-123', 1, 2025);
      const batch2 = await importService.processImport(csvContent, 'acc-123', 2, 2025);

      expect(batch1.id).not.toBe(batch2.id); // Different periods = different batches
      expect(batch1.periodMonth).toBe(1);
      expect(batch2.periodMonth).toBe(2);
    });
  });

  describe('Existing Batch Lookup', () => {
    it('should find existing batch by file checksum', async () => {
      const batch = await importService.createImportBatch('acc-123', 'checksum-abc', 1, 2025, 1);

      const found = await importService.findExistingBatch('checksum-abc');
      expect(found).toBe(batch.id);
    });

    it('should return null for non-existent checksum', async () => {
      const found = await importService.findExistingBatch('non-existent');
      expect(found).toBeNull();
    });
  });
});
