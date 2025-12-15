import React from 'react';
import OverrideForm from '../components/review/OverrideForm';

export default function ReviewPage() {
  return (
    <div className="review-page">
      <h1>Review Queue</h1>
      <p>List of unclassified transactions (TODO: wire to API)</p>
      <div className="review-list">{/* TODO: transaction list with pagination */}</div>

      <h2>Override</h2>
      <OverrideForm />
    </div>
  );
}
