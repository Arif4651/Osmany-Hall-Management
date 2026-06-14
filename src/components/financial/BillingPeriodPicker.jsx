import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

const monthFormatter = new Intl.DateTimeFormat('en', { month: 'long' });
const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: monthFormatter.format(new Date(2000, index, 1)),
}));

export default function BillingPeriodPicker({ value, onChange }) {
  const current = new Date();
  const currentPeriod = { month: current.getMonth() + 1, year: current.getFullYear() };
  const selectedMonth = months[value.month - 1]?.label || '';
  const isCurrentPeriod = value.month === currentPeriod.month && value.year === currentPeriod.year;

  const changeYear = (offset) => onChange({ ...value, year: value.year + offset });

  return (
    <section className="billing-period-picker" aria-label="Billing period">
      <div className="billing-period-heading">
        <span className="billing-period-icon"><CalendarDays size={19} /></span>
        <div>
          <span>Billing period</span>
          <strong>{selectedMonth} {value.year}</strong>
        </div>
      </div>

      <div className="billing-period-controls">
        <label>
          <span>Month</span>
          <select
            value={value.month}
            onChange={(event) => onChange({ ...value, month: Number(event.target.value) })}
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </label>

        <div className="billing-year-control">
          <span>Year</span>
          <div>
            <button type="button" onClick={() => changeYear(-1)} title="Previous year" aria-label="Previous year">
              <ChevronLeft size={18} />
            </button>
            <strong>{value.year}</strong>
            <button type="button" onClick={() => changeYear(1)} title="Next year" aria-label="Next year">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>

        <button
          type="button"
          className="billing-current-button"
          disabled={isCurrentPeriod}
          onClick={() => onChange(currentPeriod)}
        >
          Current month
        </button>
      </div>
    </section>
  );
}
