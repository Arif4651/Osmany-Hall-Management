import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Button from '../../components/ui/Button';
import { FileText, Pencil, Lock, Download, Upload } from 'lucide-react';

const residentRecords = [
  { id: '1', name: 'Rahul Ahmed', month: 'April 2026', totalBill: 'BDT 4,850', paid: 'BDT 3,000', due: 'BDT 1,850', adjustment: 'BDT -200', status: 'Partial' },
  { id: '2', name: 'Fatima Khan', month: 'April 2026', totalBill: 'BDT 4,200', paid: 'BDT 4,200', due: 'BDT 0', adjustment: '-', status: 'Paid' },
  { id: '3', name: 'Kamal Hossain', month: 'April 2026', totalBill: 'BDT 3,200', paid: 'BDT 0', due: 'BDT 3,200', adjustment: '-', status: 'Unpaid' },
  { id: '4', name: 'Tanvir Islam', month: 'April 2026', totalBill: 'BDT 5,400', paid: 'BDT 0', due: 'BDT 5,400', adjustment: '-', status: 'Unpaid' },
  { id: '5', name: 'Shirin Akter', month: 'April 2026', totalBill: 'BDT 4,900', paid: 'BDT 4,000', due: 'BDT 900', adjustment: '-', status: 'Partial' },
  { id: '6', name: 'Arif Hasan', month: 'April 2026', totalBill: 'BDT 4,100', paid: 'BDT 2,000', due: 'BDT 2,100', adjustment: '-', status: 'Partial' },
];

const columns = [
  { key: 'name', title: 'Student' },
  { key: 'month', title: 'Month' },
  { key: 'totalBill', title: 'Total Bill' },
  { key: 'paid', title: 'Paid' },
  { key: 'due', title: 'Due' },
  { key: 'adjustment', title: 'Adjustment' },
  { key: 'status', title: 'Status', render: (val) => {
      let bg, color;
      if (val === 'Paid') { bg = '#e6f7ec'; color = '#1a8b4b'; }
      else if (val === 'Partial') { bg = '#fff8e1'; color = '#d49600'; }
      else { bg = '#fdeaea'; color = '#d63939'; }
      return (
        <span style={{ backgroundColor: bg, color, padding: '4px 12px', borderRadius: '12px', fontSize: '0.85rem', fontWeight: 500 }}>
          {val}
        </span>
      );
  }},
  { key: 'action', title: 'Action', render: () => <Pencil size={16} strokeWidth={1.5} style={{cursor: 'pointer', color: '#5b6b84'}} /> },
];

export default function BillingManagement() {
  useDocumentTitle('Billing Management');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '500', color: '#1e293b', marginBottom: '4px' }}>Billing Management</h1>
          <p style={{ color: '#64748b', fontSize: '1rem', margin: 0 }}>Generate, adjust, and manage student bills</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <select style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none', backgroundColor: 'white', color: '#334155' }}>
            <option>April 2026</option>
          </select>
          <button style={{ display: 'flex', alignItems: 'center', gap: '8px', backgroundColor: '#4f46e5', color: 'white', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '0.95rem', fontWeight: 500, cursor: 'pointer' }}>
            <FileText size={18} /> Generate Bills
          </button>
        </div>
      </div>

      <div style={{ backgroundColor: '#f0f7ff', border: '1px solid #dbeafe', borderRadius: '8px', padding: '16px 20px', color: '#1d4ed8', fontSize: '0.95rem' }}>
        Billing Pipeline: Meal Selection → Participation → Consumption Calculation → Cost Distribution → Final Bill
      </div>

      <div style={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '12px' }}>
          {[
            { icon: Pencil, label: 'Bulk Edit' },
            { icon: Lock, label: 'Lock Month' },
            { icon: Download, label: 'Export CSV' },
            { icon: Download, label: 'Export PDF' },
            { icon: Upload, label: 'Import CSV' },
          ].map((btn, idx) => (
            <button key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '6px', color: '#475569', fontSize: '0.9rem', cursor: 'pointer' }}>
              <btn.icon size={16} /> {btn.label}
            </button>
          ))}
        </div>

        <DataTable columns={columns} rows={residentRecords} />
      </div>
    </div>
  );
}