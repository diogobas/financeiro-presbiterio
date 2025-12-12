/**
 * T024: Upload Page - CSV file upload and account mapping
 *
 * Features:
 * - File input with validation
 * - Account selection
 * - Period (month/year) selection
 * - Upload progress indication
 * - Success/error handling
 * - Import preview with normalization summary
 */

import React, { useState } from 'react';
import styles from './UploadPage.module.css';

interface Account {
  id: string;
  name: string;
  bankName?: string;
}

interface ImportResponse {
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

export function UploadPage() {
  // Form state
  const [file, setFile] = useState<File | null>(null);
  const [accountId, setAccountId] = useState('');
  const [periodMonth, setPeriodMonth] = useState<number>(new Date().getMonth() + 1);
  const [periodYear, setPeriodYear] = useState<number>(new Date().getFullYear());
  const [accounts, setAccounts] = useState<Account[]>([]);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<ImportResponse | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);

  // Load accounts on component mount
  React.useEffect(() => {
    loadAccounts();
  }, []);

  async function loadAccounts() {
    try {
      // TODO: Replace with actual API call
      const mockAccounts: Account[] = [
        { id: '1', name: 'Personal Checking', bankName: 'Bank A' },
        { id: '2', name: 'Savings Account', bankName: 'Bank B' },
        { id: '3', name: 'Business Account', bankName: 'Bank C' },
      ];
      setAccounts(mockAccounts);
    } catch (err) {
      setError(`Failed to load accounts: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) {
      setFile(null);
      setFilePreview(null);
      return;
    }

    // Validate file type
    if (!selectedFile.name.toLowerCase().endsWith('.csv')) {
      setError('Please select a CSV file');
      setFile(null);
      return;
    }

    // Validate file size (max 100MB)
    if (selectedFile.size > 100 * 1024 * 1024) {
      setError('File is too large. Maximum size is 100MB');
      setFile(null);
      return;
    }

    setFile(selectedFile);
    setError(null);

    // Read first few lines for preview
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const lines = content.split('\n').slice(0, 6);
      setFilePreview(lines.join('\n'));
    };
    reader.readAsText(selectedFile);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!file) {
      setError('Please select a file');
      return;
    }

    if (!accountId) {
      setError('Please select an account');
      return;
    }

    if (periodMonth < 1 || periodMonth > 12) {
      setError('Please select a valid month (1-12)');
      return;
    }

    if (periodYear < 2000 || periodYear > 2100) {
      setError('Please select a valid year (2000-2100)');
      return;
    }

    setLoading(true);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);
      formData.append('accountId', accountId);
      formData.append('periodMonth', periodMonth.toString());
      formData.append('periodYear', periodYear.toString());

      // TODO: Replace with actual API endpoint
      const apiUrl =
        (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
        'http://localhost:3000';
      const response = await fetch(`${apiUrl}/imports`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `Upload failed with status ${response.status}`);
      }

      const result: ImportResponse = await response.json();
      setSuccess(result);

      // Reset form
      setFile(null);
      setFilePreview(null);
      setAccountId('');
      setPeriodMonth(new Date().getMonth() + 1);
      setPeriodYear(new Date().getFullYear());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h1>Upload Bank CSV</h1>
      <p className={styles.subtitle}>Import transactions and map to your account</p>

      {error && <div className={styles.error}>{error}</div>}
      {success && (
        <div className={styles.success}>
          <h3>✓ Import Successful</h3>
          <p>Batch ID: {success.id}</p>
          <p>Transactions: {success.rowCount}</p>
          <p>
            Period: {success.periodMonth}/{success.periodYear}
          </p>
          <p>Encoding: {success.encoding}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="account">Account *</label>
          <select
            id="account"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            disabled={loading}
            required
          >
            <option value="">Select an account...</option>
            {accounts.map((acc) => (
              <option key={acc.id} value={acc.id}>
                {acc.name}
                {acc.bankName ? ` (${acc.bankName})` : ''}
              </option>
            ))}
          </select>
        </div>

        <div className={styles.formRow}>
          <div className={styles.formGroup}>
            <label htmlFor="month">Month *</label>
            <select
              id="month"
              value={periodMonth}
              onChange={(e) => setPeriodMonth(parseInt(e.target.value))}
              disabled={loading}
              required
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m}>
                  {m.toString().padStart(2, '0')}
                </option>
              ))}
            </select>
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="year">Year *</label>
            <select
              id="year"
              value={periodYear}
              onChange={(e) => setPeriodYear(parseInt(e.target.value))}
              disabled={loading}
              required
            >
              {Array.from({ length: 10 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.formGroup}>
          <label htmlFor="file">CSV File *</label>
          <input
            id="file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={loading}
            required
          />
          {file && <p className={styles.fileName}>Selected: {file.name}</p>}
        </div>

        {filePreview && (
          <div className={styles.preview}>
            <label>File Preview (first 6 lines):</label>
            <pre>{filePreview}</pre>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || !file || !accountId}
          className={styles.submitBtn}
        >
          {loading ? 'Uploading...' : 'Upload CSV'}
        </button>
      </form>
    </div>
  );
}

export default UploadPage;
