import { useMemo, useState, useEffect } from 'react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileSpreadsheet, FileText, CalendarDays, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import TableSkeleton from '../../components/ui/TableSkeleton';
import { adminDataService } from '../../services/adminDataService';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

const now = new Date();
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function DailyCost() {
  useDocumentTitle('Daily Cost');
  const { user, role } = useAuth();
  const isStudentView = role === 'student';
  const isLockedToWing = role === 'male_wing_admin' || role === 'female_wing_admin' || role === 'student';
  const costColumnLabel = isStudentView ? 'My Cost' : '/Head';
  const totalCostColumnLabel = isStudentView ? 'TOTAL My Cost' : 'TOTAL /Head';

  // Wing admins and students are locked to their wing gender; super_admin/admin default to 'All'
  const [filters, setFilters] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    gender: isLockedToWing ? (user?.wing || 'All') : 'All',
  });

  const cacheKey = `daily-cost-${role}-${user?.id || 'anonymous'}-${filters.month}-${filters.year}-${filters.gender}`;

  const {
    data: report = null,
    isLoading,
    isRefreshing,
    error: loadError
  } = useCachedFetch(
    cacheKey,
    () => adminDataService.getDailyCost(filters.month, filters.year, filters.gender),
    { ttl: 2 * 60_000 }
  );

  const [error, setError] = useState('');

  useEffect(() => {
    if (loadError) {
      setError(loadError.message);
    } else {
      setError('');
    }
  }, [loadError]);

  const currentMonthLabel = useMemo(
    () => new Date(filters.year, filters.month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
    [filters.month, filters.year],
  );
  const availableYears = useMemo(() => {
    const years = [];
    for (let year = now.getFullYear() - 3; year <= now.getFullYear() + 3; year += 1) {
      years.push(year);
    }
    return years;
  }, []);

  const selectedWingLabel = isStudentView
    ? `${user?.fullName || 'My'}`
    : isLockedToWing ? `${user?.wing} Wing` : filters.gender === 'All' ? 'All Wings' : `${filters.gender} Wing`;

  const getMealDisplayCost = (meal) => isStudentView ? meal.myCost : meal.perHead;
  const getRowDisplayTotal = (row) => isStudentView ? row.totalMyCost : row.totalPerHead;

  const moveMonth = (direction) => {
    setFilters((prev) => {
      const nextDate = new Date(prev.year, prev.month - 1 + direction, 1);
      return {
        ...prev,
        year: nextDate.getFullYear(),
        month: nextDate.getMonth() + 1,
      };
    });
  };

  const jumpToCurrentMonth = () => {
    setFilters((prev) => ({
      ...prev,
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    }));
  };

  const flatRows = () => {
    const fmt = (amount) => `Tk ${Number(amount || 0).toFixed(2)}`;

    const rowsData = (report?.rows || []).map((row) => {
      const formatCost = (meal) => {
        if (!meal.options || meal.options.length === 0) return fmt(meal.cost);
        return meal.options.map(o => `${o.name}: ${fmt(o.cost)}`).join(' | ');
      };
      return {
        Date: row.date,
        'Breakfast Cost': formatCost(row.breakfast),
        'B. Students': row.breakfast.students,
        [`B. ${costColumnLabel}`]: fmt(getMealDisplayCost(row.breakfast)),
        'Lunch Cost': formatCost(row.lunch),
        'L. Students': row.lunch.students,
        [`L. ${costColumnLabel}`]: fmt(getMealDisplayCost(row.lunch)),
        'Dinner Cost': formatCost(row.dinner),
        'D. Students': row.dinner.students,
        [`D. ${costColumnLabel}`]: fmt(getMealDisplayCost(row.dinner)),
        [totalCostColumnLabel]: fmt(getRowDisplayTotal(row)),
      };
    });

    if (report && rowsData.length > 0) {
      rowsData.push({
        Date: 'TOTAL',
        'Breakfast Cost': fmt(report.breakfast.cost),
        'B. Students': report.breakfast.students,
        [`B. ${costColumnLabel}`]: fmt(getMealDisplayCost(report.breakfast)),
        'Lunch Cost': fmt(report.lunch.cost),
        'L. Students': report.lunch.students,
        [`L. ${costColumnLabel}`]: fmt(getMealDisplayCost(report.lunch)),
        'Dinner Cost': fmt(report.dinner.cost),
        'D. Students': report.dinner.students,
        [`D. ${costColumnLabel}`]: fmt(getMealDisplayCost(report.dinner)),
        [totalCostColumnLabel]: fmt(getMealDisplayCost(report.grandTotal)),
      });
    }

    return rowsData;
  };

  const getBadgeClass = (name) => {
    const lower = name.toLowerCase();
    if (lower.includes('egg')) return 'egg';
    if (lower.includes('fish')) return 'fish';
    if (lower.includes('chicken')) return 'chicken';
    if (lower.includes('common') || lower.includes('no option')) return 'common';
    return 'other';
  };

  const renderStudentsCell = (meal) => {
    return (
      <td className="cell-student">
        <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{meal.students}</strong>
        {meal.options && meal.options.length > 0 && (
          <div className="daily-cost-option-badge-list">
            {meal.options
              .filter((opt) => opt.name.toLowerCase() !== 'common')
              .map((opt) => (
                <span key={opt.name} className={`daily-cost-option-badge ${getBadgeClass(opt.name)}`}>
                  {opt.name}: <b>{opt.students}</b>
                </span>
              ))}
          </div>
        )}
      </td>
    );
  };

  const renderCostCell = (meal, cellClass) => {
    const hasOptions = meal.options && meal.options.length > 0;
    return (
      <td className={cellClass}>
        {hasOptions ? (
          <div className="cell-option-breakdown">
            {meal.options.map((opt) => (
              <div key={opt.name} className="cell-option-row">
                <span className="opt-name">{opt.name}:</span>
                <span className="opt-val">{formatCurrency(opt.cost)}</span>
              </div>
            ))}
          </div>
        ) : (
          <strong style={{ fontSize: '0.95rem' }}>{formatCurrency(meal.cost)}</strong>
        )}
      </td>
    );
  };

  const renderPerHeadCell = (meal, cellClass) => {
    return (
      <td className={cellClass}>
        <strong>{formatCurrency(getMealDisplayCost(meal))}</strong>
      </td>
    );
  };

  const renderRowTotalPerHeadCell = (row) => {
    return (
      <td className="cell-total">
        <strong>{formatCurrency(getRowDisplayTotal(row))}</strong>
      </td>
    );
  };

  const renderFooterPerHeadCell = (meal, cellClass) => {
    return (
      <td className={cellClass} style={{ fontWeight: '750' }}>
        {formatCurrency(getMealDisplayCost(meal))}
      </td>
    );
  };

  const renderFooterGrandTotalCell = (grand) => {
    return (
      <td className="cell-total" style={{ fontWeight: '800' }}>
        {formatCurrency(getMealDisplayCost(grand))}
      </td>
    );
  };

  const excel = () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.json_to_sheet(flatRows()), 'Daily Cost');
    writeFile(book, `daily-cost-${filters.year}-${filters.month}.xlsx`);
  };

  const pdf = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // Add visual page header
    doc.setFontSize(16);
    doc.setTextColor(23, 50, 100);
    doc.text(`${isStudentView ? 'My Daily Cost' : 'Daily Cost Report'} - ${selectedWingLabel}`, 40, 40);

    doc.setFontSize(10);
    doc.setTextColor(100, 110, 130);
    doc.text(`Month: ${currentMonthLabel} | Exported: ${new Date().toLocaleDateString('en-GB')}`, 40, 55);

    const data = flatRows();
    autoTable(doc, {
      startY: 70,
      head: [Object.keys(data[0] || {})],
      body: data.map(Object.values),
      styles: { fontSize: 7, cellPadding: 4 },
      headStyles: { fillColor: [23, 50, 100], textColor: [255, 255, 255] },
      alternateRowStyles: { fillColor: [247, 249, 253] },
      theme: 'grid'
    });

    doc.save(`daily-cost-${filters.year}-${filters.month}.pdf`);
  };

  const parseRowDate = (dateStr) => {
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const date = new Date(year, month, day);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const dateLabel = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { dayName, dateLabel };
      }
    } catch {
      // Fallback
    }
    return { dayName: '', dateLabel: dateStr };
  };

  return (
    <div className="financial-page">
      {isRefreshing && <div className="data-refreshing-bar" />}

      <div className="daily-cost-header" style={{ display: 'flex', alignItems: 'center', gap: '0.62rem' }}>
        <CalendarDays size={28} style={{ color: 'var(--primary, #1e3a8a)', flexShrink: 0 }} />
        <div className="header-title">
          <h1 style={{ margin: 0 }}>{isStudentView ? 'My Daily Cost' : 'Daily Cost'}</h1>
          <p style={{ margin: '0.25rem 0 0 0' }}>{`${isStudentView ? 'Your meal cost' : 'Daily cost breakdown'} for ${selectedWingLabel} · ${currentMonthLabel}`}</p>
        </div>
        <div className="header-actions">
          {isStudentView ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: '#ecfdf5',
              color: '#047857',
              border: '1px solid #86efac',
              borderRadius: '6px',
              padding: '0.4rem 0.9rem',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}>
              My Account
            </span>
          ) : isLockedToWing ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: user?.wing === 'Female' ? '#fce7f3' : '#dbeafe',
              color: user?.wing === 'Female' ? '#9d174d' : '#1e40af',
              border: `1px solid ${user?.wing === 'Female' ? '#f9a8d4' : '#93c5fd'}`,
              borderRadius: '6px',
              padding: '0.4rem 0.9rem',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}>
              {user?.wing} Wing Only
            </span>
          ) : (
            <select
              className="select-gender"
              value={filters.gender}
              onChange={(e) => setFilters({ ...filters, gender: e.target.value })}
            >
              <option value="All">All</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          )}

          <div className="daily-cost-month-picker">
            <button type="button" className="month-shift-button" onClick={() => moveMonth(-1)} aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <div className="month-picker-core">
              <div className="month-picker-icon">
                <CalendarDays size={16} />
              </div>
              <select
                className="month-picker-select"
                value={filters.month}
                onChange={(e) => setFilters((prev) => ({ ...prev, month: Number(e.target.value) }))}
              >
                {monthNames.map((name, index) => (
                  <option key={name} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <select
                className="month-picker-select year"
                value={filters.year}
                onChange={(e) => setFilters((prev) => ({ ...prev, year: Number(e.target.value) }))}
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
            <button type="button" className="month-shift-button" onClick={() => moveMonth(1)} aria-label="Next month">
              <ChevronRight size={16} />
            </button>
            <button type="button" className="month-current-button" onClick={jumpToCurrentMonth}>
              Current
            </button>
          </div>

          {isRefreshing ? (
            <div className="daily-cost-live-indicator">
              <LoaderCircle size={15} className="spin" />
              <span>Updating</span>
            </div>
          ) : null}

          {report && !isLoading ? (
            <div className="export-actions">
              <button className="btn-export" onClick={excel} title="Export to Excel">
                <FileSpreadsheet size={16} />
              </button>
              <button className="btn-export" onClick={pdf} title="Export to PDF">
                <FileText size={16} />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {error && <div className="student-message student-message-error">{error}</div>}

      {!error && isLoading && !report ? (
        <>
          <section className="daily-cost-loading-panel" style={{ marginBottom: '1.5rem' }}>
            <LoaderCircle size={22} className="spin" />
            <div>
              <strong>Loading daily cost</strong>
              <span>{`Preparing ${currentMonthLabel} for ${selectedWingLabel}.`}</span>
            </div>
          </section>
          <div className="skeleton-cards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[...Array(4)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-block skeleton-card-title" />
                <div className="skeleton-block skeleton-card-body" />
                <div className="skeleton-block skeleton-card-body short" />
              </div>
            ))}
          </div>
          <TableSkeleton rows={10} cols={11} />
        </>
      ) : null}

      {!error && !isLoading && report && report.rows.length === 0 ? (
        <section className="daily-cost-loading-panel is-empty">
          <div>
            <strong>No daily cost data found</strong>
            <span>{`There are no stock-out cost records for ${selectedWingLabel} in ${currentMonthLabel}.`}</span>
          </div>
        </section>
      ) : null}

      {report && (report.rows.length > 0 || !isLoading) && (
        <>
          <section className="daily-cost-cards">
            <div className="daily-cost-card breakfast">
              <span className="card-label">BREAKFAST</span>
              <strong className="card-value">{formatCurrency(getMealDisplayCost(report.breakfast))}</strong>
            </div>
            <div className="daily-cost-card lunch">
              <span className="card-label">LUNCH</span>
              <strong className="card-value">{formatCurrency(getMealDisplayCost(report.lunch))}</strong>
            </div>
            <div className="daily-cost-card dinner">
              <span className="card-label">DINNER</span>
              <strong className="card-value">{formatCurrency(getMealDisplayCost(report.dinner))}</strong>
            </div>
            <div className="daily-cost-card grand-total">
              <span className="card-label">GRAND TOTAL</span>
              <strong className="card-value">{formatCurrency(getMealDisplayCost(report.grandTotal))}</strong>
            </div>
          </section>

          {report.rows.length > 0 && (
            <section className="daily-cost-table-card">
              <table>
                <thead>
                  <tr>
                    <th rowSpan={2}>DATE</th>
                    <th colSpan={3} className="th-breakfast">BREAKFAST</th>
                    <th colSpan={3} className="th-lunch">LUNCH</th>
                    <th colSpan={3} className="th-dinner">DINNER</th>
                    <th rowSpan={2} className="th-total">TOTAL<br /><small style={{ fontWeight: 400, fontSize: '0.75em' }}>{costColumnLabel}</small></th>
                  </tr>
                  <tr>
                    <th className="th-breakfast">Cost</th>
                    <th className="th-breakfast">Students</th>
                    <th className="th-breakfast">{costColumnLabel}</th>
                    <th className="th-lunch">Cost</th>
                    <th className="th-lunch">Students</th>
                    <th className="th-lunch">{costColumnLabel}</th>
                    <th className="th-dinner">Cost</th>
                    <th className="th-dinner">Students</th>
                    <th className="th-dinner">{costColumnLabel}</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => {
                    const { dayName, dateLabel } = parseRowDate(row.date);
                    return (
                      <tr key={row.date}>
                        <td>
                          <div className="table-date-cell">
                            <span className="day-name">{dayName}</span>
                            <span className="date-label">{dateLabel}</span>
                          </div>
                        </td>
                        {renderCostCell(row.breakfast, 'cell-breakfast')}
                        {renderStudentsCell(row.breakfast)}
                        {renderPerHeadCell(row.breakfast, 'cell-breakfast')}
                        {renderCostCell(row.lunch, 'cell-lunch')}
                        {renderStudentsCell(row.lunch)}
                        {renderPerHeadCell(row.lunch, 'cell-lunch')}
                        {renderCostCell(row.dinner, 'cell-dinner')}
                        {renderStudentsCell(row.dinner)}
                        {renderPerHeadCell(row.dinner, 'cell-dinner')}
                        {renderRowTotalPerHeadCell(row)}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="table-total-row">
                    <td style={{ fontWeight: '700', color: '#1e293b' }}>TOTAL</td>
                    <td className="cell-student">-</td>
                    <td className="cell-student">-</td>
                    {renderFooterPerHeadCell(report.breakfast, 'cell-breakfast')}
                    <td className="cell-student">-</td>
                    <td className="cell-student">-</td>
                    {renderFooterPerHeadCell(report.lunch, 'cell-lunch')}
                    <td className="cell-student">-</td>
                    <td className="cell-student">-</td>
                    {renderFooterPerHeadCell(report.dinner, 'cell-dinner')}
                    {renderFooterGrandTotalCell(report.grandTotal)}
                  </tr>
                </tfoot>
              </table>
            </section>
          )}
        </>
      )}
    </div>
  );
}
