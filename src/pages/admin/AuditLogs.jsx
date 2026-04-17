import React, { useState } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { Search } from 'lucide-react';

const mockLogs = [
  { id: 1, user: 'Admin', role: 'Admin', module: 'Payment', action: 'Approved', before: 'Submitted', after: 'Approved', timestamp: '2026-04-13 10:30' },
  { id: 2, user: 'Rahul Ahmed', role: 'Student', module: 'Meal', action: 'Toggle OFF', before: 'Dinner ON', after: 'Dinner OFF', timestamp: '2026-04-13 09:15' },
  { id: 3, user: 'Admin', role: 'Admin', module: 'Inventory', action: 'Stock Added', before: 'Chicken: 150kg', after: 'Chicken: 200kg', timestamp: '2026-04-12 16:00' },
  { id: 4, user: 'Admin', role: 'Admin', module: 'Billing', action: 'Adjustment', before: 'BDT 5050', after: 'BDT 4850', timestamp: '2026-04-12 14:30' },
  { id: 5, user: 'Fatima Khan', role: 'Student', module: 'Payment', action: 'Submitted', before: '-', after: 'BDT 4200', timestamp: '2026-04-12 11:00' },
  { id: 6, user: 'Admin', role: 'Admin', module: 'Student', action: 'Suspended', before: 'Active', after: 'Suspended', timestamp: '2026-04-11 09:00' },
];

export default function AuditLogs() {
  useDocumentTitle('Audit Logs');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState('All');

  const filteredLogs = mockLogs.filter(log => {
    const matchesSearch = Object.values(log).some(val => 
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    );
    const matchesFilter = filter === 'All' || log.role === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Audit Logs</h1>
        <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Transparency and accountability trail</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
        <div style={{ 
          flex: 1, 
          display: 'flex', 
          alignItems: 'center', 
          backgroundColor: 'white', 
          border: '1px solid #e2e8f0', 
          borderRadius: '8px', 
          padding: '8px 16px' 
        }}>
          <Search size={18} color="#94a3b8" style={{ marginRight: '8px' }} />
          <input 
            type="text" 
            placeholder="Search logs..." 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ 
              border: 'none', 
              outline: 'none', 
              width: '100%', 
              fontSize: '0.95rem',
              color: '#1e293b'
            }} 
          />
        </div>
        <select 
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{
            padding: '10px 16px',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            backgroundColor: 'white',
            color: '#1e293b',
            fontSize: '0.95rem',
            outline: 'none',
            minWidth: '120px'
          }}
        >
          <option value="All">All</option>
          <option value="Admin">Admin</option>
          <option value="Student">Student</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
                <th style={{ padding: '16px', fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>User</th>
                <th style={{ padding: '16px', fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Role</th>
                <th style={{ padding: '16px', fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Module</th>
                <th style={{ padding: '16px', fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Action</th>
                <th style={{ padding: '16px', fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Before</th>
                <th style={{ padding: '16px', fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>After</th>
                <th style={{ padding: '16px', fontSize: '0.9rem', fontWeight: '600', color: '#475569' }}>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.map((log) => (
                <tr key={log.id} style={{ borderBottom: '1px solid #e2e8f0', color: '#1e293b', fontSize: '0.95rem' }}>
                  <td style={{ padding: '16px' }}>{log.user}</td>
                  <td style={{ padding: '16px' }}>
                    <span style={{
                      backgroundColor: log.role === 'Admin' ? '#f3e8ff' : '#e0e7ff',
                      color: log.role === 'Admin' ? '#a855f7' : '#6366f1',
                      padding: '4px 12px',
                      borderRadius: '9999px',
                      fontSize: '0.85rem',
                      fontWeight: '500'
                    }}>
                      {log.role}
                    </span>
                  </td>
                  <td style={{ padding: '16px' }}>{log.module}</td>
                  <td style={{ padding: '16px' }}>{log.action}</td>
                  <td style={{ padding: '16px', color: '#64748b' }}>{log.before}</td>
                  <td style={{ padding: '16px', color: '#1e293b' }}>{log.after}</td>
                  <td style={{ padding: '16px', color: '#64748b' }}>{log.timestamp}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}