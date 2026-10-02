'use client';

import { demoLeadsWithWebsite, demoLeadsWithoutWebsite } from '../../lib/demoData';

export default function Dashboard({ addToast }) {
  const allLeads = [...demoLeadsWithWebsite, ...demoLeadsWithoutWebsite];
  const totalLeads = allLeads.length;
  const withWebsite = demoLeadsWithWebsite.length;
  const withoutWebsite = demoLeadsWithoutWebsite.length;
  const contacted = allLeads.filter((l) => l.status !== 'New').length;
  const sentMessages = allLeads.filter((l) => l.whatsapp_status === 'sent' || l.whatsapp_status === 'delivered' || l.whatsapp_status === 'read').length;

  const statusCounts = allLeads.reduce((acc, lead) => {
    acc[lead.status] = (acc[lead.status] || 0) + 1;
    return acc;
  }, {});

  const recentLeads = [...allLeads]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <>
      <div className="page-header">
        <h2>Dashboard</h2>
        <p>Overview of your lead generation pipeline</p>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card indigo">
          <div className="stat-header">
            <span className="stat-label">Total Leads</span>
            <div className="stat-icon">📊</div>
          </div>
          <div className="stat-value">{totalLeads}</div>
          <div className="stat-change positive">
            ↑ +12 this week
          </div>
        </div>

        <div className="stat-card cyan">
          <div className="stat-header">
            <span className="stat-label">Has Website</span>
            <div className="stat-icon">🌐</div>
          </div>
          <div className="stat-value">{withWebsite}</div>
          <div className="stat-change positive">
            Chatbot prospects
          </div>
        </div>

        <div className="stat-card amber">
          <div className="stat-header">
            <span className="stat-label">No Website</span>
            <div className="stat-icon">🚫</div>
          </div>
          <div className="stat-value">{withoutWebsite}</div>
          <div className="stat-change positive">
            Web dev prospects
          </div>
        </div>

        <div className="stat-card emerald">
          <div className="stat-header">
            <span className="stat-label">Messages Sent</span>
            <div className="stat-icon">📱</div>
          </div>
          <div className="stat-value">{sentMessages}</div>
          <div className="stat-change positive">
            ↑ via WhatsApp
          </div>
        </div>
      </div>

      {/* Two columns: Pipeline breakdown + Recent leads */}
      <div className="grid-2">
        {/* Pipeline Status Breakdown */}
        <div className="glass-card">
          <div className="card-header">
            <h3>📋 Pipeline Breakdown</h3>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[
                { label: 'New', count: statusCounts['New'] || 0, color: 'var(--color-status-new)', bg: 'rgba(99, 102, 241, 0.12)' },
                { label: 'Contacted', count: statusCounts['Contacted'] || 0, color: 'var(--color-status-contacted)', bg: 'rgba(251, 191, 36, 0.12)' },
                { label: 'Interested', count: statusCounts['Interested'] || 0, color: 'var(--color-status-interested)', bg: 'rgba(34, 211, 238, 0.12)' },
                { label: 'Meeting', count: statusCounts['Meeting'] || 0, color: 'var(--color-status-meeting)', bg: 'rgba(167, 139, 250, 0.12)' },
                { label: 'Closed', count: statusCounts['Closed'] || 0, color: 'var(--color-status-closed)', bg: 'rgba(52, 211, 153, 0.12)' },
                { label: 'Rejected', count: statusCounts['Rejected'] || 0, color: 'var(--color-status-rejected)', bg: 'rgba(251, 113, 133, 0.12)' },
              ].map((item) => (
                <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--color-text-secondary)', width: '80px' }}>
                    {item.label}
                  </span>
                  <div style={{ flex: 1, height: '8px', background: 'rgba(255,255,255,0.04)', borderRadius: '999px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${totalLeads > 0 ? (item.count / totalLeads) * 100 : 0}%`,
                        height: '100%',
                        background: item.color,
                        borderRadius: '999px',
                        transition: 'width 0.5s ease',
                        minWidth: item.count > 0 ? '8px' : '0',
                      }}
                    />
                  </div>
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: item.color, width: '24px', textAlign: 'right' }}>
                    {item.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Recent Leads */}
        <div className="glass-card">
          <div className="card-header">
            <h3>🕐 Recent Leads</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <div className="data-table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Business</th>
                    <th>Status</th>
                    <th>Type</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeads.map((lead) => (
                    <tr key={lead.id}>
                      <td>{lead.business_name}</td>
                      <td>
                        <span className={`badge ${lead.status.toLowerCase()}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td style={{ color: lead.website_url ? 'var(--color-accent-cyan)' : 'var(--color-accent-amber)' }}>
                        {lead.website_url ? '🌐 Website' : '🚫 No site'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Outreach Summary */}
      <div className="glass-card" style={{ marginTop: '24px' }}>
        <div className="card-header">
          <h3>📱 WhatsApp Outreach Summary</h3>
        </div>
        <div className="card-body">
          <div className="stats-grid" style={{ marginBottom: 0 }}>
            {[
              { label: 'Uncontacted', count: allLeads.filter((l) => l.whatsapp_status === 'uncontacted').length, color: 'var(--color-text-muted)', icon: '⏳' },
              { label: 'Queued', count: allLeads.filter((l) => l.whatsapp_status === 'queued').length, color: 'var(--color-accent-amber)', icon: '📋' },
              { label: 'Sent', count: allLeads.filter((l) => l.whatsapp_status === 'sent').length, color: 'var(--color-accent-emerald)', icon: '✅' },
              { label: 'Delivered', count: allLeads.filter((l) => l.whatsapp_status === 'delivered').length, color: 'var(--color-accent-cyan)', icon: '📬' },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  textAlign: 'center',
                  padding: '20px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--color-border-glass)',
                }}
              >
                <div style={{ fontSize: '1.5rem', marginBottom: '8px' }}>{item.icon}</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: item.color }}>{item.count}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', marginTop: '4px' }}>
                  {item.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
