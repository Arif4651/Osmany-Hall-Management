import { useMemo, useState, useEffect } from 'react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileSpreadsheet, FileText, CalendarDays, ChevronRight, LoaderCircle } from 'lucide-react';
import MonthYearPicker from '../../components/financial/MonthYearPicker';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import TableSkeleton from '../../components/ui/TableSkeleton';
import { adminDataService } from '../../services/adminDataService';
import { formatCurrency } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

const now = new Date();

export default function DailyCost() {
  useDocumentTitle('Daily Cost');
  const { user, role } = useAuth();
  const isStudentView = role === 'student';
  const isLockedToWing = role === 'male_wing_admin' || role === 'female_wing_admin' || role === 'student';
  const costColumnLabel = isStudentView ? 'My Cost' : 'Cost / Meal';
  const totalCostColumnLabel = isStudentView ? 'TOTAL My Cost' : 'TOTAL Cost / Meal';

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
    for (let year = now.getFullYear() - 3; year <= now.getFullYear(); year += 1) {
      years.push(year);
    }
    return years;
  }, []);

  const selectedWingLabel = isStudentView
    ? `${user?.fullName || 'My'}`
    : isLockedToWing ? `${user?.wing} Wing` : filters.gender === 'All' ? 'All Wings' : `${filters.gender} Wing`;

  const getMealDisplayCost = (meal) => isStudentView ? meal.myCost : meal.perHead;
  const getRowDisplayTotal = (row) => isStudentView ? row.totalMyCost : row.totalPerHead;

  const flatRows = () => {
    const fmt = (amount) => `Tk ${Number(amount || 0).toFixed(2)}`;

    const rowsData = (report?.rows || []).map((row) => {
      const formatCost = (meal) => {
        if (!meal.options || meal.options.length === 0) return fmt(meal.cost);
        return meal.options.map(o => `${o.name}: ${fmt(o.cost)}`).join(' | ');
      };
      const formatStudents = (meal) => {
        const total = meal.totalMeals ?? meal.students;
        const g = meal.guestCount || 0;
        return g > 0 ? `${total} (${total - g}+${g}G)` : `${total}`;
      };
      const formatMealCost = (meal) => {
        const displayVal = getMealDisplayCost(meal);
        if (isStudentView && (meal.myGuestCount || 0) > 0) {
          return `${fmt(displayVal)} (Own ${fmt(meal.myOwnCost)} + ${meal.myGuestCount}G ${fmt(meal.myGuestCost)})`;
        }
        return fmt(displayVal);
      };
      const formatRowTotal = (r) => {
        const total = getRowDisplayTotal(r);
        if (isStudentView) {
          const gCount = (r.breakfast?.myGuestCount || 0) + (r.lunch?.myGuestCount || 0) + (r.dinner?.myGuestCount || 0);
          if (gCount > 0) {
            const ownCost = (r.breakfast?.myOwnCost || 0) + (r.lunch?.myOwnCost || 0) + (r.dinner?.myOwnCost || 0);
            const gCost = (r.breakfast?.myGuestCost || 0) + (r.lunch?.myGuestCost || 0) + (r.dinner?.myGuestCost || 0);
            return `${fmt(total)} (Own ${fmt(ownCost)} + ${gCount}G ${fmt(gCost)})`;
          }
        }
        return fmt(total);
      };
      return {
        Date: row.date,
        ...(isStudentView ? {} : { 'Breakfast Cost': formatCost(row.breakfast), 'B. Total Meals': formatStudents(row.breakfast) }),
        [`B. ${costColumnLabel}`]: formatMealCost(row.breakfast),
        ...(isStudentView ? {} : { 'Lunch Cost': formatCost(row.lunch), 'L. Total Meals': formatStudents(row.lunch) }),
        [`L. ${costColumnLabel}`]: formatMealCost(row.lunch),
        ...(isStudentView ? {} : { 'Dinner Cost': formatCost(row.dinner), 'D. Total Meals': formatStudents(row.dinner) }),
        [`D. ${costColumnLabel}`]: formatMealCost(row.dinner),
        [totalCostColumnLabel]: formatRowTotal(row),
      };
    });

    if (report && rowsData.length > 0) {
      const formatFooterMeal = (meal) => {
        const displayVal = getMealDisplayCost(meal);
        if (isStudentView && (meal.myGuestCount || 0) > 0) {
          return `${fmt(displayVal)} (Own ${fmt(meal.myOwnCost)} + ${meal.myGuestCount}G ${fmt(meal.myGuestCost)})`;
        }
        return fmt(displayVal);
      };
      const formatFooterGrand = (grand) => {
        const displayVal = getMealDisplayCost(grand);
        if (isStudentView && (grand.myGuestCount || 0) > 0) {
          return `${fmt(displayVal)} (Own ${fmt(grand.myOwnCost)} + ${grand.myGuestCount}G ${fmt(grand.myGuestCost)})`;
        }
        return fmt(displayVal);
      };
      rowsData.push({
        Date: 'TOTAL',
        ...(isStudentView ? {} : { 'Breakfast Cost': fmt(report.breakfast.cost), 'B. Total Meals': report.breakfast.students }),
        [`B. ${costColumnLabel}`]: formatFooterMeal(report.breakfast),
        ...(isStudentView ? {} : { 'Lunch Cost': fmt(report.lunch.cost), 'L. Total Meals': report.lunch.students }),
        [`L. ${costColumnLabel}`]: formatFooterMeal(report.lunch),
        ...(isStudentView ? {} : { 'Dinner Cost': fmt(report.dinner.cost), 'D. Total Meals': report.dinner.students }),
        [`D. ${costColumnLabel}`]: formatFooterMeal(report.dinner),
        [totalCostColumnLabel]: formatFooterGrand(report.grandTotal),
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
    const total = meal.totalMeals ?? meal.students;
    const guestCount = meal.guestCount || 0;
    const regular = total - guestCount;
    return (
      <td className="cell-student">
        <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{total}</strong>
        {guestCount > 0 ? (
          <small style={{ display: 'block', fontSize: '0.72rem', color: '#059669', fontWeight: 600 }}>
            ({regular} Students + {guestCount} Guests)
          </small>
        ) : (
          <small style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontWeight: 500 }}>
            ({regular} Students)
          </small>
        )}
        {meal.options && meal.options.length > 0 && (
          <div className="daily-cost-option-badge-list">
            {meal.options
              .filter((opt) => opt.name.toLowerCase() !== 'common')
              .map((opt) => {
                const optTotal = opt.totalMeals ?? opt.students;
                const optGuest = opt.guestCount || 0;
                const optStudent = optTotal - optGuest;
                return (
                  <span key={opt.name} className={`daily-cost-option-badge ${getBadgeClass(opt.name)}`}>
                    {opt.name}: <b>{optTotal}</b>
                    {optGuest > 0 && (
                      <small style={{ marginLeft: '0.2rem', opacity: 0.9, fontSize: '0.68rem' }}>
                        ({optStudent}S + {optGuest}G)
                      </small>
                    )}
                  </span>
                );
              })}
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
    const displayCost = getMealDisplayCost(meal);
    const hasGuest = isStudentView && (meal.myGuestCount || 0) > 0;
    return (
      <td className={cellClass}>
        <strong>{formatCurrency(displayCost)}</strong>
        {hasGuest && (
          <small style={{ display: 'block', fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '0.2rem' }}>
            Own {formatCurrency(meal.myOwnCost)} + {meal.myGuestCount} Guest{meal.myGuestCount > 1 ? 's' : ''} {formatCurrency(meal.myGuestCost)}
          </small>
        )}
      </td>
    );
  };

  const renderRowTotalPerHeadCell = (row) => {
    const total = getRowDisplayTotal(row);
    if (isStudentView) {
      const gCount = (row.breakfast?.myGuestCount || 0) + (row.lunch?.myGuestCount || 0) + (row.dinner?.myGuestCount || 0);
      const ownCost = (row.breakfast?.myOwnCost || 0) + (row.lunch?.myOwnCost || 0) + (row.dinner?.myOwnCost || 0);
      const gCost = (row.breakfast?.myGuestCost || 0) + (row.lunch?.myGuestCost || 0) + (row.dinner?.myGuestCost || 0);
      return (
        <td className="cell-total">
          <strong>{formatCurrency(total)}</strong>
          {gCount > 0 && (
            <small style={{ display: 'block', fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '0.2rem' }}>
              Own {formatCurrency(ownCost)} + {gCount} Guest{gCount > 1 ? 's' : ''} {formatCurrency(gCost)}
            </small>
          )}
        </td>
      );
    }
    return (
      <td className="cell-total">
        <strong>{formatCurrency(total)}</strong>
      </td>
    );
  };

  const renderFooterPerHeadCell = (meal, cellClass) => {
    const displayCost = getMealDisplayCost(meal);
    const hasGuest = isStudentView && (meal.myGuestCount || 0) > 0;
    return (
      <td className={cellClass} style={{ fontWeight: '750' }}>
        <strong>{formatCurrency(displayCost)}</strong>
        {hasGuest && (
          <small style={{ display: 'block', fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '0.2rem' }}>
            Own {formatCurrency(meal.myOwnCost)} + {meal.myGuestCount} Guest{meal.myGuestCount > 1 ? 's' : ''} {formatCurrency(meal.myGuestCost)}
          </small>
        )}
      </td>
    );
  };

  const renderFooterGrandTotalCell = (grand) => {
    const displayCost = getMealDisplayCost(grand);
    const hasGuest = isStudentView && (grand.myGuestCount || 0) > 0;
    return (
      <td className="cell-total" style={{ fontWeight: '800' }}>
        <strong>{formatCurrency(displayCost)}</strong>
        {hasGuest && (
          <small style={{ display: 'block', fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '0.2rem' }}>
            Own {formatCurrency(grand.myOwnCost)} + {grand.myGuestCount} Guest{grand.myGuestCount > 1 ? 's' : ''} {formatCurrency(grand.myGuestCost)}
          </small>
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

  // Local calendar date, matching the plain YYYY-MM-DD strings the report rows use — a UTC-based
  // key would drift a day off around midnight for anyone not in that timezone.
  const todayDateKey = useMemo(() => {
    const today = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  }, []);

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

      <div className="daily-cost-header">
        <CalendarDays size={24} style={{ color: 'var(--primary, #1e3a8a)', flexShrink: 0 }} />
        <div className="header-title">
          <h1 style={{ margin: 0 }}>{isStudentView ? 'My Daily Cost' : 'Daily Cost'}</h1>
          <p style={{ margin: '0.15rem 0 0 0' }}>{`${selectedWingLabel} · ${currentMonthLabel}`}</p>
        </div>
        <div className="header-actions">
          {isStudentView ? null : isLockedToWing ? (
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

          <MonthYearPicker
            month={filters.month}
            year={filters.year}
            minYear={availableYears[0]}
            maxYear={availableYears[availableYears.length - 1]}
            onChange={(period) => setFilters((prev) => ({ ...prev, ...period }))}
          />

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
              {isStudentView && (report.breakfast?.myGuestCount || 0) > 0 && (
                <small style={{ display: 'block', fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '0.25rem' }}>
                  Own {formatCurrency(report.breakfast.myOwnCost)} + {report.breakfast.myGuestCount} Guest{report.breakfast.myGuestCount > 1 ? 's' : ''} {formatCurrency(report.breakfast.myGuestCost)}
                </small>
              )}
            </div>
            <div className="daily-cost-card lunch">
              <span className="card-label">LUNCH</span>
              <strong className="card-value">{formatCurrency(getMealDisplayCost(report.lunch))}</strong>
              {isStudentView && (report.lunch?.myGuestCount || 0) > 0 && (
                <small style={{ display: 'block', fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '0.25rem' }}>
                  Own {formatCurrency(report.lunch.myOwnCost)} + {report.lunch.myGuestCount} Guest{report.lunch.myGuestCount > 1 ? 's' : ''} {formatCurrency(report.lunch.myGuestCost)}
                </small>
              )}
            </div>
            <div className="daily-cost-card dinner">
              <span className="card-label">DINNER</span>
              <strong className="card-value">{formatCurrency(getMealDisplayCost(report.dinner))}</strong>
              {isStudentView && (report.dinner?.myGuestCount || 0) > 0 && (
                <small style={{ display: 'block', fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '0.25rem' }}>
                  Own {formatCurrency(report.dinner.myOwnCost)} + {report.dinner.myGuestCount} Guest{report.dinner.myGuestCount > 1 ? 's' : ''} {formatCurrency(report.dinner.myGuestCost)}
                </small>
              )}
            </div>
            <div className="daily-cost-card grand-total">
              <span className="card-label">GRAND TOTAL</span>
              <strong className="card-value">{formatCurrency(getMealDisplayCost(report.grandTotal))}</strong>
              {isStudentView && (report.grandTotal?.myGuestCount || 0) > 0 && (
                <small style={{ display: 'block', fontSize: '0.74rem', color: '#059669', fontWeight: 600, marginTop: '0.25rem' }}>
                  Own {formatCurrency(report.grandTotal.myOwnCost)} + {report.grandTotal.myGuestCount} Guest{report.grandTotal.myGuestCount > 1 ? 's' : ''} {formatCurrency(report.grandTotal.myGuestCost)}
                </small>
              )}
            </div>
          </section>

          {report.rows.length > 0 && (
            <>
              <p className="daily-cost-scroll-hint">
                <ChevronRight size={13} /> Swipe the table sideways to see every column.
              </p>
              <section className={`daily-cost-table-card ${isStudentView ? 'student-daily-cost-table-card' : ''}`}>
              <table>
                <thead>
                  {isStudentView ? (
                    <tr>
                      <th>DATE</th>
                      <th className="th-breakfast">BREAKFAST</th>
                      <th className="th-lunch">LUNCH</th>
                      <th className="th-dinner">DINNER</th>
                      <th className="th-total">TOTAL</th>
                    </tr>
                  ) : (
                    <>
                      <tr>
                        <th rowSpan={2}>DATE</th>
                        <th colSpan={3} className="th-breakfast">BREAKFAST</th>
                        <th colSpan={3} className="th-lunch">LUNCH</th>
                        <th colSpan={3} className="th-dinner">DINNER</th>
                        <th rowSpan={2} className="th-total">TOTAL<br /><small style={{ fontWeight: 400, fontSize: '0.75em' }}>{costColumnLabel}</small></th>
                      </tr>
                      <tr>
                        <th className="th-breakfast">Cost</th>
                        <th className="th-breakfast">Total Meals</th>
                        <th className="th-breakfast">{costColumnLabel}</th>
                        <th className="th-lunch">Cost</th>
                        <th className="th-lunch">Total Meals</th>
                        <th className="th-lunch">{costColumnLabel}</th>
                        <th className="th-dinner">Cost</th>
                        <th className="th-dinner">Total Meals</th>
                        <th className="th-dinner">{costColumnLabel}</th>
                      </tr>
                    </>
                  )}
                </thead>
                <tbody>
                  {report.rows.map((row) => {
                    const { dayName, dateLabel } = parseRowDate(row.date);
                    const isToday = row.date === todayDateKey;
                    return (
                      <tr key={row.date} className={isToday ? 'is-today-row' : undefined}>
                        <td>
                          <div className="table-date-cell">
                            <span className="day-name">
                              {dayName}
                              {isToday && <span className="today-badge">Today</span>}
                            </span>
                            <span className="date-label">{dateLabel}</span>
                          </div>
                        </td>
                        {!isStudentView && renderCostCell(row.breakfast, 'cell-breakfast')}
                        {!isStudentView && renderStudentsCell(row.breakfast)}
                        {renderPerHeadCell(row.breakfast, 'cell-breakfast')}
                        {!isStudentView && renderCostCell(row.lunch, 'cell-lunch')}
                        {!isStudentView && renderStudentsCell(row.lunch)}
                        {renderPerHeadCell(row.lunch, 'cell-lunch')}
                        {!isStudentView && renderCostCell(row.dinner, 'cell-dinner')}
                        {!isStudentView && renderStudentsCell(row.dinner)}
                        {renderPerHeadCell(row.dinner, 'cell-dinner')}
                        {renderRowTotalPerHeadCell(row)}
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="table-total-row">
                    <td style={{ fontWeight: '700', color: '#1e293b' }}>TOTAL</td>
                    {!isStudentView && <td className="cell-student">-</td>}
                    {!isStudentView && <td className="cell-student">-</td>}
                    {renderFooterPerHeadCell(report.breakfast, 'cell-breakfast')}
                    {!isStudentView && <td className="cell-student">-</td>}
                    {!isStudentView && <td className="cell-student">-</td>}
                    {renderFooterPerHeadCell(report.lunch, 'cell-lunch')}
                    {!isStudentView && <td className="cell-student">-</td>}
                    {!isStudentView && <td className="cell-student">-</td>}
                    {renderFooterPerHeadCell(report.dinner, 'cell-dinner')}
                    {renderFooterGrandTotalCell(report.grandTotal)}
                  </tr>
                </tfoot>
              </table>
            </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
