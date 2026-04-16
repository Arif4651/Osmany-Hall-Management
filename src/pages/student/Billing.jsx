import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import StatCard from '../../components/common/StatCard';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { studentBills } from '../../data/mock/studentData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const columns = [
  { key: 'id', title: 'Bill ID' },
  { key: 'period', title: 'Period' },
  { key: 'mealCost', title: 'Meal Cost', render: (value) => formatCurrency(value) },
  { key: 'utility', title: 'Utility', render: (value) => formatCurrency(value) },
  { key: 'service', title: 'Service', render: (value) => formatCurrency(value) },
  { key: 'total', title: 'Total', render: (value) => formatCurrency(value) },
  { key: 'dueDate', title: 'Due Date', render: (value) => formatDate(value) },
  { key: 'status', title: 'Status', type: 'status' },
];

const paidTotal = studentBills.filter((bill) => bill.status === 'paid').reduce((sum, bill) => sum + bill.total, 0);
const pendingTotal = studentBills
  .filter((bill) => bill.status !== 'paid')
  .reduce((sum, bill) => sum + bill.total, 0);

export default function Billing() {
  useDocumentTitle('Billing');

  return (
    <div>
      <PageHeader title="Billing" description="Track monthly invoices, due dates, and payment state." />

      <section className="stat-grid">
        <StatCard title="Paid Amount" value={paidTotal} isCurrency trend="Up to date" tone="success" />
        <StatCard title="Pending Amount" value={pendingTotal} isCurrency trend="Requires action" tone="warning" />
        <StatCard title="Total Invoices" value={studentBills.length} trend="3 records" tone="info" />
      </section>

      <PageSection title="Invoice Timeline" subtitle="All generated bills">
        <DataTable columns={columns} rows={studentBills} />
      </PageSection>
    </div>
  );
}