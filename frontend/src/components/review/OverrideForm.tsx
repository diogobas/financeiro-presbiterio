import React, { useEffect, useState } from 'react';

type Props = {
  transactionId?: string;
  onSuccess?: () => void;
};

export default function OverrideForm({ transactionId: externallySelectedId, onSuccess }: Props) {
  const [transactionId, setTransactionId] = useState(externallySelectedId || '');
  const [category, setCategory] = useState('');
  const [tipo, setTipo] = useState<'RECEITA' | 'DESPESA' | ''>('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (externallySelectedId) setTransactionId(externallySelectedId);
  }, [externallySelectedId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!transactionId) return setError('transaction id is required');
    if (!category) return setError('category id is required');
    if (!tipo) return setError('tipo (RECEITA|DESPESA) is required');

    setLoading(true);
    try {
      const res = await fetch(`/transactions/${encodeURIComponent(transactionId)}/override`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newCategoryId: category, newTipo: tipo, reason: note }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.message || 'Failed to apply override');
        return;
      }

      setCategory('');
      setTipo('');
      setNote('');
      setTransactionId('');
      onSuccess && onSuccess();
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
          <select value={tipo} onChange={(e) => setTipo(e.target.value as any)}>
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

      {error && <div style={{ color: 'red' }}>{error}</div>}

      <button type="submit" disabled={loading}>{loading ? 'Applying…' : 'Apply Override'}</button>
    </form>
  );
}
