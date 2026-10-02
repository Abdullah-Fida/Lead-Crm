'use client';

export default function Sidebar({ activePage, setActivePage, isOpen }) {
  const navItems = [
    { section: 'Overview' },
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { section: 'Leads' },
    { id: 'leads-website', label: 'Has Website', icon: '🌐', badge: '8' },
    { id: 'leads-no-website', label: 'No Website', icon: '🚫', badge: '10' },
    { section: 'Sales' },
    { id: 'pipeline', label: 'Pipeline', icon: '📋' },
    { id: 'campaigns', label: 'Campaigns', icon: '📱' },
    { section: 'Tools' },
    { id: 'scraper', label: 'Scraper Engine', icon: '🤖' },
    { section: 'System' },
    { id: 'settings', label: 'Settings', icon: '⚙️' },
  ];

  return (
    <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <h1>⚡ LeadFlow CRM</h1>
        <p>AI-Powered Lead Engine</p>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item, index) => {
          if (item.section) {
            return (
              <div key={`section-${index}`} className="sidebar-section-label">
                {item.section}
              </div>
            );
          }
          return (
            <button
              key={item.id}
              className={`nav-item ${activePage === item.id ? 'active' : ''}`}
              onClick={() => setActivePage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              {item.label}
              {item.badge && <span className="nav-badge">{item.badge}</span>}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div style={{ display: 'flex', alignItems: 'center', fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
          <span className="status-dot"></span>
          System Online
        </div>
        <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
          v1.0.0 — Demo Mode
        </div>
      </div>
    </aside>
  );
}
