import useDocumentTitle from '../../hooks/useDocumentTitle';
import DataTable from '../../components/common/DataTable';
import { Upload, Send } from 'lucide-react';

const mockHistoryData = [
  { id: 1, date: '2026-04-10', amount: 'BDT 3,000', method: 'bKash', txnId: 'TXN-89234', status: 'Approved', remark: 'Verified' },
  { id: 2, date: '2026-03-15', amount: 'BDT 4,500', method: 'Nagad', txnId: 'TXN-78123', status: 'Approved', remark: 'Verified' },
  { id: 3, date: '2026-02-20', amount: 'BDT 2,000', method: 'Bank Transfer', txnId: 'TXN-67012', status: 'Rejected', remark: 'Invalid transaction ID' },
  { id: 4, date: '2026-02-22', amount: 'BDT 2,000', method: 'bKash', txnId: 'TXN-67099', status: 'Approved', remark: 'Verified' },
];

const columns = [
  { key: 'date', title: 'Date' },
  { key: 'amount', title: 'Amount' },
  { key: 'method', title: 'Method' },
  { key: 'txnId', title: 'Txn ID' },
  {
    key: 'status', title: 'Status', render: (val) => {
      let bg = val === 'Approved' ? '#e6f7ec' : '#fdeaea';
      let color = val === 'Approved' ? '#1a8b4b' : '#d63939';
      return (
        <span style={{ backgroundColor: bg, color, padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 500 }}>
          {val}
        </span>
      );
    }
  },
  { key: 'remark', title: 'Remark' },
];

const TrackerStep = ({ number, label, isLast }) => (
  <div style={{ display: 'flex', alignItems: 'center', flex: isLast ? '0' : '1' }}>
    <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#4f46e5', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.9rem', fontWeight: '500', flexShrink: 0 }}>
      {number}
    </div>
    <span style={{ marginLeft: '12px', color: '#334155', fontWeight: '500', fontSize: '0.95rem', whiteSpace: 'nowrap' }}>
      {label}
    </span>
    {!isLast && (
      <div style={{ flex: 1, height: '1px', backgroundColor: '#c7d2fe', margin: '0 16px', minWidth: '40px' }} />
    )}
  </div>
);

export default function Payments() {
  useDocumentTitle('Payments');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Payments</h1>
        <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Submit and track your payments</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 360px) 1fr', gap: '24px', alignItems: 'start' }}>
        
        {/* Left Column: Form */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: 0 }}>Submit Payment</h2>
          
          <form style={{ display: 'flex', flexDirection: 'column', gap: '16px' }} onSubmit={(e) => e.preventDefault()}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Amount (BDT)</span>
              <input type="number" placeholder="Enter amount" style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: '0.95rem' }} />
            </label>
            
            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Payment Method</span>
              <select style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: '0.95rem', backgroundColor: 'white', color: '#334155' }}>
                <option>bKash</option>
                <option>Nagad</option>
                <option>Bank Transfer</option>
              </select>
            </label>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Transaction ID</span>
              <input type="text" placeholder="e.g. TXN-12345" style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: '0.95rem' }} />
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Screenshot Proof</span>
              <div style={{ border: '2px dashed #cbd5e1', borderRadius: '8px', padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', cursor: 'pointer', backgroundColor: '#f8fafc' }}>
                <Upload size={24} color="#64748b" />
                <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Click to upload or drag & drop</span>
              </div>
            </div>

            <label style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Notes</span>
              <textarea placeholder="Optional notes" rows="3" style={{ padding: '10px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none', fontSize: '0.95rem', resize: 'vertical' }}></textarea>
            </label>

            <button type="submit" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '12px 16px', borderRadius: '6px', fontSize: '0.95rem', fontWeight: '500', cursor: 'pointer', marginTop: '4px' }}>
              <Send size={16} /> Submit Payment
            </button>
          </form>
        </div>

        {/* Right Column: Tracker & History */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Tracker Card */}
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 24px 0' }}>Payment Status Tracker</h2>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px' }}>
              <TrackerStep number="1" label="Submitted" />
              <TrackerStep number="2" label="Under Review" />
              <TrackerStep number="3" label="Approved" isLast />
            </div>
          </div>

          {/* History Card */}
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 20px 0' }}>Payment History</h2>
            <DataTable columns={columns} rows={mockHistoryData} />
          </div>

        </div>

      </div>
    </div>
  );
}