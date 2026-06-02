import { useMemo } from 'react';
import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useStudentPortalData from '../../hooks/useStudentPortalData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const billColumns = [
  { key: 'billId', title: 'Bill ID' },
  { key: 'period', title: 'Period' },
  { key: 'mealCost', title: 'Meal Cost', render: (value) => formatCurrency(value) },
  { key: 'utility', title: 'Utility', render: (value) => formatCurrency(value) },
  { key: 'service', title: 'Service', render: (value) => formatCurrency(value) },
  { key: 'total', title: 'Total', render: (value) => formatCurrency(value) },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function StudentDashboard() {
  useDocumentTitle('Student Dashboard');

  const { isLoading, errorMessage, dashboardStats, bills, notifications } = useStudentPortalData();

  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.isRead),
    [notifications],
  );

  return (
    <div>
      <PageHeader
        title="Student Dashboard"
        description="Monitor your meals, billing status, and payment progress from one place."
      />

      {errorMessage ? <div className="student-message student-message-error">{errorMessage}</div> : null}

      <section className="stat-grid">
        {isLoading ? <p className="muted-text">Loading dashboard summary...</p> : null}
        {dashboardStats.map((item) => (
          <StatCard
            key={item.title}
            title={item.title}
            value={item.value}
            trend={item.trend}
            tone={item.tone}
            unit={item.unit === 'BDT' ? undefined : item.unit}
            isCurrency={item.unit === 'BDT'}
          />
        ))}
      </section>

      <section className="two-col-grid">
        <PageSection title="Recent Bills" subtitle="Latest billing records from the database">
          <DataTable columns={billColumns} rows={bills} />
        </PageSection>

        <PageSection title="Unread Notifications" subtitle="Important updates from hall administration">
          <div className="stack-list">
            {unreadNotifications
              .map((item) => (
                <Card key={item.id} className="notification-card">
                  <h4>{item.title}</h4>
                  <p>{item.description}</p>
                  <small>{formatDate(item.date)}</small>
                </Card>
              ))}
          </div>
        </PageSection>
      </section>
    </div>
  );
}