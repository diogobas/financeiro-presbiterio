/**
 * T025: Import Preview Component - Display import status and classification statistics
 *
 * Features:
 * - Display import batch metadata
 * - Show classification statistics (percentage classified)
 * - Transaction summary
 * - Link back to upload screen
 * - Reload status functionality
 */

import { useState, useEffect, useCallback } from 'react';
import styles from './ImportPreview.module.css';

interface ImportBatch {
  id: string;
  accountId: string;
  uploadedBy: string;
  uploadedAt: string;
  fileChecksum: string;
  periodMonth: number;
  periodYear: number;
  encoding: string;
  rowCount: number;
  status: string;
}

interface ClassificationStats {
  classified: number;
  unclassified: number;
  total: number;
  percentClassified: number;
}

interface ImportStatus extends ImportBatch {
  classification: ClassificationStats;
}

export function ImportPreview() {
  const importId =
    new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '').get('id') ||
    'unknown';

  const goBack = () => {
    if (typeof window !== 'undefined') {
      window.location.href = '/upload';
    }
  };

  const [batch, setBatch] = useState<ImportStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadBatch = useCallback(async () => {
    setError(null);
    try {
      setLoading(true);
      // TODO: Replace with actual API endpoint
      const apiUrl =
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
        'http://localhost:3000';
      const response = await fetch(`${apiUrl}/imports/${importId}`);

      if (!response.ok) {
        throw new Error(`Failed to load import: ${response.statusText}`);
      }

      const data: ImportStatus = await response.json();
      setBatch(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
      setBatch(null);
    } finally {
      setLoading(false);
    }
  }, [importId]);

  useEffect(() => {
    if (importId && importId !== 'unknown') {
      loadBatch();
    }
  }, [importId, loadBatch]);

  async function handleRefresh() {
    setRefreshing(true);
    await loadBatch();
    setRefreshing(false);
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading import details...</div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error || 'Failed to load import details'}</div>
        <button onClick={goBack} className={styles.backBtn}>
          ← Back to Upload
        </button>
      </div>
    );
  }

  const progressPercentage =
    batch.classification.total > 0
      ? Math.round((batch.classification.classified / batch.classification.total) * 100)
      : 0;

  const formattedDate = new Date(batch.uploadedAt).toLocaleString();

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Import Status</h1>
        <button onClick={goBack} className={styles.backLink}>
          ← Back to Upload
        </button>
      </div>

      <div className={styles.card}>
        <h2>Batch Information</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <label>Batch ID</label>
            <code>{batch.id}</code>
          </div>
          <div className={styles.infoItem}>
            <label>Uploaded</label>
            <p>{formattedDate}</p>
          </div>
          <div className={styles.infoItem}>
            <label>Period</label>
            <p>
              {batch.periodMonth.toString().padStart(2, '0')}/{batch.periodYear}
            </p>
          </div>
          <div className={styles.infoItem}>
            <label>Encoding</label>
            <p>{batch.encoding}</p>
          </div>
          <div className={styles.infoItem}>
            <label>File Checksum</label>
            <code className={styles.checksum}>{batch.fileChecksum}</code>
          </div>
          <div className={styles.infoItem}>
            <label>Uploaded By</label>
            <p>{batch.uploadedBy}</p>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2>Transaction Summary</h2>
        <div className={styles.summary}>
          <div className={styles.summaryItem}>
            <div className={styles.summaryLabel}>Total Transactions</div>
            <div className={styles.summaryValue}>{batch.rowCount}</div>
          </div>
        </div>
      </div>

      <div className={styles.card}>
        <h2>Classification Status</h2>
        <div className={styles.classificationContainer}>
          <div className={styles.progressBar}>
            <div className={styles.progressFill} style={{ width: `${progressPercentage}%` }}>
              {progressPercentage > 10 && `${progressPercentage}%`}
            </div>
          </div>

          <div className={styles.statsGrid}>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Classified</div>
              <div className={styles.statValue}>{batch.classification.classified}</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Unclassified</div>
              <div className={styles.statValue}>{batch.classification.unclassified}</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Total</div>
              <div className={styles.statValue}>{batch.classification.total}</div>
            </div>
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Progress</div>
              <div className={styles.statValue}>{progressPercentage}%</div>
            </div>
          </div>

          <div className={styles.statusMessage}>
            {progressPercentage === 100 ? (
              <p className={styles.success}>✓ All transactions classified</p>
            ) : progressPercentage > 0 ? (
              <p className={styles.inProgress}>
                ⏳ {batch.classification.unclassified} transactions pending classification
              </p>
            ) : (
              <p className={styles.pending}>⧗ Classification not started</p>
            )}
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button onClick={handleRefresh} disabled={refreshing} className={styles.refreshBtn}>
          {refreshing ? 'Refreshing...' : '⟳ Refresh Status'}
        </button>
        <button onClick={goBack} className={styles.uploadBtn}>
          + Upload Another
        </button>
      </div>
    </div>
  );
}

export default ImportPreview;
