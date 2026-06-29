import { memo, useCallback, useEffect, useMemo, useState } from 'react';
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
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { queryCache } from '../../services/queryCache';

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

const DEFAULT_MEAL_PREFERENCE = { enabled: true, optionItemId: '' };

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

const MealPreferenceRow = memo(function MealPreferenceRow({
  mealType,
  isLast,
  preference,
  options,
  isDisabled,
  onPreferenceChange,
}) {
  const handleEnabledChange = useCallback((event) => {
    onPreferenceChange(mealType.id, 'enabled', event.target.value === 'on');
  }, [mealType.id, onPreferenceChange]);

  const handleOptionChange = useCallback((event) => {
    onPreferenceChange(mealType.id, 'optionItemId', event.target.value);
  }, [mealType.id, onPreferenceChange]);

  return (
    <div className={`meal-pref-row ${isLast ? 'is-last' : ''}`}>
      <label className="field-control meal-pref-primary">
        <span>{mealType.label}</span>
        <select
          value={preference.enabled ? 'on' : 'off'}
          onChange={handleEnabledChange}
          disabled={isDisabled}
        >
          <option value="on">On</option>
          <option value="off">Off</option>
        </select>
      </label>
      {preference.enabled ? (
        <label className="field-control meal-pref-optional">
          <span>Optional Choice</span>
          <select
            value={preference.optionItemId || ''}
            onChange={handleOptionChange}
            disabled={isDisabled}
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
});

const MealPreferenceSection = memo(function MealPreferenceSection({
  title,
  feedback,
  mealTypes,
  preferences,
  mealOptionsByType,
  isDisabled,
  isCutoffPassed,
  isSaving,
  cutoffLabel,
  onDismissFeedback,
  onPreferenceChange,
  onSave,
  onReset,
}) {
  return (
    <PageSection title="Meal Preferences" subtitle={title}>
      <Card>
        <ActionFeedback feedback={feedback} onClose={onDismissFeedback} />
        <div className="form-grid">
          {mealTypes.map((mealType, index) => (
            <MealPreferenceRow
              key={mealType.id}
              mealType={mealType}
              isLast={index === mealTypes.length - 1}
              preference={preferences[mealType.id] || DEFAULT_MEAL_PREFERENCE}
              options={mealOptionsByType[mealType.id] || []}
              isDisabled={isDisabled}
              onPreferenceChange={onPreferenceChange}
            />
          ))}
        </div>
        <div className="inline-actions meal-preferences-actions">
          <Button
            disabled={isDisabled || isSaving}
            title={isCutoffPassed ? `Daily cutoff reached at ${cutoffLabel}` : 'Save tomorrow preferences'}
            onClick={onSave}
          >
            {isSaving ? 'Saving...' : 'Save Preferences'}
          </Button>
          <Button
            variant="secondary"
            disabled={isDisabled || isSaving}
            title={isCutoffPassed ? `Daily cutoff reached at ${cutoffLabel}` : 'Reset current form'}
            onClick={onReset}
          >
            Reset
          </Button>
        </div>
      </Card>
    </PageSection>
  );
});

const GuestMealRequest = memo(function GuestMealRequest({ request, mealLabel, onEdit, onDelete }) {
  const requestDate = useMemo(() => new Date(`${request.date}T00:00:00`), [request.date]);
  const monthLabel = useMemo(
    () => requestDate.toLocaleDateString('en-BD', { month: 'short' }),
    [requestDate],
  );

  const handleEdit = useCallback(() => {
    onEdit(request);
  }, [onEdit, request]);

  const handleDelete = useCallback(() => {
    onDelete(request.id);
  }, [onDelete, request.id]);

  return (
    <article className="guest-meal-request">
      <div className="guest-meal-date">
        <strong>{requestDate.getDate()}</strong>
        <span>{monthLabel}</span>
      </div>
      <div className="guest-meal-request-info">
        <strong>{mealLabel}</strong>
        <span>{request.guestCount} guest{request.guestCount === 1 ? '' : 's'} · {formatDate(request.date)}</span>
      </div>
      <div className="guest-meal-actions">
        <button type="button" onClick={handleEdit}>Edit</button>
        <button type="button" className="is-delete" onClick={handleDelete}>Remove</button>
      </div>
    </article>
  );
});

const GuestMealPanel = memo(function GuestMealPanel({
  cutoffLabel,
  countdownLabel,
  earliestGuestDate,
  guestForm,
  guestMonth,
  guestYear,
  guestMeals,
  guestFeedback,
  isCutoffPassed,
  isGuestLoading,
  isGuestSaving,
  mealTypes,
  mealTypeMap,
  onDismissFeedback,
  onFieldChange,
  onSubmit,
  onEdit,
  onDelete,
}) {
  const handleDateChange = useCallback((event) => {
    onFieldChange('date', event.target.value);
  }, [onFieldChange]);

  const handleMealPeriodChange = useCallback((event) => {
    onFieldChange('mealPeriod', event.target.value);
  }, [onFieldChange]);

  const handleGuestCountChange = useCallback((event) => {
    onFieldChange('guestCount', event.target.value);
  }, [onFieldChange]);

  return (
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

        <form className="guest-meal-form" onSubmit={onSubmit}>
          <label className="field-control">
            <span>Date</span>
            <input
              type="date"
              min={earliestGuestDate}
              value={guestForm.date}
              onChange={handleDateChange}
              required
            />
          </label>
          <label className="field-control">
            <span>Meal</span>
            <select
              value={guestForm.mealPeriod}
              onChange={handleMealPeriodChange}
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
              onChange={handleGuestCountChange}
              required
            />
          </label>
          <Button type="submit" disabled={isGuestSaving || !guestForm.mealPeriod}>
            {isGuestSaving ? 'Saving...' : 'Save Guest Meal'}
          </Button>
        </form>

        <ActionFeedback feedback={guestFeedback} onClose={onDismissFeedback} />

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
          {!isGuestLoading && guestMeals.map((request) => (
            <GuestMealRequest
              key={request.id}
              request={request}
              mealLabel={mealTypeMap[request.mealPeriod]?.label || request.mealPeriod}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      </Card>
    </PageSection>
  );
});

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
  const [guestActionError, setGuestActionError] = useState('');
  const [guestMessage, setGuestMessage] = useState('');
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
  const earliestGuestDate = useMemo(() => getEarliestGuestDate(isCutoffPassed), [isCutoffPassed]);
  const guestMonth = useMemo(
    () => Number(guestForm.date.slice(5, 7)) || new Date().getMonth() + 1,
    [guestForm.date],
  );
  const guestYear = useMemo(
    () => Number(guestForm.date.slice(0, 4)) || new Date().getFullYear(),
    [guestForm.date],
  );

  const mealTypeMap = useMemo(
    () => Object.fromEntries(mealTypes.map((mealType) => [mealType.id, mealType])),
    [mealTypes],
  );

  const mealOptionsByType = useMemo(
    () => Object.fromEntries(mealTypes.map((mealType) => [mealType.id, getMealOptions(mealType.id)])),
    [getMealOptions, mealTypes],
  );

  const guestOptionsByDayAndMeal = useMemo(() => Object.fromEntries(
    (moduleDays || []).map((day) => [
      day.id,
      Object.fromEntries((day.meals || []).map((meal) => [
        meal.mealTypeId,
        meal.optionalItems || [],
      ])),
    ]),
  ), [moduleDays]);

  useEffect(() => {
    setGuestForm((current) => {
      const nextDate = current.date && current.date >= earliestGuestDate ? current.date : earliestGuestDate;
      const nextMealPeriod = current.mealPeriod || mealTypes[0]?.id || '';
      if (current.date === nextDate && current.mealPeriod === nextMealPeriod) return current;
      return {
        ...current,
        date: nextDate,
        mealPeriod: nextMealPeriod,
      };
    });
  }, [earliestGuestDate, mealTypes]);

  const guestMealsCacheKey = user?.studentId ? `guest-meals-${guestMonth}-${guestYear}-${user.studentId}` : null;
  const {
    data: cachedGuestMeals,
    isLoading: isGuestLoading,
    error: guestFetchError,
    refresh: refreshGuestMeals,
  } = useCachedFetch(
    guestMealsCacheKey,
    () => financialService.getGuestMeals(guestMonth, guestYear),
    { ttl: 30_000 }
  );

  const guestMeals = cachedGuestMeals || [];

  const guestError = guestActionError || guestFetchError || '';
  const setGuestError = setGuestActionError;

  const loadGuestMeals = useCallback(() => {
    queryCache.invalidate('guest-meals-');
    refreshGuestMeals();
  }, [refreshGuestMeals]);
  const countdownLabel = useMemo(() => {
    const hours = Math.floor(minutesUntilCutoff / 60);
    const minutes = minutesUntilCutoff % 60;
    if (hours > 0) return `${hours}h ${minutes}m remaining`;
    return `${minutes}m remaining`;
  }, [minutesUntilCutoff]);
  const handleDismissPreferenceFeedback = useCallback(() => {
    setPreferenceFeedback(null);
    clearErrorMessage();
  }, [clearErrorMessage]);

  const handleDismissGuestFeedback = useCallback(() => {
    setGuestError('');
    setGuestMessage('');
  }, [setGuestError]);

  const preferenceNotice = useMemo(() => preferenceFeedback || (errorMessage ? {
    type: 'error',
    title: 'Meal preferences unavailable',
    message: errorMessage,
  } : null), [errorMessage, preferenceFeedback]);

  const guestNotice = useMemo(() => {
    if (guestError) {
      return {
        type: 'error',
        title: 'Guest meal request failed',
        message: guestError,
      };
    }

    if (guestMessage) {
      return {
        type: 'success',
        title: 'Action completed',
        message: guestMessage,
      };
    }

    return null;
  }, [guestError, guestMessage]);

  const handleSave = useCallback(async () => {
    setPreferenceFeedback(null);

    // Validation: if enabled and options exist, optionItemId must be chosen
    for (const mealType of mealTypes) {
      const pref = preferences[mealType.id] || { enabled: false, optionItemId: '' };
      if (pref.enabled) {
        const options = mealOptionsByType[mealType.id] || [];
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
  }, [mealOptionsByType, mealTypes, preferences, savePreferences, tomorrowMenu?.label]);

  const handleReset = useCallback(async () => {
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
  }, [resetPreferences]);

  const getGuestMealOptions = useCallback((dateStr, mealPeriod) => {
    if (!dateStr || !mealPeriod) return [];
    const date = new Date(`${dateStr}T00:00:00`);
    const dayNames = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
    const dayCode = dayNames[date.getDay()];
    return guestOptionsByDayAndMeal[dayCode]?.[mealPeriod] || [];
  }, [guestOptionsByDayAndMeal]);

  const handleGuestFieldChange = useCallback((field, value) => {
    setGuestForm((current) => (
      current[field] === value ? current : { ...current, [field]: value }
    ));
  }, []);

  const handleGuestSubmit = useCallback(async (event) => {
    event.preventDefault();
    setGuestError('');
    setGuestMessage('');

    // Validation for guest meal options
    const guestOptions = getGuestMealOptions(guestForm.date, guestForm.mealPeriod);
    if (guestOptions && guestOptions.length > 0) {
      // Check tomorrow's preference for this meal period as the active choice
      const pref = preferences[guestForm.mealPeriod] || { enabled: false, optionItemId: '' };
      if (!pref.enabled || !pref.optionItemId) {
        setGuestError(`To book a guest meal for ${mealTypeMap[guestForm.mealPeriod]?.label || guestForm.mealPeriod}, you must enable your own meal and select an optional choice for that period first.`);
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
  }, [getGuestMealOptions, guestForm, loadGuestMeals, mealTypeMap, preferences, setGuestError]);

  const editGuestMeal = useCallback((request) => {
    setGuestForm({
      date: request.date,
      mealPeriod: request.mealPeriod,
      guestCount: request.guestCount,
    });
    setGuestMessage('Request loaded. Update the details and save again.');
  }, []);

  const deleteGuestMeal = useCallback(async (id) => {
    setGuestError('');
    setGuestMessage('');
    try {
      await financialService.deleteGuestMeal(id);
      setGuestMessage('Guest meal request removed.');
      await loadGuestMeals();
    } catch (error) {
      setGuestError(error instanceof Error ? error.message : 'Failed to remove guest meal.');
    }
  }, [loadGuestMeals, setGuestError]);

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
        <MealPreferenceSection
          title={`Applied for ${tomorrowMenu?.label || 'tomorrow'}`}
          feedback={preferenceNotice}
          mealTypes={mealTypes}
          preferences={preferences}
          mealOptionsByType={mealOptionsByType}
          isDisabled={isLoading || isCutoffPassed}
          isCutoffPassed={isCutoffPassed}
          isSaving={isSaving}
          cutoffLabel={cutoffLabel}
          onDismissFeedback={handleDismissPreferenceFeedback}
          onPreferenceChange={updatePreference}
          onSave={handleSave}
          onReset={handleReset}
        />

        <GuestMealPanel
          cutoffLabel={cutoffLabel}
          countdownLabel={countdownLabel}
          earliestGuestDate={earliestGuestDate}
          guestForm={guestForm}
          guestMonth={guestMonth}
          guestYear={guestYear}
          guestMeals={guestMeals}
          guestFeedback={guestNotice}
          isCutoffPassed={isCutoffPassed}
          isGuestLoading={isGuestLoading}
          isGuestSaving={isGuestSaving}
          mealTypes={mealTypes}
          mealTypeMap={mealTypeMap}
          onDismissFeedback={handleDismissGuestFeedback}
          onFieldChange={handleGuestFieldChange}
          onSubmit={handleGuestSubmit}
          onEdit={editGuestMeal}
          onDelete={deleteGuestMeal}
        />
      </section>

    </div>
  );
}
