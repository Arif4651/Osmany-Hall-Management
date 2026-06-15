import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useStudentMealModule from '../../hooks/useStudentMealModule';
import { financialService } from '../../services/financialService';
import { formatCutoffTimeLabel } from '../../constants/mealConfig';
import { formatDate } from '../../utils/formatters';

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getEarliestGuestDate(isCutoffPassed) {
  const date = new Date();
  date.setDate(date.getDate() + (isCutoffPassed ? 2 : 1));
  return formatLocalDate(date);
}

function ActionFeedback({ feedback, onClose }) {
  if (!feedback) return null;
  const Icon = feedback.type === 'success'
    ? CheckCircle2
    : feedback.type === 'error'
      ? AlertCircle
      : Info;

  return (
    <div className={`meal-action-feedback is-${feedback.type}`} role="status" aria-live="polite">
      <Icon size={19} />
      <div>
        <strong>{feedback.title}</strong>
        {feedback.message ? <span>{feedback.message}</span> : null}
      </div>
      <button type="button" onClick={onClose} aria-label="Dismiss message"><X size={16} /></button>
    </div>
  );
}

export default function MealManagement() {
  useDocumentTitle('Meal Management');
  const { user } = useAuth();

  const {
    isLoading,
    errorMessage,
    mealTypes,
    cutoffTime,
    isCutoffPassed,
    minutesUntilCutoff,
    tomorrowMenu,
    preferences,
    moduleDays,
    clearErrorMessage,
    updatePreference,
    savePreferences,
    resetPreferences,
    getMealOptions,
  } = useStudentMealModule(user?.studentId);

  const [isSaving, setIsSaving] = useState(false);
  const [preferenceFeedback, setPreferenceFeedback] = useState(null);
  const [guestForm, setGuestForm] = useState({ date: '', mealPeriod: '', guestCount: 1 });
  const [guestMeals, setGuestMeals] = useState([]);
  const [guestError, setGuestError] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
  const [isGuestLoading, setIsGuestLoading] = useState(false);
  const [isGuestSaving, setIsGuestSaving] = useState(false);

  useEffect(() => {
    if (!preferenceFeedback || preferenceFeedback.type === 'error') return undefined;
    const timeoutId = window.setTimeout(() => setPreferenceFeedback(null), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [preferenceFeedback]);

  useEffect(() => {
    if (!guestMessage) return undefined;
    const timeoutId = window.setTimeout(() => setGuestMessage(''), 4500);
    return () => window.clearTimeout(timeoutId);
  }, [guestMessage]);

  const cutoffLabel = formatCutoffTimeLabel(cutoffTime);
  const earliestGuestDate = getEarliestGuestDate(isCutoffPassed);
  const guestMonth = Number(guestForm.date.slice(5, 7)) || new Date().getMonth() + 1;
  const guestYear = Number(guestForm.date.slice(0, 4)) || new Date().getFullYear();

  useEffect(() => {
    setGuestForm((current) => ({
      ...current,
      date: current.date && current.date >= earliestGuestDate ? current.date : earliestGuestDate,
      mealPeriod: current.mealPeriod || mealTypes[0]?.id || '',
    }));
  }, [earliestGuestDate, mealTypes]);

  const loadGuestMeals = useCallback(async () => {
    setIsGuestLoading(true);
    setGuestError('');
    try {
      const rows = await financialService.getGuestMeals(guestMonth, guestYear);
      setGuestMeals(rows);
    } catch (error) {
      setGuestError(error instanceof Error ? error.message : 'Failed to load guest meals.');
    } finally {
      setIsGuestLoading(false);
    }
  }, [guestMonth, guestYear]);

  useEffect(() => {
    loadGuestMeals();
  }, [loadGuestMeals]);
  const countdownLabel = useMemo(() => {
    const hours = Math.floor(minutesUntilCutoff / 60);
    const minutes = minutesUntilCutoff % 60;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }, [minutesUntilCutoff]);
  const handleSave = async () => {
    setPreferenceFeedback(null);

    // Validation: if enabled and options exist, optionItemId must be chosen
    for (const mealType of mealTypes) {
      const pref = preferences[mealType.id] || { enabled: false, optionItemId: '' };
      if (pref.enabled) {
        const options = getMealOptions(mealType.id);
        if (options && options.length > 0 && !pref.optionItemId) {
          setPreferenceFeedback({
            type: 'error',
            title: 'Option Required',
            message: `Please select an optional choice for ${mealType.label} before saving.`,
          });
          return;
        }
      }
    }

    setIsSaving(true);
    try {
      await savePreferences();
      setPreferenceFeedback({
        type: 'success',
        title: 'Preferences saved',
        message: `Your meal choices for ${tomorrowMenu?.label || 'the next meal day'} were updated successfully.`,
      });
    } catch (error) {
      setPreferenceFeedback({
        type: 'error',
        title: 'Could not save preferences',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    setPreferenceFeedback(null);
    try {
      await resetPreferences();
      setPreferenceFeedback({
        type: 'info',
        title: 'Form reset',
        message: 'Your currently saved meal preferences have been restored.',
      });
    } catch (error) {
      setPreferenceFeedback({
        type: 'error',
        title: 'Could not reset preferences',
        message: error instanceof Error ? error.message : 'Please try again.',
      });
    }
  };

  const getGuestMealOptions = (dateStr, mealPeriod) => {
    if (!dateStr || !mealPeriod || !moduleDays || moduleDays.length === 0) return [];
    const date = new Date(`${dateStr}T00:00:00`);
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayCode = dayNames[date.getDay()];
    const dayData = moduleDays.find((d) => d.id === dayCode);
    if (!dayData) return [];
    const meal = dayData.meals.find((m) => m.mealTypeId === mealPeriod);
    return meal?.optionalItems || [];
  };

  const handleGuestSubmit = async (event) => {
    event.preventDefault();
    setGuestError('');
    setGuestMessage('');

    // Validation for guest meal options
    const guestOptions = getGuestMealOptions(guestForm.date, guestForm.mealPeriod);
    if (guestOptions && guestOptions.length > 0) {
      // Check tomorrow's preference for this meal period as the active choice
      const pref = preferences[guestForm.mealPeriod] || { enabled: false, optionItemId: '' };
      if (!pref.enabled || !pref.optionItemId) {
        setGuestError(`To book a guest meal for ${mealTypes.find(m => m.id === guestForm.mealPeriod)?.label || guestForm.mealPeriod}, you must enable your own meal and select an optional choice for that period first.`);
        return;
      }
    }

    setIsGuestSaving(true);
    try {
      await financialService.saveGuestMeal({
        date: guestForm.date,
        mealPeriod: guestForm.mealPeriod,
        guestCount: Number(guestForm.guestCount),
      });
      setGuestMessage('Guest meal request saved successfully.');
      await loadGuestMeals();
    } catch (error) {
      setGuestError(error instanceof Error ? error.message : 'Failed to save guest meal.');
    } finally {
      setIsGuestSaving(false);
    }
  };

  const editGuestMeal = (request) => {
    setGuestForm({
      date: request.date,
      mealPeriod: request.mealPeriod,
      guestCount: request.guestCount,
    });
    setGuestMessage('Request loaded. Update the details and save again.');
  };

  const deleteGuestMeal = async (id) => {
    setGuestError('');
    setGuestMessage('');
    try {
      await financialService.deleteGuestMeal(id);
      setGuestMessage('Guest meal request removed.');
      await loadGuestMeals();
    } catch (error) {
      setGuestError(error instanceof Error ? error.message : 'Failed to remove guest meal.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Meal Management"
        description="Maintain daily meal preferences, track consumption history, and explore daily specials."
        aside={(
          <div className={`meal-update-status ${isCutoffPassed ? 'is-closed' : 'is-open'}`}>
            <span className="meal-update-status-dot" />
            <div>
              <strong>{isCutoffPassed ? 'Tomorrow Meal Update Closed' : 'Tomorrow Meal Preferences'}</strong>
              <small>
                {isCutoffPassed
                  ? `Cutoff ended at ${cutoffLabel}`
                  : `Open until ${cutoffLabel} · ${countdownLabel}`}
              </small>
            </div>
          </div>
        )}
      />

      <section className="two-col-grid">
        <PageSection title="Meal Preferences" subtitle={`Applied for ${tomorrowMenu?.label || 'tomorrow'}`}>
          <Card>
            <ActionFeedback
              feedback={preferenceFeedback || (errorMessage ? {
                type: 'error',
                title: 'Meal preferences unavailable',
                message: errorMessage,
              } : null)}
              onClose={() => {
                setPreferenceFeedback(null);
                clearErrorMessage();
              }}
            />
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
                              {option.name}
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
                onClick={handleReset}
              >
                Reset
              </Button>
            </div>
          </Card>
        </PageSection>

        <PageSection title="Guest Meal Configuration" subtitle="Book extra meals for your guests">
          <Card className="guest-meal-card">
            <div className={`student-cutoff-alert ${isCutoffPassed ? 'is-locked' : 'is-open'}`}>
              <strong>Guest meals can be booked from {formatDate(earliestGuestDate)}.</strong>
              <small>
                {isCutoffPassed
                  ? `Today's ${cutoffLabel} cutoff has passed.`
                  : `Cutoff time: ${cutoffLabel} (${countdownLabel}).`}
              </small>
            </div>

            <form className="guest-meal-form" onSubmit={handleGuestSubmit}>
              <label className="field-control">
                <span>Date</span>
                <input
                  type="date"
                  min={earliestGuestDate}
                  value={guestForm.date}
                  onChange={(event) => setGuestForm({ ...guestForm, date: event.target.value })}
                  required
                />
              </label>
              <label className="field-control">
                <span>Meal</span>
                <select
                  value={guestForm.mealPeriod}
                  onChange={(event) => setGuestForm({ ...guestForm, mealPeriod: event.target.value })}
                  required
                >
                  {mealTypes.map((mealType) => (
                    <option key={mealType.id} value={mealType.id}>{mealType.label}</option>
                  ))}
                </select>
              </label>
              <label className="field-control">
                <span>Number of Guests</span>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={guestForm.guestCount}
                  onChange={(event) => setGuestForm({ ...guestForm, guestCount: event.target.value })}
                  required
                />
              </label>
              <Button type="submit" disabled={isGuestSaving || !guestForm.mealPeriod}>
                {isGuestSaving ? 'Saving...' : 'Save Guest Meal'}
              </Button>
            </form>

            <ActionFeedback
              feedback={guestError ? {
                type: 'error',
                title: 'Guest meal request failed',
                message: guestError,
              } : guestMessage ? {
                type: 'success',
                title: 'Action completed',
                message: guestMessage,
              } : null}
              onClose={() => {
                setGuestError('');
                setGuestMessage('');
              }}
            />

            <div className="guest-meal-list-header">
              <div>
                <strong>Saved Requests</strong>
                <small>{guestMonth}/{guestYear}</small>
              </div>
              <span>{guestMeals.length} request{guestMeals.length === 1 ? '' : 's'}</span>
            </div>

            <div className="guest-meal-list">
              {isGuestLoading ? <p className="guest-meal-empty">Loading guest meals...</p> : null}
              {!isGuestLoading && guestMeals.length === 0 ? (
                <p className="guest-meal-empty">No guest meals booked for this month.</p>
              ) : null}
              {!isGuestLoading && guestMeals.map((request) => {
                const requestDate = new Date(`${request.date}T00:00:00`);
                const mealLabel = mealTypes.find((meal) => meal.id === request.mealPeriod)?.label
                  || request.mealPeriod;
                return (
                  <article className="guest-meal-request" key={request.id}>
                    <div className="guest-meal-date">
                      <strong>{requestDate.getDate()}</strong>
                      <span>{requestDate.toLocaleDateString('en-BD', { month: 'short' })}</span>
                    </div>
                    <div className="guest-meal-request-info">
                      <strong>{mealLabel}</strong>
                      <span>{request.guestCount} guest{request.guestCount === 1 ? '' : 's'} · {formatDate(request.date)}</span>
                    </div>
                    <div className="guest-meal-actions">
                      <button type="button" onClick={() => editGuestMeal(request)}>Edit</button>
                      <button type="button" className="is-delete" onClick={() => deleteGuestMeal(request.id)}>Remove</button>
                    </div>
                  </article>
                );
              })}
            </div>
          </Card>
        </PageSection>
      </section>

    </div>
  );
}
