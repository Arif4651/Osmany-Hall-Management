import { useMemo, useState } from 'react';
import DataTable from '../../components/common/DataTable';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useStudentMealModule from '../../hooks/useStudentMealModule';
import { formatCutoffTimeLabel } from '../../constants/mealConfig';
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

  const {
    isLoading,
    errorMessage,
    mealTypes,
    cutoffTime,
    isCutoffPassed,
    minutesUntilCutoff,
    tomorrowMenu,
    moduleDays,
    preferences,
    updatePreference,
    savePreferences,
    resetPreferences,
    getMealOptions,
  } = useStudentMealModule();

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const cutoffLabel = formatCutoffTimeLabel(cutoffTime);
  const countdownLabel = useMemo(() => {
    const hours = Math.floor(minutesUntilCutoff / 60);
    const minutes = minutesUntilCutoff % 60;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }, [minutesUntilCutoff]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await savePreferences();
    } finally {
      setIsSaving(false);
    }
  };

  const resolveMealByType = (dayEntry, mealTypeId) => dayEntry.meals.find((meal) => meal.mealTypeId === mealTypeId);

  return (
    <div>
      <PageHeader
        title="Meal Management"
        description="Maintain daily meal preferences, track consumption history, and explore daily specials."
        actions={[
          { label: 'View Menu', variant: 'secondary', onClick: () => setIsMenuOpen(true), disabled: isLoading },
          {
            label: isCutoffPassed ? 'Cutoff Closed' : 'Update Tomorrow Meal',
            variant: 'primary',
            onClick: () => null,
            disabled: isLoading || isCutoffPassed,
            title: isCutoffPassed ? `Daily cutoff reached at ${cutoffLabel}` : `Open until ${cutoffLabel}`,
          },
        ]}
      />

      <section className="two-col-grid">
        <PageSection title="Meal Preferences" subtitle={`Applied for ${tomorrowMenu?.label || 'tomorrow'}`}>
          <Card>
            {errorMessage ? <p className="menu-config-line">{errorMessage}</p> : null}
            <div className="form-grid">
              {mealTypes.map((mealType, mealTypeIndex) => {
                const pref = preferences[mealType.id] || { enabled: true, optionItemId: '' };
                const options = getMealOptions(mealType.id);

                return (
                  <div
                    key={mealType.id}
                    className="meal-pref-row"
                    style={{
                      display: 'flex',
                      gap: '1rem',
                      flexWrap: 'wrap',
                      alignItems: 'flex-end',
                      paddingBottom: mealTypeIndex < mealTypes.length - 1 ? '1rem' : '0',
                      borderBottom: mealTypeIndex < mealTypes.length - 1 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <label className="field-control" style={{ flex: 1 }}>
                      <span>{mealType.label}</span>
                      <select
                        value={pref.enabled ? 'on' : 'off'}
                        onChange={(event) => updatePreference(mealType.id, 'enabled', event.target.value === 'on')}
                        disabled={isLoading || isCutoffPassed}
                      >
                        <option value="on">On</option>
                        <option value="off">Off</option>
                      </select>
                    </label>
                    {pref.enabled ? (
                      <label className="field-control" style={{ flex: 2 }}>
                        <span>Optional Choice</span>
                        <select
                          value={pref.optionItemId || ''}
                          onChange={(event) => updatePreference(mealType.id, 'optionItemId', event.target.value)}
                          disabled={isLoading || isCutoffPassed}
                        >
                          <option value="">None</option>
                          {options.map((option) => (
                            <option key={option.id} value={option.id}>
                              {option.name} (+{formatCurrency(option.cost)})
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="inline-actions" style={{ marginTop: '1.2rem' }}>
              <Button
                disabled={isLoading || isCutoffPassed || isSaving}
                title={isCutoffPassed ? `Daily cutoff reached at ${cutoffLabel}` : 'Save tomorrow preferences'}
                onClick={handleSave}
              >
                {isSaving ? 'Saving...' : 'Save Preferences'}
              </Button>
              <Button
                variant="secondary"
                disabled={isLoading || isCutoffPassed || isSaving}
                title={isCutoffPassed ? `Daily cutoff reached at ${cutoffLabel}` : 'Reset current form'}
                onClick={resetPreferences}
              >
                Reset
              </Button>
            </div>
          </Card>
        </PageSection>

        <PageSection title="Current Rules" subtitle={`Meal changes close daily at ${cutoffLabel}`}>
          <Card>
            <div className={`student-cutoff-alert ${isCutoffPassed ? 'is-locked' : 'is-open'}`}>
              <strong>
                {isCutoffPassed
                  ? `Meal changes are currently locked (closed at ${cutoffLabel}).`
                  : `Meal changes are open until ${cutoffLabel}.`}
              </strong>
              <small>
                {isCutoffPassed
                  ? 'Updates will be applied to the next available cycle after tomorrow.'
                  : `You can still update preferences for tomorrow (${countdownLabel}).`}
              </small>
            </div>
            <ul className="bullet-list">
              <li>Late changes are applied on next available meal cycle.</li>
              <li>Meal off requests are billed only for active meals and common items are always divided if you stay.</li>
              <li>Emergency updates require admin approval.</li>
            </ul>
          </Card>
        </PageSection>
      </section>

      <PageSection title="Meal History" subtitle="Past entries and statuses">
        <DataTable columns={mealColumns} rows={studentMealHistory} />
      </PageSection>

      <Modal
        isOpen={isMenuOpen}
        onClose={() => setIsMenuOpen(false)}
        title="Weekly Diet Menu"
        actions={
          <>
            <Button variant="secondary" onClick={() => setIsMenuOpen(false)}>Close</Button>
            <Button variant="primary" onClick={() => alert('Menu downloaded as PDF')}>Download PDF</Button>
          </>
        }
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          {moduleDays.map((dayEntry) => (
            <Card key={dayEntry.id}>
              <h4 style={{ marginBottom: '0.8rem', color: 'var(--primary)', borderBottom: '1px solid var(--border)', paddingBottom: '0.4rem' }}>
                {dayEntry.label}
              </h4>
              <div style={{ display: 'grid', gap: '0.6rem' }}>
                {mealTypes.map((mealType) => {
                  const meal = resolveMealByType(dayEntry, mealType.id);
                  return (
                    <div key={`${dayEntry.id}-${mealType.id}`}>
                      <strong>{mealType.label}:</strong>
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                        <em>Common:</em> {(meal?.commonItems || []).map((item) => item.name).join(', ') || 'N/A'}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                        <em>Optional:</em> {(meal?.optionalItems || []).map((item) => `${item.name} (${formatCurrency(item.cost)})`).join(', ') || 'N/A'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          ))}
        </div>
      </Modal>
    </div>
  );
}
