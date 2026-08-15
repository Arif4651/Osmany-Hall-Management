import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import PageSection from '../layout/PageSection';
import MonthYearPicker from '../financial/MonthYearPicker';
import { financialService } from '../../services/financialService';
import { MENU_KEYS } from '../../services/permissionService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const now = new Date();

const weekdayFormatter = new Intl.DateTimeFormat('en', { weekday: 'short' });

/** "2026-08-10" -> { day: 10, weekday: "Mon", isWeekend: false } */
function describeDate(iso) {
  const date = new Date(`${iso}T00:00:00`);
  const weekday = date.getDay();
  return {
    day: date.getDate(),
    weekday: weekdayFormatter.format(date),
    isWeekend: weekday === 5 || weekday === 6,
  };
}

const markKey = (date, mealPeriod, itemId) => `${date}|${mealPeriod}|${itemId}`;

/**
 * Per-date, per-meal opt-ins for optional items (tea and similar).
 *
 * Shows a whole month at once — one row per date, one column per meal — because these are not
 * standing preferences: a student marking tea for twenty days would otherwise have to pick twenty
 * dates one at a time. The month arrives in a single request; toggling a box saves that one slot.
 */
export default function AdditionalPreferencesPanel() {
  const { can } = useAuth();
  const toast = useToast();
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [data, setData] = useState(null);
  const [marks, setMarks] = useState(() => new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async ({ month, year }) => {
    setIsLoading(true);
    try {
      const result = await financialService.getAdditionalMonth(month, year);
      setData(result);
      setMarks(new Set(result.marks.map((m) => markKey(m.date, m.mealPeriod, m.itemId))));
      setError('');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load additional preferences.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [period, load]);

  const toggle = useCallback(async (date, mealPeriod, item, nextSelected) => {
    const key = markKey(date, mealPeriod, item.itemId);
    setSavingKey(key);

    // Optimistic: a month grid feels unusable if every tick waits on a round-trip. Reverted below
    // if the server refuses.
    setMarks((current) => {
      const next = new Set(current);
      if (nextSelected) next.add(key); else next.delete(key);
      return next;
    });

    try {
      await financialService.saveAdditionalSelection({
        itemId: item.itemId, date, mealPeriod, selected: nextSelected,
      });
    } catch (saveError) {
      // The tick was applied optimistically, so a silent revert would look like the click simply
      // did not register. A toast is the only thing that explains the box springing back.
      toast.error(
        'Selection not saved',
        saveError instanceof Error ? saveError.message : 'Could not save your selection.',
      );
      setMarks((current) => {
        const next = new Set(current);
        if (nextSelected) next.delete(key); else next.add(key);
        return next;
      });
    } finally {
      setSavingKey('');
    }
  }, [toast]);

  // Memoised so the totals below don't recompute on every render.
  const items = useMemo(() => data?.items ?? [], [data]);
  const mealPeriods = data?.mealPeriods ?? [];
  const days = data?.days ?? [];
  const hasItems = items.length > 0;
  const multipleItems = items.length > 1;

  // Per-item totals for the month, so the student can sanity-check what they will be billed for.
  const totals = useMemo(() => {
    const counts = new Map(items.map((item) => [item.itemId, 0]));
    for (const key of marks) {
      const itemId = key.split('|')[2];
      if (counts.has(itemId)) counts.set(itemId, counts.get(itemId) + 1);
    }
    return items.map((item) => ({ ...item, count: counts.get(item.itemId) ?? 0 }));
  }, [marks, items]);

  // Two independent gates, both must pass:
  //  - the permission bit (a super admin can revoke this menu outright for the student role)
  //  - eligibility (no item currently assigned to this student's wing — e.g. Tea is Female-only
  //    today, so a male student's item list is naturally empty until that changes)
  // The section stays entirely hidden rather than showing an empty state, so a student whose
  // wing has no optional items sees nothing extra on the page — not a dead-end panel.
  if (!can(MENU_KEYS.studentAdditionalPreferences, 'view')) return null;
  // Nothing rendered until the very first load resolves, so a student with no eligible items
  // never sees a header-then-vanish flash — later month switches keep the section mounted and
  // show their own loading state inside the grid instead.
  if (isLoading && !data) return null;
  if (data && !hasItems && !error) return null;

  return (
    <PageSection
      title="Additional Preferences"
      subtitle="Optional extras such as tea. Tick the exact dates and meals you want — these are not standing preferences."
      className="additional-preferences"
    >
      <div className="additional-toolbar">
        <MonthYearPicker
          month={period.month}
          year={period.year}
          minYear={now.getFullYear() - 1}
          maxYear={now.getFullYear() + 1}
          allowFuture
          onChange={({ month, year }) => setPeriod({ month, year })}
          label="Month"
        />
        {hasItems && !isLoading ? (
          <div className="additional-totals">
            {totals.map((item) => (
              <span key={item.itemId} className="additional-total-pill">
                {item.name}: <strong>{item.count}</strong>
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {error ? <div className="student-message student-message-error">{error}</div> : null}

      {isLoading ? (
        <p className="additional-empty"><Loader2 size={15} className="spin" /> Loading…</p>
      ) : null}

      {!isLoading && !hasItems ? (
        <p className="additional-empty">
          No additional items are currently available to you. If you expect one here, ask the hall
          office to assign it to your wing.
        </p>
      ) : null}

      {!isLoading && hasItems ? (
        <>
          <div className="additional-month-wrap">
            <table className="additional-month-table">
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  {mealPeriods.map((meal) => (
                    <th key={meal.code} scope="col">{meal.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {days.map((dayRow) => {
                  const { day, weekday, isWeekend } = describeDate(dayRow.date);
                  return (
                    <tr
                      key={dayRow.date}
                      className={[
                        dayRow.isEditable ? '' : 'is-locked',
                        isWeekend ? 'is-weekend' : '',
                      ].filter(Boolean).join(' ')}
                    >
                      <th scope="row">
                        <span className="additional-day-num">{day}</span>
                        <span className="additional-day-weekday">{weekday}</span>
                      </th>
                      {mealPeriods.map((meal) => (
                        <td key={meal.code}>
                          <div className="additional-cell">
                            {items.map((item) => {
                              const key = markKey(dayRow.date, meal.code, item.itemId);
                              return (
                                <label
                                  key={item.itemId}
                                  className="additional-cell-item"
                                  title={`${item.name} · ${meal.label} · ${dayRow.date}`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={marks.has(key)}
                                    disabled={!dayRow.isEditable || savingKey === key}
                                    onChange={(event) =>
                                      toggle(dayRow.date, meal.code, item, event.target.checked)}
                                  />
                                  {multipleItems ? <span>{item.name}</span> : null}
                                </label>
                              );
                            })}
                          </div>
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

        
        </>
      ) : null}
    </PageSection>
  );
}
