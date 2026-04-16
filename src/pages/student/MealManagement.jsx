import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { studentMealHistory } from '../../data/mock/studentData';
import { formatCurrency, formatDate } from '../../utils/formatters';

const mealColumns = [
  { key: 'id', title: 'Meal ID' },
  { key: 'date', title: 'Date', render: (value) => formatDate(value) },
  { key: 'type', title: 'Type' },
  { key: 'quantity', title: 'Quantity' },
  { key: 'cost', title: 'Cost', render: (value) => formatCurrency(value) },
  { key: 'status', title: 'Status', type: 'status' },
];

export default function MealManagement() {
  useDocumentTitle('Meal Management');

  return (
    <div>
      <PageHeader
        title="Meal Management"
        description="Maintain daily meal preferences and track consumption history."
        actions={[{ label: 'Update Tomorrow Meal', variant: 'primary', onClick: () => null }]}
      />

      <section className="two-col-grid">
        <PageSection title="Meal Preferences" subtitle="Applied for tomorrow">
          <Card>
            <div className="form-grid">
              <label className="field-control">
                <span>Breakfast</span>
                <select defaultValue="on">
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </label>
              <label className="field-control">
                <span>Lunch</span>
                <select defaultValue="on">
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </label>
              <label className="field-control">
                <span>Dinner</span>
                <select defaultValue="on">
                  <option value="on">On</option>
                  <option value="off">Off</option>
                </select>
              </label>
            </div>
            <div className="inline-actions">
              <Button>Save Preferences</Button>
              <Button variant="secondary">Reset</Button>
            </div>
          </Card>
        </PageSection>

        <PageSection title="Current Rules" subtitle="Meal changes close daily at 10:00 PM">
          <Card>
            <ul className="bullet-list">
              <li>Late changes are applied on next available meal cycle.</li>
              <li>Meal off requests are billed only for active meals.</li>
              <li>Emergency updates require admin approval.</li>
            </ul>
          </Card>
        </PageSection>
      </section>

      <PageSection title="Meal History" subtitle="Past entries and statuses">
        <DataTable columns={mealColumns} rows={studentMealHistory} />
      </PageSection>
    </div>
  );
}