import React, { useState } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import DataTable from '../../components/common/DataTable';
import Modal from '../../components/ui/Modal';
import { Eye, Check, X, MessageSquare, Send } from 'lucide-react';

const initialPayments = [
  { id: 1, student: { name: 'Kamal Hossain', dept: 'CSE', id: '202314051', hallId: 'OH-402' }, amount: 'BDT 3,200', method: 'bKash', txnId: 'TXN-11234', date: '2026-04-12', status: 'Submitted', proofUrl: '' },
  { id: 2, student: { name: 'Tanvir Islam', dept: 'EEE', id: '202214152', hallId: 'OH-210' }, amount: 'BDT 2,500', method: 'Nagad', txnId: 'TXN-11235', date: '2026-04-12', status: 'Under Review', proofUrl: '' },
  { id: 3, student: { name: 'Arif Hasan', dept: 'ME', id: '202414011', hallId: 'OH-105' }, amount: 'BDT 2,100', method: 'Bank Transfer', txnId: 'TXN-11236', date: '2026-04-11', status: 'Submitted', proofUrl: 'https://via.placeholder.com/400x600/dcfce7/16a34a?text=Real+Screenshot' },
  { id: 4, student: { name: 'Mita Das', dept: 'CE', id: '202314099', hallId: 'OH-309' }, amount: 'BDT 1,500', method: 'bKash', txnId: 'TXN-11237', date: '2026-04-11', status: 'Under Review', proofUrl: '' },
];

