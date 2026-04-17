import useDocumentTitle from '../../hooks/useDocumentTitle';
import DataTable from '../../components/common/DataTable';
import { Download, ReceiptText, ShieldCheck, CreditCard, AlertCircle } from 'lucide-react';

const mockBreakdownData = [
  { id: 1, date: 'Apr 01', meal: 'Breakfast', item: 'Standard', qty: '1', rate: 'BDT 50', cost: 'BDT 50', adj: '-', final: 'BDT 50' },
  { id: 2, date: 'Apr 01', meal: 'Lunch', item: 'Rice + Chicken', qty: '1', rate: 'BDT 80', cost: 'BDT 80', adj: '-', final: 'BDT 80' },
  { id: 3, date: 'Apr 01', meal: 'Dinner', item: 'Rice + Fish', qty: '1', rate: 'BDT 70', cost: 'BDT 70', adj: '-', final: 'BDT 70' },
  { id: 4, date: 'Apr 02', meal: 'Breakfast', item: 'Standard', qty: '1', rate: 'BDT 50', cost: 'BDT 50', adj: '-', final: 'BDT 50' },
  { id: 5, date: 'Apr 02', meal: 'Lunch', item: 'Rice + Meat', qty: '1', rate: 'BDT 85', cost: 'BDT 85', adj: '-', final: 'BDT 85' },
];

const columns = [
  { key: 'date', title: 'Date' },
  { key: 'meal', title: 'Meal' },
  { key: 'item', title: 'Item' },
  { key: 'qty', title: 'Qty' },
  { key: 'rate', title: 'Rate' },
  { key: 'cost', title: 'Cost' },
  { key: 'adj', title: 'Adj.' },
  { key: 'final', title: 'Final' },
];

export default function Billing() {
  useDocumentTitle('Billing');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Billing</h1>
          <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Transparent view of your meal costs</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white', color: '#334155' }}>
            <option>April 2026</option>
          </select>
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
            <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>BDT 4,850</div>
            <div style={{ color: '#94a3b8', fontSize: '0.85rem' }}>April 2026</div>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '10px', borderRadius: '8px', color: '#6366f1' }}>
            <ReceiptText size={24} strokeWidth={1.5} />
          </div>
        </div>

        {/* Paid Card */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Paid</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>BDT 3,000</div>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '10px', borderRadius: '8px', color: '#6366f1' }}>
            <ShieldCheck size={24} strokeWidth={1.5} />
          </div>
        </div>

        {/* Due Card */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Due</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>BDT 1,850</div>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '10px', borderRadius: '8px', color: '#6366f1' }}>
            <CreditCard size={24} strokeWidth={1.5} />
          </div>
        </div>

        {/* Adjustments Card */}
        <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: '#64748b', fontSize: '0.95rem', marginBottom: '8px' }}>Adjustments</div>
            <div style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '8px' }}>BDT -200</div>
          </div>
          <div style={{ backgroundColor: '#f5f3ff', padding: '10px', borderRadius: '8px', color: '#6366f1' }}>
            <AlertCircle size={24} strokeWidth={1.5} />
          </div>
        </div>
      </div>

      {/* Info Banner */}
      <div style={{ backgroundColor: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '16px 20px', color: '#1d4ed8', fontSize: '0.95rem', lineHeight: '1.5' }}>
        Your bill is calculated from: meal participation + common item share + optional item cost. Common items (rice, oil, etc.) are split among all active students. Optional items (chicken, fish) only apply if you selected them.
      </div>

      {/* Daily Breakdown Table */}
      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '20px' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '500', color: '#1e293b', marginBottom: '20px' }}>Daily Breakdown</h2>
        <DataTable columns={columns} rows={mockBreakdownData} />
      </div>
    </div>
  );
}