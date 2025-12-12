/**
 * T024: Upload Page - CSV file upload
 *
 * Features:
 * - File input with validation
 * - Auto-detect period (month/year) from CSV dates
 * - Upload progress indication
 * - Success/error handling
 * - Import preview with file header display
 */

import React, { useState } from 'react';
import styles from './UploadPage.module.css';

interface ImportResult {
  accountNumber: string;
  accountId: string;
  status: string;
  batchId: string;
  message: string;
}

interface MultiAccountResponse {
  total: number;
  results: ImportResult[];
  message: string;
}

export function UploadPage() {
  // Form state
  const [file, setFile] = useState<File | null>(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<MultiAccountResponse | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [uploadedMonths, setUploadedMonths] = useState<Array<{ month: number; year: number }>>([]);

  // Fetch uploaded months on component mount
  React.useEffect(() => {
    const fetchUploadedMonths = async () => {
      try {
        const apiUrl =
          (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
          'http://localhost:3000';
        const response = await fetch(`${apiUrl}/imports/months`);
        if (response.ok) {
          const data = await response.json();
          // Sort in ascending order (oldest to newest)
          const sorted = (data.months || []).sort(
            (a: { month: number; year: number }, b: { month: number; year: number }) => {
              if (a.year !== b.year) return a.year - b.year;
              return a.month - b.month;
            }
          );
          setUploadedMonths(sorted);
        }
      } catch (err) {
        console.error('Failed to fetch uploaded months:', err);
      }
    };

    fetchUploadedMonths();
  }, [success]); // Refresh when upload succeeds

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

    setLoading(true);

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

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

      const result: MultiAccountResponse = await response.json();
      setSuccess(result);

      // Reset form
      setFile(null);
      setFilePreview(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <h1>Enviar CSV Bancário</h1>
      <p className={styles.subtitle}>Importe transações e mapeie para sua conta</p>

      {error && <div className={styles.error}>{error}</div>}
      {success && (
        <div className={styles.success}>
          <h3>✓ Importação Bem-sucedida</h3>
          <p className={styles.successMessage}>{success.message}</p>
          <div className={styles.resultsList}>
            {success.results.map((result, index) => (
              <div
                key={index}
                className={`${styles.resultItem} ${styles[result.status.toLowerCase()]}`}
              >
                <div className={styles.resultHeader}>
                  <strong>{result.accountNumber}</strong>
                  <span className={styles.statusBadge}>{result.status}</span>
                </div>
                <p className={styles.resultMessage}>{result.message}</p>
                {result.status === 'SUCCESS' && (
                  <p className={styles.batchId}>Batch ID: {result.batchId}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className={styles.form}>
        <div className={styles.formGroup}>
          <label htmlFor="file">Arquivo CSV *</label>
          <input
            id="file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={loading}
            required
          />
          {file && <p className={styles.fileName}>Selecionado: {file.name}</p>}
        </div>

        {filePreview && (
          <div className={styles.preview}>
            <label>Visualização do Arquivo (primeiras 6 linhas):</label>
            <pre>{filePreview}</pre>
          </div>
        )}

        <button type="submit" disabled={loading || !file} className={styles.submitBtn}>
          {loading ? 'Enviando...' : 'Enviar CSV'}
        </button>
      </form>

      {uploadedMonths.length > 0 && (
        <div className={styles.uploadedMonths}>
          <h3>Já Enviados</h3>
          <div className={styles.monthsList}>
            {uploadedMonths.map((item, index) => (
              <span key={index} className={styles.monthTag}>
                {item.month.toString().padStart(2, '0')}/{item.year}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default UploadPage;
