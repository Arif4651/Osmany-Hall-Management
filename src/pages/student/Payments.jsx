import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { studentPayments } from '../../data/mock/studentData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const columns = [
  { key: 'id', title: 'Payment ID' },
  { key: 'billId', title: 'Bill ID' },
  { key: 'method', title: 'Method' },
  { key: 'amount', title: 'Amount', render: (value) => formatCurrency(value) },
  { key: 'date', title: 'Date', render: (value) => formatDate(value) },
  { key: 'reference', title: 'Reference' },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function Payments() {
  useDocumentTitle('Payments');

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Submit payment proof and track verification status."
        actions={[{ label: 'Submit New Payment', onClick: () => null }]}
      />

      <section className="two-col-grid">
        <PageSection title="Payment Submission" subtitle="Quick upload form">
          <Card>
            <div className="form-grid">
              <label className="field-control">
                <span>Invoice ID</span>
                <input type="text" placeholder="BILL-0426-01" />
              </label>
              <label className="field-control">
                <span>Amount</span>
                <input type="number" placeholder="5800" />
              </label>
              <label className="field-control">
                <span>Method</span>
                <select>
                  <option>bKash</option>
                  <option>Nagad</option>
                  <option>Bank Transfer</option>
                </select>
              </label>
              <label className="field-control">
                <span>Transaction ID</span>
                <input type="text" placeholder="TXNXXXX" />
              </label>
            </div>
            <Button>Submit Payment</Button>
          </Card>
        </PageSection>

        <PageSection title="Verification Notes" subtitle="Keep this information ready">
          <Card>
            <ul className="bullet-list">
              <li>Use exact transaction ID from payment provider.</li>
              <li>Submit payment before invoice due date.</li>
              <li>Verification typically completes within 24 hours.</li>
            </ul>
          </Card>
        </PageSection>
      </section>

      <PageSection title="Payment History" subtitle="Recent submissions and verification states">
        <DataTable columns={columns} rows={studentPayments} />
      </PageSection>
    </div>
  );
}