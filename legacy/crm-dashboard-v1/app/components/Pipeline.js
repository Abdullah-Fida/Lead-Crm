'use client';

import { useState, useRef, useCallback } from 'react';
import { demoLeadsWithWebsite, demoLeadsWithoutWebsite } from '../../lib/demoData';

const COLUMNS = [
  { id: 'New', label: 'New Leads', color: 'var(--color-status-new)', icon: '✨' },
  { id: 'Contacted', label: 'Contacted', color: 'var(--color-status-contacted)', icon: '📞' },
  { id: 'Interested', label: 'Interested', color: 'var(--color-status-interested)', icon: '💡' },
  { id: 'Meeting', label: 'Meeting Booked', color: 'var(--color-status-meeting)', icon: '📅' },
  { id: 'Closed', label: 'Closed Won', color: 'var(--color-status-closed)', icon: '🎉' },
  { id: 'Rejected', label: 'Rejected', color: 'var(--color-status-rejected)', icon: '✕' },
];

export default function Pipeline({ addToast }) {
  const allLeads = [...demoLeadsWithWebsite, ...demoLeadsWithoutWebsite];
  const [leads, setLeads] = useState(allLeads);
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  const getLeadsByStatus = (status) => leads.filter((l) => l.status === status);

  const handleDragStart = (e, leadId) => {
    setDragging(leadId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(columnId);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = (e, newStatus) => {
    e.preventDefault();
    setDragOver(null);

    if (dragging) {
      const lead = leads.find((l) => l.id === dragging);
      if (lead && lead.status !== newStatus) {
        setLeads((prev) =>
          prev.map((l) => (l.id === dragging ? { ...l, status: newStatus } : l))
        );
        addToast('success', `"${lead.business_name}" moved to ${newStatus}`);
      }
    }
    setDragging(null);
  };

  const handleDragEnd = () => {
    setDragging(null);
    setDragOver(null);
  };

  return (
    <>
      <div className="page-header">
        <h2>📋 Pipeline</h2>
        <p>Drag and drop leads between stages to track your sales progress</p>
      </div>

      <div className="kanban-board">
        {COLUMNS.map((column) => {
          const columnLeads = getLeadsByStatus(column.id);
          return (
            <div key={column.id} className="kanban-column">
              <div className="kanban-column-header">
                <h4>
                  <span style={{ color: column.color }}>{column.icon}</span>
                  {column.label}
                </h4>
                <span className="count">{columnLeads.length}</span>
              </div>
              <div
                className={`kanban-column-body ${dragOver === column.id ? 'drag-over' : ''}`}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, column.id)}
              >
                {columnLeads.length === 0 ? (
                  <div style={{
                    textAlign: 'center',
                    padding: '24px 12px',
                    color: 'var(--color-text-muted)',
                    fontSize: '0.8rem',
                    border: '1px dashed var(--color-border-glass)',
                    borderRadius: 'var(--radius-md)',
                  }}>
                    Drop leads here
                  </div>
                ) : (
                  columnLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className={`kanban-card ${dragging === lead.id ? 'dragging' : ''}`}
                      draggable
                      onDragStart={(e) => handleDragStart(e, lead.id)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="card-title">{lead.business_name}</div>
                      <div className="card-meta">
                        📍 {lead.address}
                      </div>
                      <div className="card-meta" style={{ marginTop: '4px' }}>
                        📞 +{lead.phone_number}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                        <span style={{ color: lead.website_url ? 'var(--color-accent-cyan)' : 'var(--color-accent-amber)', fontSize: '0.72rem', fontWeight: 500 }}>
                          {lead.website_url ? '🌐 Has Website' : '🚫 No Website'}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--color-accent-amber)' }}>
                          ★ {lead.rating}
                        </span>
                      </div>
                      <div className="card-actions">
                        <button
                          className="btn btn-ghost btn-sm"
                          style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                          onClick={() => addToast('info', `WhatsApp queued for ${lead.business_name}`)}
                        >
                          📱 Message
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
