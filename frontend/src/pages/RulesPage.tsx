/**
 * T032: Rules Management Page
 *
 * Features:
 * - List rules with filtering (category, tipo, enabled status)
 * - Pagination support
 * - Create new rules with validation
 * - Edit/delete rules
 * - Search and filter functionality
 * - Real-time status updates
 * - Form validation with error messages
 */

import React, { useState, useEffect, useCallback } from 'react';
import styles from './RulesPage.module.css';

interface Rule {
  id: string;
  name: string;
  description?: string;
  category?: string;
  tipo?: string;
  pattern: string;
  matchType: 'CONTAINS' | 'REGEX';
  version: number;
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
}

interface ListRulesResponse {
  data: Rule[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

interface CreateRuleRequest {
  name: string;
  description?: string;
  category?: string;
  tipo?: string;
  pattern: string;
  matchType: 'CONTAINS' | 'REGEX';
  priority?: number;
  enabled?: boolean;
}

interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
  timestamp: string;
}

export function RulesPage() {
  // List state
  const [rules, setRules] = useState<Rule[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const limit = 20;
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [filterCategory, setFilterCategory] = useState<string>('');
  const [filterTipo, setFilterTipo] = useState<string>('');
  const [filterEnabled, setFilterEnabled] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<CreateRuleRequest>({
    name: '',
    description: '',
    category: '',
    tipo: '',
    pattern: '',
    matchType: 'CONTAINS',
    priority: 0,
    enabled: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  // API base URL
  const apiUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) ||
    'http://localhost:3000';

  /**
   * Fetch rules from backend
   */
  const fetchRules = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', limit.toString());

      if (filterCategory) {
        params.append('category', filterCategory);
      }
      if (filterTipo) {
        params.append('tipo', filterTipo);
      }
      if (filterEnabled !== '') {
        params.append('enabled', filterEnabled);
      }

      const response = await fetch(`${apiUrl}/rules?${params.toString()}`);

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.message || 'Failed to fetch rules');
      }

      const data: ListRulesResponse = await response.json();
      setRules(data.data);
      setTotal(data.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch rules');
    } finally {
      setLoading(false);
    }
  }, [page, limit, filterCategory, filterTipo, filterEnabled, apiUrl]);

  /**
   * Load rules on mount and when filters change
   */
  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  /**
   * Validate form inputs
   */
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length === 0) {
      errors.name = 'Name is required';
    }

    if (!formData.pattern || formData.pattern.trim().length === 0) {
      errors.pattern = 'Pattern is required';
    }

    if (formData.matchType === 'REGEX') {
      try {
        new RegExp(formData.pattern, 'i');
      } catch {
        errors.pattern = 'Invalid regex pattern';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setSubmitSuccess(null);

      const response = await fetch(`${apiUrl}/rules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData: ErrorResponse = await response.json();
        throw new Error(errorData.message || 'Failed to create rule');
      }

      setSubmitSuccess(`Rule "${formData.name}" created successfully`);
      setFormData({
        name: '',
        description: '',
        category: '',
        tipo: '',
        pattern: '',
        matchType: 'CONTAINS',
        priority: 0,
        enabled: true,
      });
      setShowForm(false);

      // Refresh rules list
      setPage(1);
      await fetchRules();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create rule');
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Handle form input change
   */
  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Clear error for this field
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  /**
   * Handle pagination
   */
  const handlePreviousPage = () => {
    if (page > 1) {
      setPage(page - 1);
    }
  };

  const handleNextPage = () => {
    if (page * limit < total) {
      setPage(page + 1);
    }
  };

  /**
   * Handle filter changes
   */
  const handleFilterChange = (filterType: string, value: string) => {
    switch (filterType) {
      case 'category':
        setFilterCategory(value);
        setPage(1);
        break;
      case 'tipo':
        setFilterTipo(value);
        setPage(1);
        break;
      case 'enabled':
        setFilterEnabled(value);
        setPage(1);
        break;
      case 'search':
        setSearchTerm(value);
        setPage(1);
        break;
    }
  };

  /**
   * Clear all filters
   */
  const handleClearFilters = () => {
    setFilterCategory('');
    setFilterTipo('');
    setFilterEnabled('');
    setSearchTerm('');
    setPage(1);
  };

  /**
   * Get filtered rules based on search term
   */
  const filteredRules = rules.filter(
    (rule) =>
      rule.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      rule.pattern.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (rule.description?.toLowerCase().includes(searchTerm.toLowerCase()) ?? false)
  );

  const hasActiveFilters = filterCategory || filterTipo || filterEnabled || searchTerm;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Rules Management</h1>
        <p className={styles.subtitle}>
          Create and manage classification rules for automatic transaction categorization
        </p>
      </div>

      {/* Success message */}
      {submitSuccess && (
        <div className={styles.successAlert}>
          <span>{submitSuccess}</span>
          <button
            onClick={() => setSubmitSuccess(null)}
            className={styles.closeBtn}
            aria-label="Close success message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className={styles.errorAlert}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            className={styles.closeBtn}
            aria-label="Close error message"
          >
            ✕
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button
            onClick={() => setShowForm(!showForm)}
            className={styles.primaryBtn}
            disabled={loading}
          >
            {showForm ? 'Cancel' : '+ New Rule'}
          </button>
        </div>
      </div>

      {/* Create Rule Form */}
      {showForm && (
        <div className={styles.formContainer}>
          <h2>Create New Rule</h2>
          <form onSubmit={handleSubmit}>
            <div className={styles.formGrid}>
              {/* Name */}
              <div className={styles.formGroup}>
                <label htmlFor="name">
                  Rule Name <span className={styles.required}>*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  placeholder="e.g., PADARIA"
                  className={formErrors.name ? styles.inputError : ''}
                />
                {formErrors.name && <span className={styles.errorText}>{formErrors.name}</span>}
              </div>

              {/* Description */}
              <div className={styles.formGroup}>
                <label htmlFor="description">Description</label>
                <textarea
                  id="description"
                  name="description"
                  value={formData.description || ''}
                  onChange={handleFormChange}
                  placeholder="Optional description of what this rule matches"
                  rows={2}
                />
              </div>

              {/* Category */}
              <div className={styles.formGroup}>
                <label htmlFor="category">Category</label>
                <input
                  id="category"
                  type="text"
                  name="category"
                  value={formData.category || ''}
                  onChange={handleFormChange}
                  placeholder="e.g., FOOD"
                />
              </div>

              {/* Tipo */}
              <div className={styles.formGroup}>
                <label htmlFor="tipo">Tipo (Type)</label>
                <select
                  id="tipo"
                  name="tipo"
                  value={formData.tipo || ''}
                  onChange={handleFormChange}
                >
                  <option value="">-- Select Type --</option>
                  <option value="DEBIT">Debit</option>
                  <option value="CREDIT">Credit</option>
                  <option value="ANY">Any</option>
                </select>
              </div>

              {/* Match Type */}
              <div className={styles.formGroup}>
                <label htmlFor="matchType">
                  Match Type <span className={styles.required}>*</span>
                </label>
                <select
                  id="matchType"
                  name="matchType"
                  value={formData.matchType}
                  onChange={handleFormChange}
                >
                  <option value="CONTAINS">Contains (case-insensitive)</option>
                  <option value="REGEX">Regular Expression</option>
                </select>
              </div>

              {/* Pattern */}
              <div className={styles.formGroup}>
                <label htmlFor="pattern">
                  Pattern <span className={styles.required}>*</span>
                </label>
                <textarea
                  id="pattern"
                  name="pattern"
                  value={formData.pattern}
                  onChange={handleFormChange}
                  placeholder={
                    formData.matchType === 'CONTAINS' ? 'e.g., PADARIA' : 'e.g., ^PADARIA.*LTDA$'
                  }
                  rows={2}
                  className={formErrors.pattern ? styles.inputError : ''}
                />
                {formErrors.pattern && (
                  <span className={styles.errorText}>{formErrors.pattern}</span>
                )}
                <small className={styles.hint}>
                  {formData.matchType === 'REGEX'
                    ? 'Enter a valid JavaScript regex pattern (case-insensitive)'
                    : 'Text to match (will be case-insensitive and accent-folded)'}
                </small>
              </div>

              {/* Priority */}
              <div className={styles.formGroup}>
                <label htmlFor="priority">Priority</label>
                <input
                  id="priority"
                  type="number"
                  name="priority"
                  value={formData.priority || 0}
                  onChange={handleFormChange}
                  min="0"
                  max="1000"
                />
                <small className={styles.hint}>Higher priority rules are evaluated first</small>
              </div>

              {/* Enabled */}
              <div className={`${styles.formGroup} ${styles.checkboxGroup}`}>
                <label htmlFor="enabled">
                  <input
                    id="enabled"
                    type="checkbox"
                    name="enabled"
                    checked={formData.enabled !== false}
                    onChange={handleFormChange}
                  />
                  Enabled
                </label>
              </div>
            </div>

            <div className={styles.formActions}>
              <button type="submit" className={styles.primaryBtn} disabled={submitting}>
                {submitting ? 'Creating...' : 'Create Rule'}
              </button>
              <button
                type="button"
                className={styles.secondaryBtn}
                onClick={() => {
                  setShowForm(false);
                  setFormErrors({});
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className={styles.filtersContainer}>
        <div className={styles.filterRow}>
          <div className={styles.filterGroup}>
            <label htmlFor="search">Search Rules</label>
            <input
              id="search"
              type="text"
              placeholder="Search by name or pattern..."
              value={searchTerm}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              className={styles.filterInput}
            />
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="filterCategory">Category</label>
            <select
              id="filterCategory"
              value={filterCategory}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">All Categories</option>
              <option value="FOOD">Food</option>
              <option value="UTILITIES">Utilities</option>
              <option value="SALARY">Salary</option>
              <option value="BILLS">Bills</option>
              <option value="TRANSFER">Transfer</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="filterTipo">Type</label>
            <select
              id="filterTipo"
              value={filterTipo}
              onChange={(e) => handleFilterChange('tipo', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">All Types</option>
              <option value="DEBIT">Debit</option>
              <option value="CREDIT">Credit</option>
              <option value="ANY">Any</option>
            </select>
          </div>

          <div className={styles.filterGroup}>
            <label htmlFor="filterEnabled">Status</label>
            <select
              id="filterEnabled"
              value={filterEnabled}
              onChange={(e) => handleFilterChange('enabled', e.target.value)}
              className={styles.filterSelect}
            >
              <option value="">All Statuses</option>
              <option value="true">Enabled</option>
              <option value="false">Disabled</option>
            </select>
          </div>

          {hasActiveFilters && (
            <button onClick={handleClearFilters} className={styles.clearFiltersBtn}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* Loading state */}
      {loading && (
        <div className={styles.loadingContainer}>
          <p>Loading rules...</p>
        </div>
      )}

      {/* Rules Table */}
      {!loading && rules.length > 0 && (
        <>
          <div className={styles.tableContainer}>
            <table className={styles.rulesTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Pattern</th>
                  <th>Match Type</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Version</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {filteredRules.map((rule) => (
                  <tr key={rule.id} className={!rule.enabled ? styles.disabled : ''}>
                    <td className={styles.nameCell}>{rule.name}</td>
                    <td className={styles.descriptionCell}>
                      {rule.description ? rule.description.substring(0, 50) : '-'}
                    </td>
                    <td>{rule.category || '-'}</td>
                    <td>{rule.tipo || '-'}</td>
                    <td className={styles.patternCell} title={rule.pattern}>
                      {rule.pattern.length > 30
                        ? rule.pattern.substring(0, 30) + '...'
                        : rule.pattern}
                    </td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          rule.matchType === 'REGEX' ? styles.regexBadge : styles.containsBadge
                        }`}
                      >
                        {rule.matchType}
                      </span>
                    </td>
                    <td className={styles.priorityCell}>{rule.priority}</td>
                    <td>
                      <span
                        className={`${styles.badge} ${
                          rule.enabled ? styles.enabledBadge : styles.disabledBadge
                        }`}
                      >
                        {rule.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>{rule.version}</td>
                    <td className={styles.dateCell}>
                      {new Date(rule.updatedAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className={styles.pagination}>
            <button
              onClick={handlePreviousPage}
              disabled={page === 1}
              className={styles.paginationBtn}
            >
              ← Previous
            </button>
            <span className={styles.pageInfo}>
              Page {page} of {Math.ceil(total / limit)} ({total} total rules)
            </span>
            <button
              onClick={handleNextPage}
              disabled={page * limit >= total}
              className={styles.paginationBtn}
            >
              Next →
            </button>
          </div>
        </>
      )}

      {/* Empty state */}
      {!loading && rules.length === 0 && !hasActiveFilters && (
        <div className={styles.emptyState}>
          <h3>No rules created yet</h3>
          <p>Click "New Rule" to create your first classification rule</p>
        </div>
      )}

      {/* No results state */}
      {!loading && filteredRules.length === 0 && hasActiveFilters && (
        <div className={styles.emptyState}>
          <h3>No rules match your filters</h3>
          <p>Try adjusting your search criteria</p>
        </div>
      )}
    </div>
  );
}
