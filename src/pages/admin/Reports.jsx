import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { monthlyRevenue, reportCards } from '../../data/mock/adminData';
import { formatCurrency } from '../../utils/formatters';

export default function Reports() {
  useDocumentTitle('Reports');

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Review performance summaries and operational indicators for decision-making."
      />

      <section className="stat-grid">
        {reportCards.map((card) => (
          <Card key={card.title} className="report-card">
            <p>{card.title}</p>
            <h3>{card.value}</h3>
            <small>{card.description}</small>
          </Card>
        ))}
      </section>

      <section className="two-col-grid">
        <PageSection title="Revenue Report">
          <div className="chart-box">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyRevenue}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                <Bar dataKey="collected" fill="#0f766e" />
                <Bar dataKey="pending" fill="#f97316" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </PageSection>

        <PageSection title="Report Notes">
          <Card>
            <ul className="bullet-list">
              <li>Collection efficiency crossed 90% this month.</li>
              <li>Pending dues decreased due to faster verification cycle.</li>
              <li>Meal cost remains stable versus prior month.</li>
            </ul>
          </Card>
        </PageSection>
      </section>
    </div>
  );
}