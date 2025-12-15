import React, { useState } from 'react';

export default function OverrideForm() {
  const [transactionId, setTransactionId] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: call POST /transactions/:id/override
    alert('Override submitted (TODO)');
  };

  return (
    <form onSubmit={submit} className="override-form">
      <label>
        Transaction ID
        <input value={transactionId} onChange={(e) => setTransactionId(e.target.value)} />
      </label>
      <label>
        Category
        <input value={category} onChange={(e) => setCategory(e.target.value)} />
      </label>
      <label>
        Note
        <textarea value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      <button type="submit">Apply Override</button>
    </form>
  );
}
