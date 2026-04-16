import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { residentRecords } from '../../data/mock/adminData';
import { formatCurrency } from '../../utils/formatters';

const columns = [
  { key: 'id', title: 'Student ID' },
  { key: 'name', title: 'Student Name' },
  { key: 'room', title: 'Room' },
  { key: 'due', title: 'Due Balance', render: (value) => formatCurrency(value) },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function BillingManagement() {
  useDocumentTitle('Billing Management');

  return (
    <div>
      <PageHeader
        title="Billing Management"
        description="Review resident liabilities and maintain billing lifecycle consistency."
      />

      <PageSection title="Billing Ledger">
        <DataTable columns={columns} rows={residentRecords} />
      </PageSection>
    </div>
  );
}