import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import { financialService } from '../../services/financialService';

const dateFormatter = new Intl.DateTimeFormat('en-CA');
const MEAL_PERIODS = ['breakfast', 'lunch', 'dinner'];

const getTomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return dateFormatter.format(d);
};

const getPastDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return dateFormatter.format(d);
};

const createInitialRange = () => ({
  from: getPastDate(30),
  to: getTomorrow(),
});

function normalizeSnapshotRow(row) {
  return {
    ...row,
    mealMap: Object.fromEntries((row.meals || []).map((meal) => [meal.mealPeriod, meal])),
  };
}

const SnapshotCell = memo(function SnapshotCell({ meal }) {
  if (!meal) return <span className="snapshot-empty-cell">-</span>;

  return (
    <div className="snapshot-meal-cell">
      <span className={`snapshot-status-badge ${meal.isOn ? 'is-on' : 'is-off'}`}>
        {meal.isOn ? `ON${meal.optionName ? ` (${meal.optionName})` : ''}` : 'OFF'}
      </span>
      {meal.guestCount > 0 ? (
        <span className="snapshot-guest-badge" title={`${meal.guestCount} Guest Meals Added`}>
          +{meal.guestCount} Guest
        </span>
      ) : null}
    </div>
  );
});

const SnapshotRow = memo(function SnapshotRow({ row }) {
  return (
    <tr>
      <td>{row.date}</td>
      {MEAL_PERIODS.map((period) => (
        <td key={period}>
          <SnapshotCell meal={row.mealMap[period]} />
        </td>
      ))}
    </tr>
  );
});

export default function MealSnapshot() {
  useDocumentTitle('Meal Snapshot');
  const tomorrowDate = useMemo(() => getTomorrow(), []);
  const initialRange = useMemo(() => createInitialRange(), []);
  const [inputs, setInputs] = useState(initialRange);
  const [appliedRange, setAppliedRange] = useState(initialRange);

  const cacheKey = `meal-snapshot-${appliedRange.from}-${appliedRange.to}`;

  const {
    data: fetchedRows = [],
    isLoading,
    isRefreshing,
    error: loadError,
  } = useCachedFetch(
    cacheKey,
    async () => {
      if (appliedRange.from > tomorrowDate || appliedRange.to > tomorrowDate) {
        throw new Error('Dates beyond tomorrow cannot be selected.');
      }
      const fetched = await financialService.getSnapshot(appliedRange.from, appliedRange.to);
      return [...fetched].reverse().map(normalizeSnapshotRow);
    },
    { ttl: 60_000 }
  );

  const [error, setError] = useState('');

  useEffect(() => {
    if (loadError) {
      setError(loadError.message);
    } else {
      setError('');
    }
  }, [loadError]);

  const applyRange = useCallback((event) => {
    event.preventDefault();
    setAppliedRange({ from: inputs.from, to: inputs.to });
  }, [inputs.from, inputs.to]);

  const handleFromChange = useCallback((event) => {
    setInputs((current) => (
      current.from === event.target.value ? current : { ...current, from: event.target.value }
    ));
  }, []);

  const handleToChange = useCallback((event) => {
    setInputs((current) => (
      current.to === event.target.value ? current : { ...current, to: event.target.value }
    ));
  }, []);

  return (
    <div className="financial-page">
      {isRefreshing && <div className="data-refreshing-bar" />}
      
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        <CalendarDays size={24} style={{ color: 'var(--primary, #1e3a8a)', flexShrink: 0 }} />
        <div>
          <h1 style={{ margin: 0 }}>Meal Snapshot</h1>
          <p style={{ margin: '0.15rem 0 0 0' }}>Historical meal status and choices by date</p>
        </div>
      </header>

      {error && <div className="student-message student-message-error">{error}</div>}

      <form className="financial-card filter-row" onSubmit={applyRange}>
        <label>
          <span>From</span>
          <input
            type="date"
            max={tomorrowDate}
            value={inputs.from}
            onChange={handleFromChange}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            max={tomorrowDate}
            value={inputs.to}
            onChange={handleToChange}
          />
        </label>
        <button className="primary-action" type="submit" disabled={isLoading}>
          {isLoading ? 'Applying...' : 'Apply'}
        </button>
      </form>

      <section className="financial-card sticky-page-table snapshot-table-card">
        {isLoading && !fetchedRows.length ? (
          <TableSkeleton rows={5} cols={4} />
        ) : (
          <table className="student-snapshot-table">
            <thead>
              <tr>
                <th>Day</th>
                <th>Breakfast</th>
                <th>Lunch</th>
                <th>Dinner</th>
              </tr>
            </thead>
            <tbody>
              {fetchedRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="snapshot-empty-row">
                    No snapshot records found for the selected range.
                  </td>
                </tr>
              ) : (
                fetchedRows.map((row) => (
                  <SnapshotRow key={row.date} row={row} />
                ))
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
