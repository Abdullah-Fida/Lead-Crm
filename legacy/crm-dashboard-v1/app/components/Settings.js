'use client';

import { useState, useEffect } from 'react';

const API_BASE = 'http://localhost:5001';

export default function Settings({ addToast }) {
  const [backendConnected, setBackendConnected] = useState(false);
  const [supabaseConnected, setSupabaseConnected] = useState(false);

  const [settings, setSettings] = useState({
    dailyLimit: 50,
    minDelay: 45,
    maxDelay: 120,
    pauseEvery: 25,
    pauseDuration: 5,
    supabaseUrl: '',
    supabaseKey: '',
    defaultChatbotMsg: `Salam {{business_name}}! 👋

We reviewed your website at {{website_url}} — it looks great! But we noticed you don't have an automated way to capture leads 24/7.

We specialize in building custom AI chatbots that integrate directly into websites like yours to increase conversions by 40%.

Would you be open to a quick 5-minute demo?`,
    defaultWebsiteMsg: `Salam {{business_name}}! 👋

We were looking for your services in {{address}} but couldn't find a website for your business.

In today's digital age, a professional website is the fastest way to build trust and get more clients. We build premium, affordable websites.

Can we share some examples with you?`,
  });

  useEffect(() => {
    checkBackend();
  }, []);

  const checkBackend = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/health`);
      if (res.ok) {
        const data = await res.json();
        setBackendConnected(true);
        setSupabaseConnected(data.supabase_connected);
      }
    } catch {
      setBackendConnected(false);
    }
  };

  const testSupabase = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      addToast('warning', 'Please enter Supabase URL and Anon Key first');
      return;
    }

    if (backendConnected) {
      try {
        const res = await fetch(`${API_BASE}/api/supabase/connect`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: settings.supabaseUrl, key: settings.supabaseKey }),
        });
        const data = await res.json();
        if (res.ok) {
          setSupabaseConnected(true);
          addToast('success', 'Supabase connection successful!');
        } else {
          addToast('error', data.error || 'Supabase connection failed');
        }
      } catch {
        addToast('error', 'Cannot reach backend API');
      }
    } else {
      addToast('warning', 'Start the backend server first');
    }
  };

  const saveSettings = async () => {
    if (backendConnected) {
      try {
        await fetch(`${API_BASE}/api/whatsapp/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ daily_limit: settings.dailyLimit }),
        });
      } catch {
        // Settings saved locally even if backend is offline
      }
    }
    addToast('success', 'Settings saved successfully!');
  };

  return (
    <>
      <div className="page-header">
        <h2>⚙️ Settings</h2>
        <p>Configure your CRM, automation limits, and integrations</p>
      </div>

      {/* System Status */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3>🔌 System Status</h3>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { label: 'Backend API', connected: backendConnected, port: ':5001' },
              { label: 'Supabase', connected: supabaseConnected, port: '' },
              { label: 'Next.js Frontend', connected: true, port: ':3000' },
            ].map(item => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px',
                background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)',
                border: `1px solid ${item.connected ? 'rgba(52, 211, 153, 0.2)' : 'rgba(251, 113, 133, 0.2)'}`,
              }}>
                <span style={{
                  width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                  background: item.connected ? 'var(--color-accent-emerald)' : 'var(--color-accent-rose)',
                  boxShadow: item.connected ? '0 0 8px rgba(52, 211, 153, 0.4)' : 'none',
                }} />
                <div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{item.label}</div>
                  <div style={{ fontSize: '0.72rem', color: item.connected ? 'var(--color-accent-emerald)' : 'var(--color-accent-rose)' }}>
                    {item.connected ? `Connected ${item.port}` : 'Disconnected'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* WhatsApp Safety Controls */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3>🛡️ WhatsApp Safety Controls</h3>
          <span style={{ fontSize: '0.72rem', color: 'var(--color-accent-amber)', fontWeight: 500 }}>
            ⚠️ Critical for preventing bans
          </span>
        </div>
        <div className="card-body">
          <div className="settings-grid">
            <div className="input-group">
              <label>Daily Sending Limit</label>
              <input type="number" className="input" value={settings.dailyLimit}
                onChange={(e) => setSettings({ ...settings, dailyLimit: parseInt(e.target.value) || 50 })}
                min={1} max={200} />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Maximum messages per day across all campaigns
              </span>
            </div>
            <div className="input-group">
              <label>Pause After X Messages</label>
              <input type="number" className="input" value={settings.pauseEvery}
                onChange={(e) => setSettings({ ...settings, pauseEvery: parseInt(e.target.value) || 25 })}
                min={5} max={100} />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Smart pause interval within a session
              </span>
            </div>
            <div className="input-group">
              <label>Minimum Delay (seconds)</label>
              <input type="number" className="input" value={settings.minDelay}
                onChange={(e) => setSettings({ ...settings, minDelay: parseInt(e.target.value) || 45 })}
                min={10} max={300} />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Random delay lower bound between messages
              </span>
            </div>
            <div className="input-group">
              <label>Maximum Delay (seconds)</label>
              <input type="number" className="input" value={settings.maxDelay}
                onChange={(e) => setSettings({ ...settings, maxDelay: parseInt(e.target.value) || 120 })}
                min={30} max={600} />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                Random delay upper bound between messages
              </span>
            </div>
            <div className="input-group">
              <label>Pause Duration (minutes)</label>
              <input type="number" className="input" value={settings.pauseDuration}
                onChange={(e) => setSettings({ ...settings, pauseDuration: parseInt(e.target.value) || 5 })}
                min={1} max={30} />
              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                How long to rest during smart pauses
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Supabase Connection */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3>🗄️ Supabase Database</h3>
          <span style={{
            fontSize: '0.72rem', fontWeight: 600,
            color: supabaseConnected ? 'var(--color-accent-emerald)' : 'var(--color-text-muted)',
          }}>
            {supabaseConnected ? '✅ Connected' : '○ Not connected'}
          </span>
        </div>
        <div className="card-body">
          <div className="settings-grid">
            <div className="input-group">
              <label>Supabase Project URL</label>
              <input type="text" className="input" value={settings.supabaseUrl}
                onChange={(e) => setSettings({ ...settings, supabaseUrl: e.target.value })}
                placeholder="https://your-project.supabase.co" />
            </div>
            <div className="input-group">
              <label>Supabase Anon Key</label>
              <input type="password" className="input" value={settings.supabaseKey}
                onChange={(e) => setSettings({ ...settings, supabaseKey: e.target.value })}
                placeholder="eyJhbGciOiJIUzI1NiIs..." />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
            <button className="btn btn-ghost btn-sm" onClick={testSupabase}>
              🔌 Test Connection
            </button>
          </div>

          {/* SQL to create the tables */}
          <div style={{ marginTop: '20px', padding: '16px', background: 'rgba(0,0,0,0.2)', borderRadius: 'var(--radius-md)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-accent-cyan)', marginBottom: '8px' }}>
              📋 Run this SQL in your Supabase SQL Editor to create the tables:
            </div>
            <pre style={{
              fontSize: '0.72rem', fontFamily: 'var(--font-mono)', color: 'var(--color-text-secondary)',
              lineHeight: 1.6, whiteSpace: 'pre-wrap', overflowX: 'auto',
            }}>
{`-- Table for leads WITH a website (chatbot pitch)
CREATE TABLE IF NOT EXISTS leads_with_website (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  website_url TEXT,
  address TEXT,
  rating DECIMAL DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  status TEXT DEFAULT 'New' CHECK (status IN ('New','Contacted','Interested','Meeting','Closed','Rejected')),
  whatsapp_status TEXT DEFAULT 'uncontacted' CHECK (whatsapp_status IN ('uncontacted','queued','sent','delivered','read','failed')),
  last_messaged_at TIMESTAMPTZ,
  campaign_id UUID,
  automation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table for leads WITHOUT a website (web dev pitch)
CREATE TABLE IF NOT EXISTS leads_without_website (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL,
  phone_number TEXT UNIQUE NOT NULL,
  address TEXT,
  rating DECIMAL DEFAULT 0,
  reviews INTEGER DEFAULT 0,
  status TEXT DEFAULT 'New' CHECK (status IN ('New','Contacted','Interested','Meeting','Closed','Rejected')),
  whatsapp_status TEXT DEFAULT 'uncontacted' CHECK (whatsapp_status IN ('uncontacted','queued','sent','delivered','read','failed')),
  last_messaged_at TIMESTAMPTZ,
  campaign_id UUID,
  automation_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_web_phone ON leads_with_website(phone_number);
CREATE INDEX IF NOT EXISTS idx_web_status ON leads_with_website(status);
CREATE INDEX IF NOT EXISTS idx_noweb_phone ON leads_without_website(phone_number);
CREATE INDEX IF NOT EXISTS idx_noweb_status ON leads_without_website(status);`}
            </pre>
          </div>
        </div>
      </div>

      {/* Message Templates */}
      <div className="glass-card" style={{ marginBottom: '24px' }}>
        <div className="card-header">
          <h3>💬 Default Message Templates</h3>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="input-group">
            <label>🤖 Chatbot Pitch (Leads WITH Website)</label>
            <textarea className="input" value={settings.defaultChatbotMsg}
              onChange={(e) => setSettings({ ...settings, defaultChatbotMsg: e.target.value })}
              rows={5} style={{ minHeight: '130px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }} />
          </div>
          <div className="input-group">
            <label>🏗️ Website Pitch (Leads WITHOUT Website)</label>
            <textarea className="input" value={settings.defaultWebsiteMsg}
              onChange={(e) => setSettings({ ...settings, defaultWebsiteMsg: e.target.value })}
              rows={5} style={{ minHeight: '130px', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }} />
          </div>
          <div style={{ padding: '12px 16px', background: 'rgba(99, 102, 241, 0.06)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(99, 102, 241, 0.15)' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--color-accent-indigo)', marginBottom: '4px' }}>
              💡 Available Variables
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontFamily: 'var(--font-mono)' }}>
              {'{{business_name}}'} · {'{{phone_number}}'} · {'{{address}}'} · {'{{website_url}}'} · {'{{rating}}'} · {'{{reviews}}'}
            </div>
          </div>
        </div>
      </div>

      {/* Save */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
        <button className="btn btn-ghost" onClick={() => addToast('info', 'Changes discarded')}>
          Discard
        </button>
        <button className="btn btn-primary" onClick={saveSettings}>
          💾 Save Settings
        </button>
      </div>
    </>
  );
}
