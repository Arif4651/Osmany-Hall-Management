import { useState, useEffect } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import { financialService } from '../../services/financialService';

const tomorrow = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return new Intl.DateTimeFormat('en-CA').format(d);
};

const getPastDate = (daysAgo) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return new Intl.DateTimeFormat('en-CA').format(d);
};

export default function MealSnapshot() {
  useDocumentTitle('Meal Snapshot');
  const [inputs, setInputs] = useState({ from: getPastDate(30), to: tomorrow() });
  const [appliedRange, setAppliedRange] = useState({ from: getPastDate(30), to: tomorrow() });

  const cacheKey = `meal-snapshot-${appliedRange.from}-${appliedRange.to}`;

  const {
    data: fetchedRows = [],
    isLoading,
    isRefreshing,
    error: loadError,
    refresh
  } = useCachedFetch(
    cacheKey,
    async () => {
      const maxDate = tomorrow();
      if (appliedRange.from > maxDate || appliedRange.to > maxDate) {
        throw new Error('Dates beyond tomorrow cannot be selected.');
      }
      const fetched = await financialService.getSnapshot(appliedRange.from, appliedRange.to);
      return [...fetched].reverse();
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

  const applyRange = (event) => {
    event.preventDefault();
    setAppliedRange({ from: inputs.from, to: inputs.to });
  };

  const renderCell = (row, period) => {
    const meal = row.meals?.find((entry) => entry.mealPeriod === period);
    if (!meal) return <span style={{ color: 'var(--muted)' }}>—</span>;

    const baseStatus = meal.isOn ? (
      <span style={{
        background: '#eef2ff',
        color: '#4f46e5',
        padding: '0.2rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: '600'
      }}>
        ON{meal.optionName ? ` (${meal.optionName})` : ''}
      </span>
    ) : (
      <span style={{
        background: '#f1f5f9',
        color: '#64748b',
        padding: '0.2rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: '600'
      }}>
        OFF
      </span>
    );

    const guestBadge = meal.guestCount > 0 ? (
      <span style={{
        background: '#fef3c7',
        color: '#d97706',
        border: '1px solid #fde68a',
        padding: '0.2rem 0.5rem',
        borderRadius: '6px',
        fontSize: '0.8rem',
        fontWeight: '600',
        marginLeft: '0.4rem',
        display: 'inline-flex',
        alignItems: 'center',
        boxShadow: '0 1px 2px rgba(217,119,6,0.1)'
      }} title={`${meal.guestCount} Guest Meals Added`}>
        +{meal.guestCount} Guest
      </span>
    ) : null;

    return (
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        {baseStatus}
        {guestBadge}
      </div>
    );
  };

  return (
    <div className="financial-page">
      {isRefreshing && <div className="data-refreshing-bar" />}
      
      <header>
        <h1>Meal Snapshot</h1>
        <p>Historical meal status and choices by date.</p>
      </header>

      {error && <div className="student-message student-message-error">{error}</div>}

      <form className="financial-card filter-row" onSubmit={applyRange}>
        <label>
          <span>From</span>
          <input
            type="date"
            max={tomorrow()}
            value={inputs.from}
            onChange={(e) => setInputs({ ...inputs, from: e.target.value })}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            max={tomorrow()}
            value={inputs.to}
            onChange={(e) => setInputs({ ...inputs, to: e.target.value })}
          />
        </label>
        <button className="primary-action" type="submit" disabled={isLoading}>
          {isLoading ? 'Applying...' : 'Apply'}
        </button>
      </form>

      <section className="financial-card sticky-page-table" style={{ position: 'relative' }}>
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
                  <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem 1rem' }}>
                    No snapshot records found for the selected range.
                  </td>
                </tr>
              ) : (
                fetchedRows.map((row) => (
                  <tr key={row.date}>
                    <td>{row.date}</td>
                    <td>{renderCell(row, 'breakfast')}</td>
                    <td>{renderCell(row, 'lunch')}</td>
                    <td>{renderCell(row, 'dinner')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
