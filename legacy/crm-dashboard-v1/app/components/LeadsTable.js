'use client';

import { useState, useMemo } from 'react';
import { demoLeadsWithWebsite, demoLeadsWithoutWebsite } from '../../lib/demoData';

export default function LeadsTable({ type, addToast }) {
  const isWebsite = type === 'website';
  const initialData = isWebsite ? demoLeadsWithWebsite : demoLeadsWithoutWebsite;

  const [leads, setLeads] = useState(initialData);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedLeads, setSelectedLeads] = useState(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const perPage = 10;

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const matchSearch =
        lead.business_name.toLowerCase().includes(search.toLowerCase()) ||
        lead.phone_number.includes(search) ||
        lead.address.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === 'All' || lead.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [leads, search, statusFilter]);

  const totalPages = Math.ceil(filteredLeads.length / perPage);
  const paginatedLeads = filteredLeads.slice((currentPage - 1) * perPage, currentPage * perPage);

  const toggleSelect = (id) => {
    setSelectedLeads((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === paginatedLeads.length) {
      setSelectedLeads(new Set());
    } else {
      setSelectedLeads(new Set(paginatedLeads.map((l) => l.id)));
    }
  };

  const updateStatus = (id, newStatus) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status: newStatus } : l))
    );
    addToast('success', `Lead marked as "${newStatus}"`);
  };

  const bulkAction = (action) => {
    if (selectedLeads.size === 0) {
      addToast('warning', 'Select leads first');
      return;
    }
    if (action === 'queue') {
      setLeads((prev) =>
        prev.map((l) =>
          selectedLeads.has(l.id) ? { ...l, whatsapp_status: 'queued' } : l
        )
      );
      addToast('success', `${selectedLeads.size} leads added to WhatsApp queue`);
      setSelectedLeads(new Set());
    }
  };

  const statuses = ['All', 'New', 'Contacted', 'Interested', 'Meeting', 'Closed', 'Rejected'];

  return (
    <>
      <div className="page-header">
        <h2>{isWebsite ? '🌐 Leads With Website' : '🚫 Leads Without Website'}</h2>
        <p>
          {isWebsite
            ? 'Businesses with existing websites — pitch AI Chatbot integration'
            : 'Businesses without websites — pitch professional web development'}
        </p>
      </div>

      {/* Pitch Banner */}
      <div
        className="glass-card"
        style={{
          marginBottom: '24px',
          border: isWebsite
            ? '1px solid rgba(34, 211, 238, 0.2)'
            : '1px solid rgba(251, 191, 36, 0.2)',
        }}
      >
        <div className="card-body" style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '1.5rem' }}>{isWebsite ? '🤖' : '🏗️'}</span>
            <div>
              <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '2px' }}>
                {isWebsite ? 'Chatbot Pitch Strategy' : 'Website Development Pitch'}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
                {isWebsite
                  ? '"We can build a custom AI chatbot for your existing website to capture leads 24/7 and increase conversions by 40%."'
                  : '"We noticed your business doesn\'t have a website. We build premium, affordable websites that help customers find you."'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <div className="search-bar" style={{ flex: 1, minWidth: '240px' }}>
          <span className="search-icon">🔍</span>
          <input
            type="text"
            className="input"
            placeholder="Search by name, phone, or address..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            style={{ paddingLeft: '40px' }}
          />
        </div>
        <select
          className="select"
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
          style={{ width: '160px' }}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => bulkAction('queue')}>
          📱 Queue Selected ({selectedLeads.size})
        </button>
      </div>

      {/* Table */}
      <div className="glass-card">
        <div className="data-table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '40px' }}>
                  <label className="checkbox-wrapper">
                    <input
                      type="checkbox"
                      checked={selectedLeads.size === paginatedLeads.length && paginatedLeads.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </label>
                </th>
                <th>Business Name</th>
                <th>Phone</th>
                {isWebsite && <th>Website</th>}
                <th>Address</th>
                <th>Rating</th>
                <th>Status</th>
                <th>WhatsApp</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedLeads.length === 0 ? (
                <tr>
                  <td colSpan={isWebsite ? 9 : 8} style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
                    No leads found matching your filters.
                  </td>
                </tr>
              ) : (
                paginatedLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td>
                      <label className="checkbox-wrapper">
                        <input
                          type="checkbox"
                          checked={selectedLeads.has(lead.id)}
                          onChange={() => toggleSelect(lead.id)}
                        />
                      </label>
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>
                      {lead.business_name}
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>
                      +{lead.phone_number}
                    </td>
                    {isWebsite && (
                      <td>
                        <a
                          href={lead.website_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--color-accent-cyan)', textDecoration: 'none', fontSize: '0.8rem' }}
                        >
                          {lead.website_url?.replace('https://', '')}
                        </a>
                      </td>
                    )}
                    <td>{lead.address}</td>
                    <td>
                      <span style={{ color: 'var(--color-accent-amber)' }}>★</span> {lead.rating}
                      <span style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}> ({lead.reviews})</span>
                    </td>
                    <td>
                      <span className={`badge ${lead.status.toLowerCase()}`}>
                        {lead.status}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${lead.whatsapp_status}`}>
                        {lead.whatsapp_status}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn-icon"
                          title="Mark Contacted"
                          onClick={() => updateStatus(lead.id, 'Contacted')}
                        >
                          📞
                        </button>
                        <button
                          className="btn-icon"
                          title="Send WhatsApp"
                          onClick={() => addToast('info', `WhatsApp message queued for ${lead.business_name}`)}
                        >
                          📱
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination" style={{ padding: '12px 16px' }}>
            <span>
              Showing {(currentPage - 1) * perPage + 1}–{Math.min(currentPage * perPage, filteredLeads.length)} of {filteredLeads.length}
            </span>
            <div className="pagination-controls">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
                ‹
              </button>
              {Array.from({ length: totalPages }, (_, i) => (
                <button
                  key={i + 1}
                  className={currentPage === i + 1 ? 'active' : ''}
                  onClick={() => setCurrentPage(i + 1)}
                >
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
                ›
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
