import { useEffect, useState } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
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
  const [range, setRange] = useState({ from: getPastDate(30), to: tomorrow() });
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const maxDate = tomorrow();
    if (range.from > maxDate || range.to > maxDate) {
      setError('Dates beyond tomorrow cannot be selected.');
      return;
    }
    setLoading(true);
    try {
      const fetched = await financialService.getSnapshot(range.from, range.to);
      setRows([...fetched].reverse());
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    financialService.getSnapshot(getPastDate(30), tomorrow())
      .then((fetched) => setRows([...fetched].reverse()))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  const renderCell = (row, period) => {
    const meal = row.meals.find((entry) => entry.mealPeriod === period);
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
      <header>
        <h1>Meal Snapshot</h1>
        <p>Historical meal status and choices by date.</p>
      </header>

      {error && <div className="student-message student-message-error">{error}</div>}

      <section className="financial-card filter-row">
        <label>
          <span>From</span>
          <input
            type="date"
            max={tomorrow()}
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </label>
        <label>
          <span>To</span>
          <input
            type="date"
            max={tomorrow()}
            value={range.to}
            onChange={(e) => setRange({ ...range, to: e.target.value })}
          />
        </label>
        <button className="primary-action" onClick={load} disabled={loading}>
          {loading ? 'Applying...' : 'Apply'}
        </button>
      </section>

      <section className="financial-card table-wrap" style={{ position: 'relative' }}>
        {loading && (
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255, 255, 255, 0.72)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10,
            borderRadius: 'var(--radius-lg)'
          }}>
            <span style={{ fontWeight: '600', color: 'var(--primary)' }}>Loading snapshot...</span>
          </div>
        )}
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
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2rem 1rem' }}>
                  {loading ? 'Fetching records...' : 'No snapshot records found for the selected range.'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
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
      </section>
    </div>
  );
}