export default function PaymentVerification() {
  useDocumentTitle('Payment Verification');

  const [payments, setPayments] = useState(initialPayments);
  const [selectedProof, setSelectedProof] = useState(null);
  const [messagingStudent, setMessagingStudent] = useState(null);
  const [messageText, setMessageText] = useState('');

  const handleApprove = (id) => {
    setPayments(payments.map(p => p.id === id ? { ...p, status: 'Approved' } : p));
    setSelectedProof(null);
  };

  const handleReject = (id) => {
    setPayments(payments.map(p => p.id === id ? { ...p, status: 'Rejected' } : p));
    setSelectedProof(null);
  };

  const handleSendMessage = () => {
    if (messageText.trim()) {
      alert(`Message sent to ${messagingStudent.student.name}: ${messageText}`);
      setMessageText('');
      setMessagingStudent(null);
    }
  };

  const pendingCount = payments.filter(p => p.status === 'Submitted' || p.status === 'Under Review').length;

  const columns = [
    { key: 'name', title: 'Student Name', render: (val, row) => <span style={{ fontWeight: '500', color: '#1e293b' }}>{row.student.name}</span> },
    { key: 'dept', title: 'Dept.', render: (val, row) => <span style={{ color: '#64748b' }}>{row.student.dept}</span> },
    { key: 'sid', title: 'Student ID', render: (val, row) => <span style={{ color: '#64748b' }}>{row.student.id}</span> },
    { key: 'hid', title: 'Hall ID', render: (val, row) => <span style={{ color: '#64748b' }}>{row.student.hallId}</span> },
    { key: 'amount', title: 'Amount' },
    { key: 'method', title: 'Method' },
    { key: 'txnId', title: 'Txn ID' },
    { key: 'date', title: 'Date' },
    {
      key: 'status', title: 'Status', render: (val) => {
        let bg = val === 'Submitted' ? '#e0eeff' : val === 'Under Review' ? '#fef3c7' : val === 'Approved' ? '#dcfce7' : '#fee2e2';
        let color = val === 'Submitted' ? '#3b82f6' : val === 'Under Review' ? '#d97706' : val === 'Approved' ? '#16a34a' : '#dc2626';
        return (
          <span style={{ backgroundColor: bg, color, padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 500, whiteSpace: 'nowrap' }}>
            {val}
          </span>
        );
      }
    },
    {
      key: 'proof', title: 'Proof', render: (val, row) => (
        <div onClick={() => setSelectedProof(row)} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6366f1', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 500 }}>
          <Eye size={16} /> View
        </div>
      )
    },
    {
      key: 'actions', title: 'Actions', render: (val, row) => (
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          <button onClick={() => handleApprove(row.id)} title="Approve" disabled={row.status === 'Approved'} style={{ backgroundColor: row.status === 'Approved' ? '#f1f5f9' : '#dcfce7', color: row.status === 'Approved' ? '#94a3b8' : '#16a34a', border: 'none', borderRadius: '4px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: row.status === 'Approved' ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}>
            <Check size={16} strokeWidth={2.5} />
          </button>
          <button onClick={() => handleReject(row.id)} title="Reject" disabled={row.status === 'Rejected' || row.status === 'Approved'} style={{ backgroundColor: (row.status === 'Rejected' || row.status === 'Approved') ? '#f1f5f9' : '#fee2e2', color: (row.status === 'Rejected' || row.status === 'Approved') ? '#94a3b8' : '#dc2626', border: 'none', borderRadius: '4px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: (row.status === 'Rejected' || row.status === 'Approved') ? 'not-allowed' : 'pointer', transition: 'background-color 0.2s' }}>
            <X size={16} strokeWidth={2.5} />
          </button>
          <button onClick={() => setMessagingStudent(row)} title="Message Student" style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: 'none', borderRadius: '4px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <MessageSquare size={14} strokeWidth={2} />
          </button>
        </div>
      )
    },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Payment Verification</h1>
        <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>{pendingCount} payments pending review</p>
      </div>

      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0', overflowX: 'auto' }}>
        <DataTable columns={columns} rows={payments} />
      </div>

      {/* Proof Viewer Modal */}
      <Modal isOpen={!!selectedProof} onClose={() => setSelectedProof(null)} title={`Payment Proof: ${selectedProof?.student?.name}`}>
        {selectedProof && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px', backgroundColor: '#f8fafc', borderRadius: '8px', width: '100%', display: 'flex', justifyContent: 'space-between', border: '1px solid #e2e8f0' }}>
              <div><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Txn ID</span><br/><strong>{selectedProof.txnId}</strong></div>
              <div><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Amount</span><br/><strong>{selectedProof.amount}</strong></div>
              <div><span style={{ color: '#64748b', fontSize: '0.85rem' }}>Method</span><br/><strong>{selectedProof.method}</strong></div>
            </div>

            <div style={{ width: '100%', height: '300px', backgroundColor: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
              {selectedProof.proofUrl ? (
                <img src={selectedProof.proofUrl} alt="Transaction Proof" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
              ) : (
                <span style={{ color: '#64748b', fontSize: '1rem' }}>Screenshot preview placeholder</span>
              )}
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button onClick={() => handleApprove(selectedProof.id)} style={{ flex: 1, padding: '12px', backgroundColor: '#05c46b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '1rem' }}>
                Approve
              </button>
              <button onClick={() => handleReject(selectedProof.id)} style={{ flex: 1, padding: '12px', backgroundColor: '#ff3b3b', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', fontSize: '1rem' }}>
                Reject
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Message Student Modal */}
      <Modal isOpen={!!messagingStudent} onClose={() => setMessagingStudent(null)} title={`Message ${messagingStudent?.student?.name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <p style={{ color: '#475569', fontSize: '0.95rem' }}>Send a message to student regarding Txn: <strong>{messagingStudent?.txnId}</strong></p>
          <textarea
            rows={4}
            value={messageText}
            onChange={(e) => setMessageText(e.target.value)}
            placeholder="Type your message here..."
            style={{ width: '100%', padding: '12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', resize: 'none', fontFamily: 'inherit', color: '#334155' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
            <button onClick={() => setMessagingStudent(null)} style={{ padding: '8px 16px', backgroundColor: 'transparent', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontWeight: 500 }}>Cancel</button>
            <button onClick={handleSendMessage} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: '#4f46e5', border: 'none', borderRadius: '6px', color: 'white', cursor: 'pointer', fontWeight: 500 }}>
              <Send size={16} /> Send 
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}