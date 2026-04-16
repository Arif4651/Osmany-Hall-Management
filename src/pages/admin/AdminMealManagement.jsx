import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { mealTrend } from '../../data/mock/adminData';
import { formatCurrency } from '../../utils/formatters';

const menuRows = [
  { id: 'MN-01', meal: 'Breakfast', menu: 'Paratha + Egg', unitCost: 45, status: 'active' },
  { id: 'MN-02', meal: 'Lunch', menu: 'Rice + Fish + Lentils', unitCost: 85, status: 'active' },
  { id: 'MN-03', meal: 'Dinner', menu: 'Rice + Chicken Curry', unitCost: 95, status: 'active' },
];

const columns = [
  { key: 'id', title: 'Menu ID' },
  { key: 'meal', title: 'Meal' },
  { key: 'menu', title: 'Item' },
  { key: 'unitCost', title: 'Unit Cost', render: (value) => formatCurrency(value) },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function AdminMealManagement() {
  useDocumentTitle('Admin Meal Management');

  return (
    <div>
      <PageHeader
        title="Meal Management"
        description="Control daily menu planning and monitor weekly meal consumption trends."
      />

      <section className="two-col-grid">
        <PageSection title="Weekly Consumption Trend">
          <Card>
            <div className="chart-box">
              <ResponsiveContainer width="100%" height={260}>
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

        <PageSection title="Notes">
          <Card>
            <ul className="bullet-list">
              <li>Use trend line to adjust next week procurement plan.</li>
              <li>Track high-consumption days to optimize menu rotation.</li>
              <li>Update menu items before 7:00 PM daily.</li>
            </ul>
          </Card>
        </PageSection>
      </section>

      <PageSection title="Current Menu Configuration">
        <DataTable columns={columns} rows={menuRows} />
      </PageSection>
    </div>
  );
}