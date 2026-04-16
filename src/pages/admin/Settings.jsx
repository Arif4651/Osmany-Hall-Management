import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';

export default function Settings() {
  useDocumentTitle('Settings');

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure platform behaviors, notification policy, and operational thresholds."
      />

      <section className="two-col-grid">
        <PageSection title="System Preferences">
          <Card>
            <div className="form-grid">
              <label className="field-control">
                <span>Default Billing Day</span>
                <input type="number" defaultValue={5} />
              </label>
              <label className="field-control">
                <span>Payment Verification SLA (hours)</span>
                <input type="number" defaultValue={24} />
              </label>
              <label className="field-control">
                <span>Low Stock Alert Threshold (%)</span>
                <input type="number" defaultValue={20} />
              </label>
            </div>
          </Card>
        </PageSection>

        <PageSection title="Notification Settings">
          <Card>
            <div className="checkbox-list">
              <label>
                <input type="checkbox" defaultChecked /> Email billing reminders
              </label>
              <label>
                <input type="checkbox" defaultChecked /> SMS overdue alerts
              </label>
              <label>
                <input type="checkbox" /> Weekly operational summary
              </label>
            </div>
          </Card>
        </PageSection>
      </section>

      <div className="inline-actions">
        <Button>Save Changes</Button>
        <Button variant="secondary">Reset Defaults</Button>
      </div>
    </div>
  );
}