import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { paymentQueue } from '../../data/mock/adminData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const columns = [
  { key: 'id', title: 'Payment ID' },
  { key: 'studentName', title: 'Student' },
  { key: 'billId', title: 'Bill ID' },
  { key: 'amount', title: 'Amount', render: (value) => formatCurrency(value) },
  { key: 'method', title: 'Method' },
  { key: 'submittedAt', title: 'Submitted At', render: (value) => formatDate(value) },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function PaymentVerification() {
  useDocumentTitle('Payment Verification');

  return (
    <div>
      <PageHeader
        title="Payment Verification"
        description="Validate proof of payment and keep billing state accurate."
        actions={[
          { label: 'Approve Selected', onClick: () => null },
          { label: 'Reject Selected', variant: 'danger', onClick: () => null },
        ]}
      />

      <PageSection title="Verification Queue">
        <DataTable columns={columns} rows={paymentQueue} />
      </PageSection>

      <section className="inline-actions">
        <Button>Approve Payment</Button>
        <Button variant="secondary">Request More Info</Button>
        <Button variant="danger">Reject</Button>
      </section>
    </div>
  );
}