import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { residentRecords } from '../../data/mock/adminData';
import { formatCurrency } from '../../utils/formatters';

const columns = [
  { key: 'id', title: 'Student ID' },
  { key: 'name', title: 'Name' },
  { key: 'room', title: 'Room' },
  { key: 'program', title: 'Program' },
  { key: 'due', title: 'Due Amount', render: (value) => formatCurrency(value) },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function StudentManagement() {
  useDocumentTitle('Student Management');

  return (
    <div>
      <PageHeader
        title="Student Management"
        description="Manage resident records, status, and due balance overview."
      />

      <PageSection title="Resident List">
        <DataTable columns={columns} rows={residentRecords} />
      </PageSection>
    </div>
  );
}