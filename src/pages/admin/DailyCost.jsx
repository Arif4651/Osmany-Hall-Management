import { useEffect, useMemo, useState } from 'react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileSpreadsheet, FileText, CalendarDays, ChevronLeft, ChevronRight, LoaderCircle } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { adminDataService } from '../../services/adminDataService';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

const now = new Date();
const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export default function DailyCost() {
  useDocumentTitle('Daily Cost');
  const { user, role } = useAuth();
  const isLockedToWing = role === 'male_wing_admin' || role === 'female_wing_admin' || role === 'student';

  // Wing admins and students are locked to their wing gender; super_admin/admin default to 'All'
  const [filters, setFilters] = useState({
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    gender: isLockedToWing ? (user?.wing || 'All') : 'All',
  });
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      setIsLoading(true);
      setError('');
      try {
        const nextReport = await adminDataService.getDailyCost(filters.month, filters.year, filters.gender);
        if (!isMounted) return;
        setReport(nextReport);
      } catch (loadError) {
        if (!isMounted) return;
        setReport(null);
        setError(loadError.message);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [filters.month, filters.year, filters.gender]);

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

  const selectedWingLabel = isLockedToWing ? `${user?.wing} Wing` : filters.gender === 'All' ? 'All Wings' : `${filters.gender} Wing`;

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

  const flatRows = () => (report?.rows || []).map((row) => {
    const formatBreakdown = (meal) => {
      if (!meal.options || meal.options.length === 0) return '';
      return ' (' + meal.options.map(o => `${o.name}: ${formatCurrency(o.cost)} [${o.students} std, ${formatCurrency(o.perHead)}/h]`).join(', ') + ')';
    };
    const formatHeaderBreakdown = (meal) => {
      if (!meal.options || meal.options.length === 0) return formatCurrency(meal.perHead);
      return meal.options.map(o => `${o.name}: ${formatCurrency(o.perHead)}`).join(' | ');
    };
    return {
      Date: row.date,
      'Breakfast Cost': `${formatCurrency(row.breakfast.cost)}${formatBreakdown(row.breakfast)}`,
      'B. Students': row.breakfast.students,
      'B. /Head': formatHeaderBreakdown(row.breakfast),
      'Lunch Cost': `${formatCurrency(row.lunch.cost)}${formatBreakdown(row.lunch)}`,
      'L. Students': row.lunch.students,
      'L. /Head': formatHeaderBreakdown(row.lunch),
      'Dinner Cost': `${formatCurrency(row.dinner.cost)}${formatBreakdown(row.dinner)}`,
      'D. Students': row.dinner.students,
      'D. /Head': formatHeaderBreakdown(row.dinner),
      'Total /Head': row.options && row.options.length > 0
        ? row.options.map(o => `${o.name}: ${formatCurrency(o.perHead)}`).join(' | ')
        : formatCurrency(row.totalPerHead),
    };
  });

  const renderCardBreakdown = (meal, hasNoMainValues = false) => {
    if (!meal.options || meal.options.length === 0) return null;
    return (
      <div className={`daily-cost-card-breakdown${hasNoMainValues ? ' no-border' : ''}`}>
        {meal.options.map((opt) => (
          <div key={opt.name} className="daily-cost-card-breakdown-row">
            <span className="opt-name">{opt.name}:</span>
            <span className="opt-val">
              {formatCurrency(opt.cost)} ({formatCurrency(opt.perHead)}/h)
            </span>
          </div>
        ))}
      </div>
    );
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
            {meal.options.map((opt) => (
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
    return (
      <td className={cellClass}>
        <strong style={{ fontSize: '0.95rem' }}>{formatCurrency(meal.cost)}</strong>
        {meal.options && meal.options.length > 0 && (
          <div className="cell-option-breakdown">
            {meal.options.map((opt) => (
              <div key={opt.name} className="cell-option-row">
                <span className="opt-name">{opt.name}:</span>
                <span className="opt-val">{formatCurrency(opt.cost)}</span>
              </div>
            ))}
          </div>
        )}
      </td>
    );
  };

  const renderPerHeadCell = (meal, cellClass) => {
    return (
      <td className={cellClass}>
        {meal.options && meal.options.length > 0 ? (
          <div className="cell-option-breakdown" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            {meal.options.map((opt) => (
              <div key={opt.name} className="cell-option-row">
                <span className="opt-name">{opt.name}:</span>
                <span className="opt-val" style={{ fontWeight: 700 }}>{formatCurrency(opt.perHead)}</span>
              </div>
            ))}
          </div>
        ) : (
          <strong>{formatCurrency(meal.perHead)}</strong>
        )}
      </td>
    );
  };

  const renderRowTotalPerHeadCell = (row) => {
    return (
      <td className="cell-total">
        {row.options && row.options.length > 0 ? (
          <div className="cell-option-breakdown" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            {row.options.map((opt) => (
              <div key={opt.name} className="cell-option-row">
                <span className="opt-name">{opt.name}:</span>
                <span className="opt-val" style={{ fontWeight: 800 }}>{formatCurrency(opt.perHead)}</span>
              </div>
            ))}
          </div>
        ) : (
          <strong>{formatCurrency(row.totalPerHead)}</strong>
        )}
      </td>
    );
  };

  const renderFooterPerHeadCell = (meal, cellClass) => {
    return (
      <td className={cellClass} style={{ fontWeight: '750' }}>
        {meal.options && meal.options.length > 0 ? (
          <div className="cell-option-breakdown" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            {meal.options.map((opt) => (
              <div key={opt.name} className="cell-option-row">
                <span className="opt-name" style={{ color: 'inherit' }}>{opt.name}:</span>
                <span className="opt-val" style={{ fontWeight: 800, color: 'inherit' }}>{formatCurrency(opt.perHead)}</span>
              </div>
            ))}
          </div>
        ) : (
          formatCurrency(meal.perHead)
        )}
      </td>
    );
  };

  const renderFooterGrandTotalCell = (grand) => {
    return (
      <td className="cell-total" style={{ fontWeight: '800' }}>
        {grand.options && grand.options.length > 0 ? (
          <div className="cell-option-breakdown" style={{ borderTop: 'none', marginTop: 0, paddingTop: 0 }}>
            {grand.options.map((opt) => (
              <div key={opt.name} className="cell-option-row">
                <span className="opt-name" style={{ color: 'inherit' }}>{opt.name}:</span>
                <span className="opt-val" style={{ fontWeight: 900, color: 'inherit' }}>{formatCurrency(opt.perHead)}</span>
              </div>
            ))}
          </div>
        ) : (
          formatCurrency(grand.perHead)
        )}
      </td>
    );
  };

  const excel = () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.json_to_sheet(flatRows()), 'Daily Cost');
    writeFile(book, `daily-cost-${filters.year}-${filters.month}.xlsx`);
  };

  const pdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    const data = flatRows();
    autoTable(doc, { head: [Object.keys(data[0] || {})], body: data.map(Object.values) });
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
      <div className="daily-cost-header">
        <div className="header-title">
          <h1>Daily Cost</h1>
          <p>{`Daily cost breakdown for ${selectedWingLabel} · ${currentMonthLabel}`}</p>
        </div>
        <div className="header-actions">
          {isLockedToWing ? (
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

          {isLoading ? (
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

      {!error && isLoading ? (
        <section className="daily-cost-loading-panel">
          <LoaderCircle size={22} className="spin" />
          <div>
            <strong>Loading daily cost</strong>
            <span>{`Preparing ${currentMonthLabel} for ${selectedWingLabel}.`}</span>
          </div>
        </section>
      ) : null}

      {!error && !isLoading && report && report.rows.length === 0 ? (
        <section className="daily-cost-loading-panel is-empty">
          <div>
            <strong>No daily cost data found</strong>
            <span>{`There are no stock-out cost records for ${selectedWingLabel} in ${currentMonthLabel}.`}</span>
          </div>
        </section>
      ) : null}

      {report && !isLoading && report.rows.length > 0 && (
        <>
          <section className="daily-cost-cards">
            <div className="daily-cost-card breakfast">
              <span className="card-label">BREAKFAST</span>
              {(!report.breakfast.options || report.breakfast.options.length === 0) ? (
                <>
                  <strong className="card-value">{formatCurrency(report.breakfast.cost)}</strong>
                  <p className="card-subtext">{formatCurrency(report.breakfast.perHead)} / head</p>
                </>
              ) : (
                renderCardBreakdown(report.breakfast, true)
              )}
            </div>
            <div className="daily-cost-card lunch">
              <span className="card-label">LUNCH</span>
              {(!report.lunch.options || report.lunch.options.length === 0) ? (
                <>
                  <strong className="card-value">{formatCurrency(report.lunch.cost)}</strong>
                  <p className="card-subtext">{formatCurrency(report.lunch.perHead)} / head</p>
                </>
              ) : (
                renderCardBreakdown(report.lunch, true)
              )}
            </div>
            <div className="daily-cost-card dinner">
              <span className="card-label">DINNER</span>
              {(!report.dinner.options || report.dinner.options.length === 0) ? (
                <>
                  <strong className="card-value">{formatCurrency(report.dinner.cost)}</strong>
                  <p className="card-subtext">{formatCurrency(report.dinner.perHead)} / head</p>
                </>
              ) : (
                renderCardBreakdown(report.dinner, true)
              )}
            </div>
            <div className="daily-cost-card grand-total">
              <span className="card-label">GRAND TOTAL</span>
              {(!report.grandTotal.options || report.grandTotal.options.length === 0) ? (
                <>
                  <strong className="card-value">{formatCurrency(report.grandTotal.cost)}</strong>
                  <p className="card-subtext">{formatCurrency(report.grandTotal.perHead)} / head</p>
                </>
              ) : (
                renderCardBreakdown(report.grandTotal, true)
              )}
            </div>
          </section>

          <section className="daily-cost-table-card table-wrap">
            <table>
              <thead>
                <tr>
                  <th rowSpan={2}>DATE</th>
                  <th colSpan={3} className="th-breakfast">BREAKFAST</th>
                  <th colSpan={3} className="th-lunch">LUNCH</th>
                  <th colSpan={3} className="th-dinner">DINNER</th>
                  <th rowSpan={2} className="th-total">TOTAL<br /><small style={{fontWeight:400,fontSize:'0.75em'}}>/Head</small></th>
                </tr>
                <tr>
                  <th className="th-breakfast">Cost</th>
                  <th className="th-breakfast">Students</th>
                  <th className="th-breakfast">/Head</th>
                  <th className="th-lunch">Cost</th>
                  <th className="th-lunch">Students</th>
                  <th className="th-lunch">/Head</th>
                  <th className="th-dinner">Cost</th>
                  <th className="th-dinner">Students</th>
                  <th className="th-dinner">/Head</th>
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
        </>
      )}
    </div>
  );
}
