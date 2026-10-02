'use client';

import { useState, useMemo, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import LeadsTable from './components/LeadsTable';
import Pipeline from './components/Pipeline';
import Campaigns from './components/Campaigns';
import Scraper from './components/Scraper';
import Settings from './components/Settings';
import ToastContainer from './components/ToastContainer';

export default function Home() {
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((type, message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard':
        return <Dashboard addToast={addToast} />;
      case 'leads-website':
        return <LeadsTable type="website" addToast={addToast} />;
      case 'leads-no-website':
        return <LeadsTable type="no-website" addToast={addToast} />;
      case 'pipeline':
        return <Pipeline addToast={addToast} />;
      case 'campaigns':
        return <Campaigns addToast={addToast} />;
      case 'scraper':
        return <Scraper addToast={addToast} />;
      case 'settings':
        return <Settings addToast={addToast} />;
      default:
        return <Dashboard addToast={addToast} />;
    }
  };

  return (
    <div className="app-layout">
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle sidebar"
      >
        {sidebarOpen ? '✕' : '☰'}
      </button>

      <Sidebar
        activePage={activePage}
        setActivePage={(page) => {
          setActivePage(page);
          setSidebarOpen(false);
        }}
        isOpen={sidebarOpen}
      />

      <main className="main-content">
        {renderPage()}
      </main>

      <ToastContainer toasts={toasts} />
    </div>
  );
}
