import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { auditLogs } from '../../data/mock/adminData';
import { formatDate } from '../../utils/formatters';

const columns = [
  { key: 'id', title: 'Log ID' },
  { key: 'actor', title: 'Actor' },
  { key: 'action', title: 'Action' },
  { key: 'module', title: 'Module' },
  { key: 'date', title: 'Date', render: (value) => formatDate(value) },
];

export default function AuditLogs() {
  useDocumentTitle('Audit Logs');

  return (
    <div>
      <PageHeader
        title="Audit Logs"
        description="Track administrative actions for transparency and operational compliance."
      />

      <PageSection title="Recent Activities">
        <DataTable columns={columns} rows={auditLogs} />
      </PageSection>
    </div>
  );
}