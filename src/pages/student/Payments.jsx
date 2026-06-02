import { useMemo } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import DataTable from '../../components/common/DataTable';
import useStudentPortalData from '../../hooks/useStudentPortalData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const columns = [
  { key: 'paymentId', title: 'Payment ID' },
  { key: 'submittedAt', title: 'Date', render: (value) => formatDate(value) },
  { key: 'amount', title: 'Amount', render: (value) => formatCurrency(value) },
  { key: 'method', title: 'Method' },
  { key: 'billId', title: 'Bill ID' },
  { key: 'reference', title: 'Reference' },
  { key: 'status', title: 'Status', type: 'status' },
];


export default function Payments() {
  useDocumentTitle('Payments');
  const { isLoading, errorMessage, payments } = useStudentPortalData();

  const summary = useMemo(() => {
    const verified = payments.filter((payment) => payment.status === 'verified').length;
    const pending = payments.filter((payment) => payment.status !== 'verified').length;
    const total = payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
    return { verified, pending, total };
  }, [payments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {errorMessage ? <div className="student-message student-message-error">{errorMessage}</div> : null}

      {/* Header */}
      <div>
        <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Payments</h1>
        <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>{isLoading ? 'Loading live payment history...' : 'View your payment records from the database'}</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
          <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Verified Payments</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b' }}>{summary.verified}</div>
        </div>
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
          <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Pending Reviews</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b' }}>{summary.pending}</div>
        </div>
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
          <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Total Recorded</div>
          <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b' }}>{formatCurrency(summary.total)}</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr)', gap: '24px', alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '24px' }}>
            <h2 style={{ fontSize: '1.1rem', fontWeight: '500', color: '#1e293b', margin: '0 0 12px 0' }}>Live Payment History</h2>
            <p style={{ color: '#64748b', marginTop: 0 }}>This list is read directly from the backend.</p>
            <DataTable columns={columns} rows={payments} />
          </div>
        </div>
      </div>
    </div>
  );
}