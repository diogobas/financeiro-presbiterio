import React, { useEffect, useState } from 'react';

type Props = {
  transactionId?: string;
  transactionDocumento?: string;
  onSuccess?: () => void;
};

export default function OverrideForm({
  transactionId: externallySelectedId,
  transactionDocumento: externalDocumento,
  onSuccess,
}: Props) {
  const [transactionId, setTransactionId] = useState(externallySelectedId || '');
  const [category, setCategory] = useState('');
  const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA' | ''>('');
  const [note, setNote] = useState('');
  const [createRule, setCreateRule] = useState(false);
  const [ruleName, setRuleName] = useState('');
  const [rulePattern, setRulePattern] = useState('');
  const [ruleMatchType, setRuleMatchType] = useState<'CONTAINS' | 'REGEX'>('CONTAINS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (externallySelectedId) {
      setTransactionId(externallySelectedId);
      // Pre-populate pattern with documento when a transaction is selected
      if (externalDocumento && !rulePattern) {
        setRulePattern(externalDocumento);
      }
    }
  }, [externallySelectedId, externalDocumento, rulePattern]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!transactionId) return setError('transaction id is required');
    if (!category) return setError('category id is required');
    if (!tipo) return setError('tipo (RECEITA|DESPESA) is required');
    if (createRule && !rulePattern) return setError('pattern is required when creating a rule');

    setLoading(true);
    try {
      type RuleCreate = {
        name: string;
        pattern: string;
        matchType: 'CONTAINS' | 'REGEX';
        category: string;
        tipo: 'RECEITA' | 'DESPESA';
        priority: number;
        enabled: boolean;
        createdBy: string;
      };

      type OverridePayload = {
        newCategoryId: string;
        newTipo: 'RECEITA' | 'DESPESA';
        reason?: string;
        createRule?: boolean;
        rule?: RuleCreate;
      };

      const payload: OverridePayload = {
        newCategoryId: category,
        newTipo: tipo as 'RECEITA' | 'DESPESA',
        reason: note,
      };

      if (createRule) {
        payload.createRule = true;
        payload.rule = {
          name: ruleName || `Override for ${transactionId}`,
          pattern: rulePattern,
          matchType: ruleMatchType,
          category: category,
          tipo: tipo as 'RECEITA' | 'DESPESA',
          priority: 0,
          enabled: true,
          createdBy: 'ui-override',
        } as RuleCreate;
      }

      const res = await fetch(`/transactions/${encodeURIComponent(transactionId)}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}) as { message?: string });
        setError(body?.message || 'Failed to apply override');
        return;
      }

      setCategory('');
      setTipo('');
      setNote('');
      setTransactionId('');
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="override-form">
      <div>
        <label>
          Transaction ID
          <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
        </label>
      </div>
      <div>
        <label>
          Category ID
          <input value={category} onChange={(e) => setCategory(e.target.value)} />
        </label>
      </div>
      <div>
        <label>
          Tipo
          <select
            value={tipo}
            onChange={(e) => setTipo(e.target.value as 'RECEITA' | 'DESPESA' | '')}
          >
            <option value="">Select</option>
            <option value="RECEITA">RECEITA</option>
            <option value="DESPESA">DESPESA</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          Reason
          <textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <div style={{ marginTop: 8 }}>
        <label>
          <input
            type="checkbox"
            checked={createRule}
            onChange={(e) => setCreateRule(e.target.checked)}
          />{' '}
          Create rule from this decision
        </label>
      </div>

      {createRule && (
        <div style={{ marginTop: 8, padding: 8, border: '1px solid #ddd' }}>
          <div>
            <label>
              Rule name
              <input value={ruleName} onChange={(e) => setRuleName(e.target.value)} />
            </label>
          </div>
          <div>
            <label>
              Pattern <span style={{ color: 'red' }}>*</span>
              <input
                value={rulePattern}
                onChange={(e) => setRulePattern(e.target.value)}
                placeholder={externalDocumento || 'Enter pattern to match transaction'}
                required
              />
            </label>
            <div style={{ fontSize: '0.85em', color: '#666', marginTop: 4 }}>
              Pattern to match against transaction documento field
            </div>
          </div>
          <div>
            <label>
              Match type
              <select
                value={ruleMatchType}
                onChange={(e) => setRuleMatchType(e.target.value as 'CONTAINS' | 'REGEX')}
              >
                <option value="CONTAINS">CONTAINS</option>
                <option value="REGEX">REGEX</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <button type="submit" disabled={loading}>
        {loading ? 'Applying…' : 'Apply Override'}
      </button>
    </form>
  );
}
