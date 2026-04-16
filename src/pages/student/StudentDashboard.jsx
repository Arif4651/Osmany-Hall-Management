import PageHeader from '../../components/common/PageHeader';
import StatCard from '../../components/common/StatCard';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { studentSummary, studentMealHistory, studentNotifications } from '../../data/mock/studentData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const mealColumns = [
  { key: 'id', title: 'Meal ID' },
  { key: 'date', title: 'Date', render: (value) => formatDate(value) },
  { key: 'type', title: 'Meal Type' },
  { key: 'quantity', title: 'Qty' },
  { key: 'cost', title: 'Cost', render: (value) => formatCurrency(value) },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function StudentDashboard() {
  useDocumentTitle('Student Dashboard');

  return (
    <div>
      <PageHeader
        title="Student Dashboard"
        description="Monitor your meals, billing status, and payment progress from one place."
      />

      <section className="stat-grid">
        {studentSummary.map((item) => (
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
        <PageSection title="Recent Meal Entries" subtitle="Latest submissions and adjustments">
          <DataTable columns={mealColumns} rows={studentMealHistory} />
        </PageSection>

        <PageSection title="Unread Notifications" subtitle="Important updates from hall administration">
          <div className="stack-list">
            {studentNotifications
              .filter((item) => !item.isRead)
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