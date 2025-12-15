import './App.css';
import { useState } from 'react';
import { UploadPage } from './pages/UploadPage';
import { RulesPage } from './pages/RulesPage';
import ReviewPage from './pages/ReviewPage';

function App() {
  const [currentPage, setCurrentPage] = useState<'upload' | 'rules' | 'review'>('upload');

  return (
    <div className="App">
      <nav className="app-nav">
        <div className="nav-brand">
          <h1>Financeiro Presbitério</h1>
        </div>
        <div className="nav-tabs">
          <button
            className={`nav-tab ${currentPage === 'upload' ? 'active' : ''}`}
            onClick={() => setCurrentPage('upload')}
          >
            📤 Upload CSV
          </button>
          <button
            className={`nav-tab ${currentPage === 'rules' ? 'active' : ''}`}
            onClick={() => setCurrentPage('rules')}
          >
            📋 Rules
          </button>
          <button
            className={`nav-tab ${currentPage === 'review' ? 'active' : ''}`}
            onClick={() => setCurrentPage('review')}
          >
            🧾 Review
          </button>
        </div>
      </nav>

      <main className="app-content">
        {currentPage === 'upload' && <UploadPage />}
        {currentPage === 'rules' && <RulesPage />}
        {currentPage === 'review' && <ReviewPage />}
      </main>
    </div>
  );
}

export default App;
