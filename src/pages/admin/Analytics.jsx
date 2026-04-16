import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { mealTrend, monthlyRevenue } from '../../data/mock/adminData';

export default function Analytics() {
  useDocumentTitle('Analytics');

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Analyze performance trends across meals, revenue, and pending collections."
      />

      <section className="two-col-grid">
        <PageSection title="Revenue Momentum">
          <Card>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={monthlyRevenue}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip />
                  <Area type="monotone" dataKey="collected" fill="#a7f3d0" stroke="#0f766e" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </PageSection>

        <PageSection title="Meal Utilization">
          <Card>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={mealTrend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="consumed" stroke="#1d4ed8" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </PageSection>
      </section>
    </div>
  );
}