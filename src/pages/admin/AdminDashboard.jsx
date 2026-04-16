import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { adminStats, monthlyRevenue, paymentQueue } from '../../data/mock/adminData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const paymentColumns = [
  { key: 'id', title: 'Payment ID' },
  { key: 'studentName', title: 'Student' },
  { key: 'billId', title: 'Bill' },
  { key: 'method', title: 'Method' },
  { key: 'amount', title: 'Amount', render: (value) => formatCurrency(value) },
  { key: 'submittedAt', title: 'Submitted', render: (value) => formatDate(value) },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function AdminDashboard() {
  useDocumentTitle('Admin Dashboard');

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="Operational command center for residents, billing, inventory, and analytics."
      />

      <section className="stat-grid">
        {adminStats.map((stat) => (
          <StatCard
            key={stat.title}
            title={stat.title}
            value={stat.value}
            trend={stat.trend}
            tone={stat.tone}
            isCurrency={stat.isCurrency}
          />
        ))}
      </section>

      <section className="two-col-grid">
        <PageSection title="Monthly Revenue Trend">
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="collected" stroke="#0f766e" strokeWidth={2} />
                <Line type="monotone" dataKey="pending" stroke="#ea580c" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </PageSection>

        <PageSection title="Collection Snapshot">
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="collected" fill="#0f766e" radius={6} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PageSection>
      </section>

      <PageSection title="Payment Verification Queue">
        <DataTable columns={paymentColumns} rows={paymentQueue} />
      </PageSection>
    </div>
  );
}