import { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import PageHeader from '../../components/common/PageHeader';
import DataTable from '../../components/common/DataTable';
import PageSection from '../../components/layout/PageSection';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Modal from '../../components/ui/Modal';
import useAdminMealModule from '../../hooks/useAdminMealModule';
import { formatCutoffTimeLabel } from '../../constants/mealConfig';
import { formatCurrency } from '../../utils/formatters';

function getItemsCost(items = []) {
  return items.reduce((sum, item) => sum + item.cost, 0);
}

function formatItems(items = []) {
  if (!items.length) return 'N/A';
  return items.map((item) => `${item.name} (${formatCurrency(item.cost)})`).join(', ');
}

export default function AdminMealManagement() {
  useDocumentTitle('Admin Meal Management');

  const {
    isLoading,
    errorMessage,
    cutoffTime,
    dayOptions,
    mealTypeOptions,
    menuRows,
    tomorrowForecast,
    updateCutoffTime,
    getMealForEdit,
    saveMealConfiguration,
  } = useAdminMealModule();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formState, setFormState] = useState({
    dayId: '',
    mealTypeId: '',
    commonText: '',
    optionalText: '',
  });

  const cutoffLabel = formatCutoffTimeLabel(cutoffTime);

  const handleOpenCreate = () => {
    setFormState({
      dayId: dayOptions[0]?.id || '',
      mealTypeId: mealTypeOptions[0]?.id || '',
      commonText: '',
      optionalText: '',
    });
    setIsModalOpen(true);
  };

  const handleEdit = (dayId, mealTypeId) => {
    const editable = getMealForEdit(dayId, mealTypeId);
    setFormState(editable);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formState.dayId || !formState.mealTypeId) return;

    setIsSaving(true);
    try {
      await saveMealConfiguration(formState);
      setIsModalOpen(false);
    } finally {
      setIsSaving(false);
    }
  };

  const renderMealCell = (row, mealType) => {
    const meal = row.mealsByType[mealType.id];

    if (!meal) {
      return <div className="menu-config-line">Not configured</div>;
    }

    return (
      <div className="menu-config-cell">
        <div className="menu-config-line">
          <strong>Common:</strong> {formatItems(meal.commonItems)}
        </div>
        <div className="menu-config-line">
          <strong>Options:</strong> {formatItems(meal.optionalItems)}
        </div>
        <div className="menu-config-line menu-config-cost">
          Base {formatCurrency(getItemsCost(meal.commonItems))}
        </div>
        <Button variant="ghost" onClick={() => handleEdit(row.dayId, mealType.id)}>
          Edit
        </Button>
      </div>
    );
  };

  const columns = useMemo(() => {
    const dynamicMealColumns = mealTypeOptions.map((mealType) => ({
      key: `meal-${mealType.id}`,
      title: mealType.label,
      render: (_, row) => renderMealCell(row, mealType),
    }));

    return [
      {
        key: 'dayLabel',
        title: 'Day',
        render: (value) => <strong className="menu-day-label">{value}</strong>,
      },
      ...dynamicMealColumns,
      {
        key: 'dailySummary',
        title: 'Daily Cost Summary',
        render: (_, row) => (
          <div className="menu-day-total">
            <p>
              <strong>Common:</strong> {formatCurrency(row.costSummary.commonTotal)}
            </p>
            <p>
              <strong>Optional:</strong> {formatCurrency(row.costSummary.optionalTotal)}
            </p>
            <p className="menu-day-total-value">Total: {formatCurrency(row.costSummary.total)}</p>
          </div>
        ),
      },
    ];
  }, [mealTypeOptions]);

  return (
    <div>
      <PageHeader
        title="Meal Management"
        description="Control daily menu planning, manage common/optional food items, and monitor usage."
        actions={[
          { label: 'Create Menu Planner', variant: 'primary', onClick: handleOpenCreate, disabled: isLoading },
          { label: 'Upload PDF', variant: 'secondary', onClick: () => {}, disabled: isLoading },
        ]}
      />

      <PageSection title="Global Cutoff Time" subtitle="Students must make changes before this time.">
        <Card>
          <div className="cutoff-row">
            <div className="cutoff-meta">
              <div>
                <p>Current cutoff: {cutoffLabel}</p>
                <small>Changes submitted after cutoff apply from the day after tomorrow.</small>
              </div>
            </div>
            <label className="field-control cutoff-control">
              <span>Set Cutoff</span>
              <input
                type="time"
                value={cutoffTime}
                onChange={(event) => updateCutoffTime(event.target.value)}
                disabled={isLoading}
              />
            </label>
          </div>
        </Card>
      </PageSection>

      <PageSection title="Tomorrow's Forecast" subtitle={`Projected meal demand for ${tomorrowForecast.dayLabel || 'tomorrow'}.`}>
        <Card>
          <div className="forecast-grid">
            {tomorrowForecast.entries.map((entry) => (
              <article key={entry.key} className="forecast-card">
                <p className="forecast-label">{entry.label}</p>
                <h4 className="forecast-value">{entry.value}</h4>
              </article>
            ))}
          </div>
          <p className="forecast-note">
            <Info size={14} /> Forecast is derived from configured menu complexity and item-level demand weighting.
          </p>
        </Card>
      </PageSection>

      <PageSection title="Current Menu Configuration" subtitle="Dynamic day-wise matrix generated from repository data.">
        {errorMessage ? <Card><p className="menu-config-line">{errorMessage}</p></Card> : null}
        <DataTable columns={columns} rows={menuRows} />
      </PageSection>

      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={formState.dayId && formState.mealTypeId ? 'Edit Meal Configuration' : 'Create Menu Planner'}
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)} disabled={isSaving}>Cancel</Button>
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? 'Saving...' : 'Save Planner'}
            </Button>
          </>
        }
      >
        <div className="form-grid">
          <label className="field-control">
            <span>Day</span>
            <select
              value={formState.dayId}
              onChange={(event) => setFormState((prev) => ({ ...prev, dayId: event.target.value }))}
            >
              {dayOptions.map((day) => (
                <option key={day.id} value={day.id}>{day.label}</option>
              ))}
            </select>
          </label>
          <label className="field-control">
            <span>Meal Type</span>
            <select
              value={formState.mealTypeId}
              onChange={(event) => setFormState((prev) => ({ ...prev, mealTypeId: event.target.value }))}
            >
              {mealTypeOptions.map((mealType) => (
                <option key={mealType.id} value={mealType.id}>{mealType.label}</option>
              ))}
            </select>
          </label>
          <label className="field-control" style={{ gridColumn: '1 / -1' }}>
            <span>Common Items (e.g. Rice-20, Dal-10)</span>
            <input
              type="text"
              value={formState.commonText}
              onChange={(event) => setFormState((prev) => ({ ...prev, commonText: event.target.value }))}
              placeholder="Item-Cost, Item-Cost..."
            />
          </label>
          <label className="field-control" style={{ gridColumn: '1 / -1' }}>
            <span>Optional Items (User-based cost)</span>
            <input
              type="text"
              value={formState.optionalText}
              onChange={(event) => setFormState((prev) => ({ ...prev, optionalText: event.target.value }))}
              placeholder="Item-Cost, Item-Cost..."
            />
          </label>
        </div>
        <p style={{ marginTop: '1rem', color: 'var(--muted)' }}>All values are repository-backed and ready for backend API transition.</p>
      </Modal>
    </div>
  );
}
