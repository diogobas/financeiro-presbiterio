import React, { useEffect, useState } from 'react';
import OverrideForm from '../components/review/OverrideForm';

type Tx = {
  id: string;
  date: string;
  documento: string | null;
  amount: number;
  currency: string;
  tipo?: string | null;
};

export default function ReviewPage() {
  const [accountId, setAccountId] = useState('');
  const [transactions, setTransactions] = useState<Tx[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [selected, setSelected] = useState<Tx | null>(null);

  const fetchList = async () => {
    if (!accountId) return;
    const res = await fetch(
      `/transactions/unclassified?accountId=${encodeURIComponent(accountId)}&page=${page}&limit=${limit}`
    );
    if (!res.ok) return;
    const body = await res.json();
    setTransactions(body.data || []);
    setTotal(body.total || 0);
  };

  useEffect(() => {
    fetchList().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <div className="review-page">
      <h1>Review Queue</h1>

      <div style={{ marginBottom: 12 }}>
        <label>
          Account ID: <input value={accountId} onChange={(e) => setAccountId(e.target.value)} />
        </label>
        <button
          style={{ marginLeft: 8 }}
          onClick={() => {
            setPage(1);
            fetchList();
          }}
        >
          Load
        </button>
      </div>

      <div className="review-list">
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Date</th>
              <th>Documento</th>
              <th>Amount</th>
              <th>Tipo</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id}>
                <td>{t.id}</td>
                <td>{new Date(t.date).toLocaleDateString()}</td>
                <td>{t.documento}</td>
                <td>{t.amount.toFixed(2)}</td>
                <td>{t.tipo || '-'}</td>
                <td>
                  <button onClick={() => setSelected(t)}>Override</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 8 }}>
          <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>
            Prev
          </button>
          <span style={{ margin: '0 8px' }}>{page}</span>
          <button onClick={() => setPage(page + 1)} disabled={transactions.length < limit}>
            Next
          </button>
          <span style={{ marginLeft: 8 }}>Total: {total}</span>
        </div>
      </div>

      <h2 style={{ marginTop: 20 }}>Override</h2>
      <OverrideForm
        transactionId={selected ? selected.id : undefined}
        onSuccess={() => {
          setSelected(null);
          fetchList().catch(console.error);
        }}
      />
    </div>
  );
}
