'use client';

import { useState, useEffect } from 'react';
import { demoCampaigns, demoLeadsWithWebsite, demoLeadsWithoutWebsite } from '../../lib/demoData';

const API_BASE = 'http://localhost:5001';

export default function Campaigns({ addToast }) {
  const [campaigns, setCampaigns] = useState(demoCampaigns);
  const [showCreate, setShowCreate] = useState(false);
  const [waStatus, setWaStatus] = useState({ sent_today: 0, daily_limit: 50, is_running: false });
  const [backendConnected, setBackendConnected] = useState(false);

  const [newCampaign, setNewCampaign] = useState({
    name: '',
    type: 'chatbot',
    dailyLimit: 20,
    delay: 60,
    messageTemplate: '',
  });

  // Check backend & fetch WhatsApp status
  useEffect(() => {
    checkConnection();
    const interval = setInterval(fetchWaStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const checkConnection = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) setBackendConnected(true);
    } catch {
      setBackendConnected(false);
    }
  };

  const fetchWaStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/whatsapp/status`);
      if (res.ok) {
        const data = await res.json();
        setWaStatus(data);
        setBackendConnected(true);
      }
    } catch {
      // Backend offline
    }
  };

  // Create and launch a campaign via the API
  const createCampaign = async () => {
    if (!newCampaign.name.trim()) {
      addToast('warning', 'Please enter a campaign name');
      return;
    }
    if (!newCampaign.messageTemplate.trim()) {
      addToast('warning', 'Please enter a message template');
      return;
    }

    // Get leads based on campaign type
    const isWebsite = newCampaign.type === 'chatbot';
    const leads = isWebsite ? demoLeadsWithWebsite : demoLeadsWithoutWebsite;
    const uncontactedLeads = leads.filter(l => l.whatsapp_status === 'uncontacted');

    // Try to launch via backend
    if (backendConnected) {
      try {
        const res = await fetch(`${API_BASE}/api/whatsapp/campaign/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leads: uncontactedLeads,
            message_template: newCampaign.messageTemplate,
            daily_limit: newCampaign.dailyLimit,
            delay: newCampaign.delay,
          }),
        });
        const data = await res.json();
        if (res.ok) {
          addToast('success', `Campaign launched! ${data.queued} messages queued.`);
        }
      } catch {
        addToast('warning', 'Backend offline — campaign saved locally');
      }
    }

    // Save campaign locally
    const campaign = {
      id: `c${Date.now()}`,
      name: newCampaign.name,
      type: newCampaign.type,
      dailyLimit: newCampaign.dailyLimit,
      delay: newCampaign.delay,
      status: 'active',
      sent: 0,
      pending: uncontactedLeads.length,
      failed: 0,
      createdAt: new Date().toISOString(),
    };
    setCampaigns(prev => [campaign, ...prev]);
    setShowCreate(false);
    setNewCampaign({ name: '', type: 'chatbot', dailyLimit: 20, delay: 60, messageTemplate: '' });
  };

  const toggleStatus = async (id) => {
    setCampaigns(prev =>
      prev.map(c => {
        if (c.id === id) {
          const newStatus = c.status === 'active' ? 'paused' : 'active';
          addToast('info', `Campaign "${c.name}" ${newStatus}`);
          return { ...c, status: newStatus };
        }
        return c;
      })
    );
  };

  const statusColors = {
    active: { bg: 'rgba(52, 211, 153, 0.12)', color: 'var(--color-accent-emerald)' },
    paused: { bg: 'rgba(251, 191, 36, 0.12)', color: 'var(--color-accent-amber)' },
    completed: { bg: 'rgba(99, 102, 241, 0.12)', color: 'var(--color-accent-indigo)' },
  };

  const sentPercent = waStatus.daily_limit > 0
    ? Math.min(100, (waStatus.sent_today / waStatus.daily_limit) * 100)
    : 0;

  const defaultChatbotTemplate = `Salam {{business_name}}! 👋

We reviewed your website at {{website_url}} — it looks great! But we noticed you don't have an automated way to capture leads 24/7.

We specialize in building custom AI chatbots that integrate directly into websites like yours to increase conversions by 40%.

Would you be open to a quick 5-minute demo?`;

  const defaultWebsiteTemplate = `Salam {{business_name}}! 👋

We were looking for your services in {{address}} but couldn't find a website for your business.

In today's digital age, a professional website is the fastest way to build trust and get more clients. We build premium, affordable websites.

Can we share some examples with you?`;

  return (
    <>
      <div className="page-header" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h2>📱 WhatsApp Campaigns</h2>
          <p>Manage automated outreach — connected to your WhatsApp Automation module</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            fontSize: '0.78rem', color: backendConnected ? 'var(--color-accent-emerald)' : 'var(--color-accent-rose)'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: backendConnected ? 'var(--color-accent-emerald)' : 'var(--color-accent-rose)' }} />
            {backendConnected ? 'WhatsApp API Connected' : 'WhatsApp API Offline'}
          </span>
          <button className="btn btn-primary" onClick={() => {
            setNewCampaign(prev => ({
              ...prev,
              messageTemplate: prev.type === 'chatbot' ? defaultChatbotTemplate : defaultWebsiteTemplate
            }));
            setShowCreate(true);
          }}>
            + New Campaign
          </button>
        </div>
      </div>

      {/* How it works */}
      <div className="glass-card" style={{ marginBottom: '20px', borderColor: 'rgba(99, 102, 241, 0.15)' }}>
        <div className="card-body" style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.3rem' }}>🔗</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '2px' }}>WhatsApp Automation Integration</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
                Campaigns connect to your <strong>Whatsapp Automation</strong> module via the backend API.
                The system uses Selenium to send messages through WhatsApp Web with configurable delays and daily limits.
                Messages are personalized using {'{{variables}}'} from your lead data.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Limit Tracker */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div className="card-body" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>📊 Daily Sending Progress</span>
            <span style={{ fontSize: '0.85rem', color: 'var(--color-accent-indigo)', fontWeight: 600 }}>
              {waStatus.sent_today} / {waStatus.daily_limit}
            </span>
          </div>
          <div className="progress-bar-container">
            <div className="progress-bar-fill" style={{ width: `${sentPercent}%` }}></div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
            <span>{waStatus.daily_limit - waStatus.sent_today} messages remaining today</span>
            <span>{sentPercent >= 100 ? '⛔ Limit reached — auto-paused' : 'Resets at midnight'}</span>
          </div>
        </div>
      </div>

      {/* Campaigns Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '20px' }}>
        {campaigns.map((campaign) => {
          const total = campaign.sent + campaign.pending + campaign.failed;
          const campSentPercent = total > 0 ? (campaign.sent / total) * 100 : 0;
          const statusStyle = statusColors[campaign.status] || statusColors.paused;

          return (
            <div key={campaign.id} className="campaign-card">
              <div className="campaign-header">
                <div>
                  <div className="campaign-name">{campaign.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>
                    {campaign.type === 'chatbot' ? '🤖 Chatbot Pitch' : '🏗️ Website Pitch'} · Delay: {campaign.delay}s · Limit: {campaign.dailyLimit}/day
                  </div>
                </div>
                <span style={{
                  padding: '4px 12px', borderRadius: '999px', fontSize: '0.72rem', fontWeight: 600,
                  textTransform: 'uppercase', background: statusStyle.bg, color: statusStyle.color
                }}>
                  {campaign.status}
                </span>
              </div>

              <div style={{ marginTop: '8px', marginBottom: '16px' }}>
                <div className="progress-bar-container">
                  <div className="progress-bar-fill" style={{ width: `${campSentPercent}%` }}></div>
                </div>
              </div>

              <div className="campaign-stats">
                <div className="campaign-stat">
                  <div className="campaign-stat-value" style={{ color: 'var(--color-accent-emerald)' }}>{campaign.sent}</div>
                  <div className="campaign-stat-label">Sent</div>
                </div>
                <div className="campaign-stat">
                  <div className="campaign-stat-value" style={{ color: 'var(--color-accent-amber)' }}>{campaign.pending}</div>
                  <div className="campaign-stat-label">Pending</div>
                </div>
                <div className="campaign-stat">
                  <div className="campaign-stat-value" style={{ color: 'var(--color-accent-rose)' }}>{campaign.failed}</div>
                  <div className="campaign-stat-label">Failed</div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
                {campaign.status !== 'completed' && (
                  <button
                    className={`btn btn-sm ${campaign.status === 'active' ? 'btn-ghost' : 'btn-success'}`}
                    onClick={() => toggleStatus(campaign.id)}
                    style={{ flex: 1 }}
                  >
                    {campaign.status === 'active' ? '⏸ Pause' : '▶ Resume'}
                  </button>
                )}
                <button className="btn btn-ghost btn-sm" onClick={() => addToast('info', `Viewing logs for "${campaign.name}"`)}>
                  📋 Logs
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Create Campaign Modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '620px' }}>
            <div className="modal-header">
              <h3>🚀 Create WhatsApp Campaign</h3>
              <button className="btn-icon" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="input-group">
                <label>Campaign Name</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., Dental Clinics — Chatbot Push"
                  value={newCampaign.name}
                  onChange={(e) => setNewCampaign({ ...newCampaign, name: e.target.value })}
                />
              </div>

              <div className="input-group">
                <label>Target Audience</label>
                <select
                  className="select"
                  value={newCampaign.type}
                  onChange={(e) => {
                    const type = e.target.value;
                    setNewCampaign({
                      ...newCampaign,
                      type,
                      messageTemplate: type === 'chatbot' ? defaultChatbotTemplate : defaultWebsiteTemplate
                    });
                  }}
                >
                  <option value="chatbot">🤖 Leads WITH Website → Chatbot Pitch</option>
                  <option value="website">🏗️ Leads WITHOUT Website → Website Pitch</option>
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Daily Limit</label>
                  <input
                    type="number"
                    className="input"
                    value={newCampaign.dailyLimit}
                    onChange={(e) => setNewCampaign({ ...newCampaign, dailyLimit: parseInt(e.target.value) || 20 })}
                    min={1} max={100}
                  />
                </div>
                <div className="input-group">
                  <label>Delay Between Messages (sec)</label>
                  <input
                    type="number"
                    className="input"
                    value={newCampaign.delay}
                    onChange={(e) => setNewCampaign({ ...newCampaign, delay: parseInt(e.target.value) || 60 })}
                    min={30} max={300}
                  />
                </div>
              </div>

              <div className="input-group">
                <label>📝 Message Template</label>
                <textarea
                  className="input"
                  value={newCampaign.messageTemplate}
                  onChange={(e) => setNewCampaign({ ...newCampaign, messageTemplate: e.target.value })}
                  rows={6}
                  style={{ minHeight: '150px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem', lineHeight: 1.6 }}
                />
              </div>

              <div style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-accent-indigo)', marginBottom: '6px' }}>
                  💡 How it works
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                  1. Campaign picks uncontacted leads from the selected audience<br/>
                  2. {'{{variables}}'} in your template are replaced with actual lead data<br/>
                  3. Messages are sent via your <strong>WhatsApp Automation</strong> module using Selenium<br/>
                  4. System waits <strong>{newCampaign.delay}s</strong> between messages and pauses at <strong>{newCampaign.dailyLimit}/day</strong>
                </div>
              </div>

              <div style={{ padding: '10px 16px', background: 'rgba(34, 211, 238, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(34, 211, 238, 0.12)' }}>
                <div style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)' }}>
                  <strong style={{ color: 'var(--color-accent-cyan)' }}>Variables:</strong>{' '}
                  {'{{business_name}}'} · {'{{phone_number}}'} · {'{{address}}'} · {'{{website_url}}'} · {'{{rating}}'} · {'{{reviews}}'}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={createCampaign}>🚀 Launch Campaign</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
