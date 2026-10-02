'use client';

import { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://localhost:5001';

// Full predefined lists matching the Python scraper
const ALL_CATEGORIES = [
  { group: 'Healthcare', items: ['Clinics', 'Medical Stores', 'Dentists', 'Physiotherapy Centers', 'Hospitals', 'Pharmacies'] },
  { group: 'Real Estate', items: ['Property Dealers', 'Real Estate Agencies', 'Builders and Developers'] },
  { group: 'Fitness & Wellness', items: ['Gyms', 'Yoga Studios', 'Salons', 'Spas', 'Beauty Parlors'] },
  { group: 'Professional Services', items: ['Law Firms', 'Accounting Firms', 'Architecture Firms', 'Tax Consultants'] },
  { group: 'Education', items: ['Coaching Centers', 'Training Institutes', 'Private Schools', 'Tuition Centers'] },
  { group: 'Automotive', items: ['Car Dealerships', 'Auto Repair Shops', 'Car Wash'] },
  { group: 'Hospitality & Events', items: ['Event Planners', 'Wedding Halls', 'Travel Agencies', 'Hotels', 'Restaurants', 'Catering Services'] },
];

const ALL_CITIES = [
  'Lahore', 'Karachi', 'Islamabad', 'Rawalpindi', 'Faisalabad',
  'Peshawar', 'Multan', 'Gujranwala', 'Sialkot', 'Quetta',
];

export default function Scraper({ addToast }) {
  // Scraper state
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, with_website: 0, without_website: 0, duplicates: 0, errors: 0 });
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [currentQuery, setCurrentQuery] = useState('');

  // Selection state
  const [selectedCategories, setSelectedCategories] = useState(new Set());
  const [selectedCities, setSelectedCities] = useState(new Set(['Lahore']));
  const [customQuery, setCustomQuery] = useState('');

  // Backend connection
  const [backendConnected, setBackendConnected] = useState(false);

  const logEndRef = useRef(null);
  const pollRef = useRef(null);

  // Scroll console to bottom
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Check backend connection
  useEffect(() => {
    checkBackend();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, []);

  const checkBackend = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        setBackendConnected(true);
        addToast('success', 'Backend API connected');
      }
    } catch {
      setBackendConnected(false);
    }
  };

  // Poll scraper status when running
  useEffect(() => {
    if (isRunning) {
      let logIndex = 0;
      pollRef.current = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/api/scraper/status?since=${logIndex}`);
          const data = await res.json();

          if (data.logs && data.logs.length > 0) {
            setLogs(prev => [...prev, ...data.logs]);
            logIndex = data.total_logs;
          }
          setStats(data.stats);
          setProgress(data.progress);
          setCurrentQuery(data.current_query || '');

          if (!data.is_running) {
            setIsRunning(false);
            clearInterval(pollRef.current);
            addToast('success', 'Scraping session complete!');
          }
        } catch {
          // Backend disconnected
        }
      }, 2000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [isRunning]);

  // Toggle category selection
  const toggleCategory = (cat) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  // Toggle city selection
  const toggleCity = (city) => {
    setSelectedCities(prev => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  };

  // Select all in a group
  const toggleGroup = (groupItems) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      const allSelected = groupItems.every(item => next.has(item));
      if (allSelected) {
        groupItems.forEach(item => next.delete(item));
      } else {
        groupItems.forEach(item => next.add(item));
      }
      return next;
    });
  };

  const selectAllCities = () => {
    if (selectedCities.size === ALL_CITIES.length) {
      setSelectedCities(new Set());
    } else {
      setSelectedCities(new Set(ALL_CITIES));
    }
  };

  // Start scraping
  const startScraping = async () => {
    if (!backendConnected) {
      addToast('error', 'Backend API not connected. Start the server first: python server/app.py');
      return;
    }

    const categories = Array.from(selectedCategories);
    const cities = Array.from(selectedCities);
    const customQueries = customQuery.trim()
      ? customQuery.split('\n').map(q => q.trim()).filter(Boolean)
      : [];

    if (customQueries.length === 0 && (categories.length === 0 || cities.length === 0)) {
      addToast('warning', 'Select at least one category and one city, or enter custom queries');
      return;
    }

    setLogs([]);
    setStats({ total: 0, with_website: 0, without_website: 0, duplicates: 0, errors: 0 });

    try {
      const res = await fetch(`${API_BASE}/api/scraper/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categories: customQueries.length > 0 ? [] : categories,
          cities: customQueries.length > 0 ? [] : cities,
          custom_queries: customQueries.length > 0 ? customQueries : [],
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setIsRunning(true);
        addToast('success', 'Scraper started!');
      } else {
        addToast('error', data.error || 'Failed to start scraper');
      }
    } catch {
      addToast('error', 'Cannot connect to backend API');
    }
  };

  // Stop scraping
  const stopScraping = async () => {
    try {
      await fetch(`${API_BASE}/api/scraper/stop`, { method: 'POST' });
      setIsRunning(false);
      addToast('warning', 'Scraper stopped');
    } catch {
      addToast('error', 'Failed to stop scraper');
    }
  };

  const totalQueries = customQuery.trim()
    ? customQuery.split('\n').filter(q => q.trim()).length
    : selectedCategories.size * selectedCities.size;

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h2>🤖 Scraper Engine</h2>
            <p>Google Maps business scraper — extracts leads, filters by website, prevents duplicates</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: backendConnected ? 'var(--color-accent-emerald)' : 'var(--color-accent-rose)',
              }}
            />
            <span style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
              {backendConnected ? 'API Connected' : 'API Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Backend warning */}
      {!backendConnected && (
        <div className="glass-card" style={{ marginBottom: '20px', borderColor: 'rgba(251, 113, 133, 0.3)' }}>
          <div className="card-body" style={{ padding: '16px 24px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
              <span style={{ fontSize: '1.3rem' }}>⚠️</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: 'var(--color-accent-rose)' }}>
                  Backend Server Not Running
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  Start the API server first:
                  <code style={{
                    display: 'block',
                    marginTop: '8px',
                    padding: '8px 12px',
                    background: 'rgba(0,0,0,0.3)',
                    borderRadius: '6px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '0.78rem',
                  }}>
                    cd server && pip install -r requirements.txt && python app.py
                  </code>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ marginTop: '10px' }} onClick={checkBackend}>
                  🔄 Retry Connection
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: '24px' }}>
        {/* LEFT: Category & City Selection */}
        <div className="glass-card">
          <div className="card-header">
            <h3>🎯 Search Query Builder</h3>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-accent-indigo)', fontWeight: 600 }}>
              {totalQueries} queries
            </span>
          </div>
          <div className="card-body" style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {/* Cities */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.85rem' }}>📍 Target Cities</span>
                <button className="btn btn-ghost btn-sm" style={{ padding: '4px 10px', fontSize: '0.72rem' }} onClick={selectAllCities}>
                  {selectedCities.size === ALL_CITIES.length ? 'Deselect All' : 'Select All'}
                </button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {ALL_CITIES.map(city => (
                  <button
                    key={city}
                    onClick={() => toggleCity(city)}
                    disabled={isRunning}
                    style={{
                      padding: '5px 14px',
                      borderRadius: '999px',
                      fontSize: '0.78rem',
                      fontWeight: 500,
                      border: '1px solid',
                      cursor: isRunning ? 'not-allowed' : 'pointer',
                      fontFamily: 'var(--font-sans)',
                      transition: 'all 150ms',
                      background: selectedCities.has(city) ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                      color: selectedCities.has(city) ? 'var(--color-accent-indigo)' : 'var(--color-text-secondary)',
                      borderColor: selectedCities.has(city) ? 'rgba(99, 102, 241, 0.3)' : 'var(--color-border-glass)',
                    }}
                  >
                    {selectedCities.has(city) ? '✓ ' : ''}{city}
                  </button>
                ))}
              </div>
            </div>

            {/* Categories by group */}
            <div>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '12px' }}>
                🏢 Business Categories
              </span>
              {ALL_CATEGORIES.map(group => {
                const allGroupSelected = group.items.every(item => selectedCategories.has(item));
                return (
                  <div key={group.group} style={{ marginBottom: '14px' }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        {group.group}
                      </span>
                      <button
                        onClick={() => toggleGroup(group.items)}
                        disabled={isRunning}
                        style={{
                          fontSize: '0.68rem',
                          color: 'var(--color-accent-cyan)',
                          background: 'none',
                          border: 'none',
                          cursor: isRunning ? 'not-allowed' : 'pointer',
                          fontFamily: 'var(--font-sans)',
                        }}
                      >
                        {allGroupSelected ? 'Deselect All' : 'Select All'}
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                      {group.items.map(cat => (
                        <button
                          key={cat}
                          onClick={() => toggleCategory(cat)}
                          disabled={isRunning}
                          style={{
                            padding: '4px 12px',
                            borderRadius: '999px',
                            fontSize: '0.75rem',
                            fontWeight: 500,
                            border: '1px solid',
                            cursor: isRunning ? 'not-allowed' : 'pointer',
                            fontFamily: 'var(--font-sans)',
                            transition: 'all 150ms',
                            background: selectedCategories.has(cat) ? 'rgba(34, 211, 238, 0.12)' : 'transparent',
                            color: selectedCategories.has(cat) ? 'var(--color-accent-cyan)' : 'var(--color-text-muted)',
                            borderColor: selectedCategories.has(cat) ? 'rgba(34, 211, 238, 0.2)' : 'rgba(255,255,255,0.05)',
                          }}
                        >
                          {selectedCategories.has(cat) ? '✓ ' : ''}{cat}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom queries */}
            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--color-border-glass)' }}>
              <span style={{ fontWeight: 600, fontSize: '0.85rem', display: 'block', marginBottom: '8px' }}>
                ✏️ Custom Queries (one per line)
              </span>
              <textarea
                className="input"
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                placeholder={"Dentists in Karachi\nGyms in Lahore\nSalons in Islamabad"}
                rows={3}
                disabled={isRunning}
                style={{ minHeight: '80px', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
              />
              <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px', display: 'block' }}>
                Custom queries override category + city selections
              </span>
            </div>
          </div>
        </div>

        {/* RIGHT: Stats + Controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Controls */}
          <div className="glass-card">
            <div className="card-header">
              <h3>🎮 Controls</h3>
            </div>
            <div className="card-body">
              {currentQuery && isRunning && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(99, 102, 241, 0.06)',
                  borderRadius: 'var(--radius-sm)',
                  marginBottom: '16px',
                  fontSize: '0.8rem',
                  color: 'var(--color-accent-indigo)',
                }}>
                  🔍 Current: <strong>{currentQuery}</strong>
                  {progress.total > 0 && (
                    <span style={{ float: 'right', color: 'var(--color-text-muted)' }}>
                      {progress.current}/{progress.total}
                    </span>
                  )}
                </div>
              )}

              {progress.total > 0 && isRunning && (
                <div style={{ marginBottom: '16px' }}>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{ width: `${(progress.current / progress.total) * 100}%` }} />
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: '10px' }}>
                {!isRunning ? (
                  <button className="btn btn-success" onClick={startScraping} style={{ flex: 1 }}>
                    ▶ Start Scraping
                  </button>
                ) : (
                  <button className="btn btn-danger" onClick={stopScraping} style={{ flex: 1 }}>
                    ⏹ Stop Scraping
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Session Stats */}
          <div className="glass-card">
            <div className="card-header">
              <h3>📊 Session Stats</h3>
              <span style={{
                fontSize: '0.78rem',
                fontWeight: 700,
                color: isRunning ? 'var(--color-accent-emerald)' : 'var(--color-text-muted)',
              }}>
                {isRunning ? '● LIVE' : '○ IDLE'}
              </span>
            </div>
            <div className="card-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { label: 'Total Found', value: stats.total, color: 'var(--color-accent-indigo)', icon: '📋' },
                  { label: 'Has Website', value: stats.with_website, color: 'var(--color-accent-cyan)', icon: '🌐' },
                  { label: 'No Website', value: stats.without_website, color: 'var(--color-accent-amber)', icon: '🚫' },
                  { label: 'Duplicates', value: stats.duplicates, color: 'var(--color-accent-rose)', icon: '🔄' },
                ].map(item => (
                  <div key={item.label} style={{
                    textAlign: 'center',
                    padding: '16px',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    <div style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{item.icon}</div>
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: item.color }}>{item.value}</div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginTop: '2px' }}>
                      {item.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Console */}
      <div className="glass-card">
        <div className="card-header">
          <h3>💻 Live Console</h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {logs.length} entries
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => setLogs([])} disabled={isRunning} style={{ padding: '4px 10px', fontSize: '0.72rem' }}>
              Clear
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="console-window">
            <div className="console-toolbar">
              <div className="console-dots"><span></span><span></span><span></span></div>
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                scraper@leadflow:~$
              </span>
            </div>
            <div className="console-output" style={{ maxHeight: '350px' }}>
              {logs.length === 0 ? (
                <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  Select categories & cities, then click "Start Scraping"...
                </div>
              ) : (
                logs.map((log, i) => (
                  <div key={i} className={`console-line ${log.type}`}>
                    <span className="timestamp">[{log.time}]</span>
                    <span className="log-text">{log.text}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
