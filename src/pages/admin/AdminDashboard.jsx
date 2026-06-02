import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { formatCurrency, formatDate } from '../../utils/formatters';
import { portalService } from '../../services/portalService';

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

  const [dashboardData, setDashboardData] = useState({ stats: [], monthlyRevenue: [], payments: [] });
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadDashboard() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const nextData = await portalService.getAdminDashboard();
        if (isMounted) {
          setDashboardData(nextData);
        }
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load admin dashboard.');
          setDashboardData({ stats: [], monthlyRevenue: [], payments: [] });
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div>
      <PageHeader
        title="Admin Dashboard"
        description="Operational command center for residents, billing, inventory, and analytics."
      />

      {errorMessage ? <div className="student-message student-message-error">{errorMessage}</div> : null}

      <section className="stat-grid">
        {isLoading ? <p className="muted-text">Loading dashboard metrics...</p> : null}
        {dashboardData.stats.map((stat) => (
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
              <LineChart data={dashboardData.monthlyRevenue}>
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
              <BarChart data={dashboardData.monthlyRevenue}>
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
        <DataTable columns={paymentColumns} rows={dashboardData.payments} />
      </PageSection>
    </div>
  );
}