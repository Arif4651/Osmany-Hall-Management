import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Undo2 } from 'lucide-react';

const monthLongFormatter = new Intl.DateTimeFormat('en', { month: 'long' });
const monthShortFormatter = new Intl.DateTimeFormat('en', { month: 'short' });

const MONTHS = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  long: monthLongFormatter.format(new Date(2000, index, 1)),
  short: monthShortFormatter.format(new Date(2000, index, 1)),
}));

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Month + year selector: chevrons for stepping one month at a time and a
 * popover with a year stepper and a 12-month grid for jumping anywhere.
 */
export default function MonthYearPicker({
  month,
  year,
  onChange,
  minYear,
  maxYear,
  label = 'Report period',
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [viewYear, setViewYear] = useState(year);
  const rootRef = useRef(null);
  const triggerRef = useRef(null);
  const panelId = useId();

  const today = useMemo(() => new Date(), []);
  const currentMonth = today.getMonth() + 1;
  const currentYear = today.getFullYear();
  const isOnCurrentPeriod = month === currentMonth && year === currentYear;

  // Absolute month index makes the range checks below trivial.
  const asIndex = useCallback((y, m) => (y * 12) + (m - 1), []);
  const minIndex = asIndex(minYear, 1);
  const maxIndex = asIndex(maxYear, 12);
  const selectedIndex = asIndex(year, month);

  const close = useCallback(() => {
    setIsOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setIsOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close]);

  const openPanel = () => {
    setViewYear(clamp(year, minYear, maxYear));
    setIsOpen(true);
  };

  const shiftMonth = (direction) => {
    const next = selectedIndex + direction;
    if (next < minIndex || next > maxIndex) return;
    onChange({ month: (next % 12) + 1, year: Math.floor(next / 12) });
  };

  const selectMonth = (nextMonth) => {
    onChange({ month: nextMonth, year: viewYear });
    close();
  };

  const selectedLabel = MONTHS[month - 1]?.long ?? '';

  return (
    <div className="period-picker" ref={rootRef}>
      <button
        type="button"
        className="period-picker-step"
        onClick={() => shiftMonth(-1)}
        disabled={selectedIndex <= minIndex}
        aria-label="Previous month"
        title="Previous month"
      >
        <ChevronLeft size={17} />
      </button>

      <button
        type="button"
        ref={triggerRef}
        className={`period-picker-trigger${isOpen ? ' is-open' : ''}`}
        onClick={() => (isOpen ? close() : openPanel())}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
      >
        <CalendarDays size={16} className="period-picker-trigger-icon" />
        <span className="period-picker-value">
          <small>{label}</small>
          <strong>{selectedLabel} {year}</strong>
        </span>
        <ChevronDown size={15} className="period-picker-caret" />
      </button>

      <button
        type="button"
        className="period-picker-step"
        onClick={() => shiftMonth(1)}
        disabled={selectedIndex >= maxIndex}
        aria-label="Next month"
        title="Next month"
      >
        <ChevronRight size={17} />
      </button>

      <button
        type="button"
        className="period-picker-today"
        onClick={() => onChange({ month: currentMonth, year: currentYear })}
        disabled={isOnCurrentPeriod}
        title="Jump to the current month"
      >
        <Undo2 size={14} />
        <span>Today</span>
      </button>

      {isOpen && (
        <div className="period-picker-panel" id={panelId} role="dialog" aria-label={label}>
          <div className="period-picker-year">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              disabled={viewYear <= minYear}
              aria-label="Previous year"
            >
              <ChevronLeft size={16} />
            </button>
            <strong>{viewYear}</strong>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              disabled={viewYear >= maxYear}
              aria-label="Next year"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <div className="period-picker-grid">
            {MONTHS.map((item) => {
              const isSelected = item.value === month && viewYear === year;
              const isToday = item.value === currentMonth && viewYear === currentYear;
              return (
                <button
                  key={item.value}
                  type="button"
                  className={`period-picker-month${isSelected ? ' is-selected' : ''}${isToday ? ' is-today' : ''}`}
                  onClick={() => selectMonth(item.value)}
                  aria-pressed={isSelected}
                  title={`${item.long} ${viewYear}`}
                >
                  {item.short}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
