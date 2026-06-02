import { useMemo } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import DataTable from '../../components/common/DataTable';
import { Download, ReceiptText, ShieldCheck, CreditCard, AlertCircle } from 'lucide-react';
import useStudentPortalData from '../../hooks/useStudentPortalData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const columns = [
  { key: 'billId', title: 'Bill ID' },
  { key: 'period', title: 'Period' },
  { key: 'mealCost', title: 'Meal Cost', render: (value) => formatCurrency(value) },
  { key: 'utility', title: 'Utility', render: (value) => formatCurrency(value) },
  { key: 'service', title: 'Service', render: (value) => formatCurrency(value) },
  { key: 'total', title: 'Total', render: (value) => formatCurrency(value) },
  { key: 'status', title: 'Status', type: 'status' },
  { key: 'dueDate', title: 'Due', render: (value) => formatDate(value) },
];

export default function Billing() {
  useDocumentTitle('Billing');
  const { isLoading, errorMessage, bills } = useStudentPortalData();

  const summary = useMemo(() => {
    const totalBill = bills.reduce((sum, bill) => sum + Number(bill.total || 0), 0);
    const paidBill = bills.filter((bill) => bill.status === 'paid').reduce((sum, bill) => sum + Number(bill.total || 0), 0);
    const dueBill = Math.max(0, totalBill - paidBill);
    const overdueBill = bills.filter((bill) => bill.status !== 'paid').length;

    return { totalBill, paidBill, dueBill, overdueBill };
  }, [bills]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {errorMessage ? <div className="student-message student-message-error">{errorMessage}</div> : null}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Billing</h1>
          <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Transparent view of your live billing records</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer' }}>
            <Download size={18} /> Download
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
        {/* Total Bill Card */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Total Bill</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>{formatCurrency(summary.totalBill)}</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>Live database total</div>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '10px', borderRadius: '8px', color: '#6366f1' }}>
            <ReceiptText size={24} strokeWidth={1.5} />
          </div>
        </div>

        {/* Paid Card */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Paid</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>{formatCurrency(summary.paidBill)}</div>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '10px', borderRadius: '8px', color: '#6366f1' }}>
            <ShieldCheck size={24} strokeWidth={1.5} />
          </div>
        </div>

        {/* Due Card */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Due</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>{formatCurrency(summary.dueBill)}</div>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '10px', borderRadius: '8px', color: '#6366f1' }}>
            <CreditCard size={24} strokeWidth={1.5} />
          </div>
        </div>

        {/* Adjustments Card */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Adjustments</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>{summary.overdueBill}</div>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '10px', borderRadius: '8px', color: '#6366f1' }}>
            <AlertCircle size={24} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ backgroundColor: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '16px 20px', color: '#1d4ed8', fontSize: '0.95rem', lineHeight: '1.5' }}>
        Bills are loaded from the backend and reflect the actual records stored for your account.
      </div>

      {/* Billing Records Table */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '500', color: '#1e293b', marginBottom: '20px' }}>
          {isLoading ? 'Loading billing records...' : 'Billing Records'}
        </h2>
        <DataTable columns={columns} rows={bills} />
      </div>
    </div>
  );
}