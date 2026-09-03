import { useMemo, useState, useEffect } from 'react';
import { Download, ClipboardList } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import { financialService } from '../../services/financialService';
import { formatCurrency, todayLocal } from '../../utils/formatters';

function itemNames(items = []) {
  return items.map((item) => item.name).join(', ') || 'Not configured';
}

function mealCost(meal) {
  return (meal?.commonItems || []).reduce((sum, item) => sum + Number(item.cost || 0), 0);
}

const DAY_TABS = [
  { id: 'sun', short: 'Sun' },
  { id: 'mon', short: 'Mon' },
  { id: 'tue', short: 'Tue' },
  { id: 'wed', short: 'Wed' },
  { id: 'thu', short: 'Thu' },
  { id: 'fri', short: 'Fri' },
  { id: 'sat', short: 'Sat' },
];

function StudentMealCell({ meal, isMobile = false }) {
  const hasItems = Boolean(meal?.commonItems?.length || meal?.optionalItems?.length);
  if (!hasItems) return <span className="meal-empty">Not configured</span>;

  return (
    <div className={`meal-menu-cell student-meal-menu-cell ${isMobile ? 'is-mobile-cell' : ''}`}>
      <strong className="student-meal-common-items">{itemNames(meal.commonItems)}</strong>
      {meal.optionalItems.length > 0 && (
        <div className="meal-options-list">
          <span className="meal-options-label">Options:</span>
          {meal.optionalItems.map((item, idx) => (
            <span
              key={item.id || idx}
              className={`student-menu-option-pill ${item.isDefault ? 'is-default' : ''}`}
            >
              <span className="option-name">{item.name}</span>
              {item.isDefault && (
                <span className="option-default-tag">Default</span>
              )}
            </span>
          ))}
        </div>
      )}
      <span className="meal-menu-cost">Cost: {formatCurrency(mealCost(meal))}</span>
    </div>
  );
}

export default function ViewMenu() {
  useDocumentTitle('View Menu');
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  const {
    data: moduleData = null,
    isLoading,
    isRefreshing,
    error: loadError
  } = useCachedFetch(
    'weekly-menu',
    () => financialService.getWeeklyMenu(),
    { ttl: 5 * 60_000 }
  );

  useEffect(() => {
    if (loadError) {
      setError(loadError.message);
    } else {
      setError('');
    }
  }, [loadError]);

  const mealTypes = useMemo(() => moduleData?.settings?.mealTypes || [], [moduleData]);
  const menuRows = useMemo(() => (moduleData?.days || []).map((day) => ({
    dayId: day.id,
    dayLabel: day.label,
    mealsByType: Object.fromEntries(day.meals.map((meal) => [meal.mealTypeId, meal])),
  })), [moduleData]);

  const [selectedDay, setSelectedDay] = useState('all');
  const filteredMenuRows = useMemo(() => {
    if (selectedDay === 'all') return menuRows;
    return menuRows.filter((r) => r.dayId === selectedDay);
  }, [menuRows, selectedDay]);

  const downloadMealRoutine = async () => {
    if (!menuRows.length) return;
    setIsDownloading(true);

    const report = document.createElement('section');
    report.style.cssText = [
      'width:1120px',
      'padding:38px',
      'background:#ffffff',
      'color:#172033',
      'font-family:Arial,"Noto Sans Bengali","Nirmala UI",sans-serif',
      'position:fixed',
      'left:-10000px',
      'top:0',
      'z-index:-1',
      'pointer-events:none',
      'contain:layout paint style',
    ].join(';');

    const title = document.createElement('h1');
    title.textContent = 'Weekly Meal Routine';
    title.style.cssText = 'margin:0;color:#173264;font-size:30px;font-weight:700;';
    report.appendChild(title);

    const subtitle = document.createElement('p');
    subtitle.textContent = `Osmany Hall • Generated ${new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date())}`;
    subtitle.style.cssText = 'margin:7px 0 24px;color:#64748b;font-size:14px;';
    report.appendChild(subtitle);

    const table = document.createElement('table');
    table.style.cssText = 'width:100%;border-collapse:collapse;border:1px solid #cbd5e1;table-layout:fixed;';

    const headerRow = document.createElement('tr');
    ['Day', ...mealTypes.map((meal) => meal.label)].forEach((label, index) => {
      const cell = document.createElement('th');
      cell.textContent = label;
      cell.style.cssText = [
        'border:1px solid #cbd5e1',
        'padding:14px 12px',
        `background:${index === 0 ? '#173264' : '#eaf2ff'}`,
        `color:${index === 0 ? '#ffffff' : '#173264'}`,
        'font-size:15px',
        'font-weight:700',
        'text-align:left',
      ].join(';');
      headerRow.appendChild(cell);
    });
    table.appendChild(headerRow);

    menuRows.forEach((row, rowIndex) => {
      const tableRow = document.createElement('tr');
      const dayCell = document.createElement('td');
      dayCell.textContent = row.dayLabel;
      dayCell.style.cssText = [
        'border:1px solid #cbd5e1',
        'padding:14px 12px',
        `background:${rowIndex % 2 === 0 ? '#f2fbf7' : '#ffffff'}`,
        'color:#08775a',
        'font-size:15px',
        'font-weight:700',
        'vertical-align:top',
      ].join(';');
      tableRow.appendChild(dayCell);

      mealTypes.forEach((mealType) => {
        const meal = row.mealsByType[mealType.id];
        const cell = document.createElement('td');
        cell.style.cssText = [
          'border:1px solid #cbd5e1',
          'padding:12px',
          `background:${rowIndex % 2 === 0 ? '#fbfdff' : '#ffffff'}`,
          'font-size:13px',
          'line-height:1.55',
          'vertical-align:top',
        ].join(';');

        const regular = document.createElement('div');
        regular.textContent = meal?.commonItems?.length ? itemNames(meal.commonItems) : 'Not configured';
        regular.style.cssText = `font-weight:${meal?.commonItems?.length ? '600' : '400'};color:${meal?.commonItems?.length ? '#172033' : '#94a3b8'};`;
        cell.appendChild(regular);

        if (meal?.optionalItems?.length) {
          const options = document.createElement('div');
          options.style.cssText = 'margin-top:6px;font-size:11.5px;line-height:1.4;';

          const label = document.createElement('span');
          label.textContent = 'Options: ';
          label.style.cssText = 'color:#64748b;font-weight:600;';
          options.appendChild(label);

          meal.optionalItems.forEach((item, idx) => {
            if (idx > 0) {
              const sep = document.createElement('span');
              sep.textContent = '  ';
              options.appendChild(sep);
            }
            const itemBadge = document.createElement('span');
            itemBadge.textContent = item.isDefault ? `${item.name} (Default)` : item.name;
            itemBadge.style.cssText = item.isDefault
              ? 'color:#3730a3;background:#e0e7ff;font-weight:600;padding:1px 5px;border-radius:3px;border:1px solid #c7d2fe;'
              : 'color:#475569;background:#f1f5f9;padding:1px 5px;border-radius:3px;border:1px solid #e2e8f0;';
            options.appendChild(itemBadge);
          });
          cell.appendChild(options);
        }

        if (meal?.commonItems?.length || meal?.optionalItems?.length) {
          const cost = document.createElement('div');
          cost.textContent = `Cost: ${formatCurrency(mealCost(meal))}`;
          cost.style.cssText = 'margin-top:5px;color:#08775a;font-size:12px;font-weight:700;';
          cell.appendChild(cost);
        }

        tableRow.appendChild(cell);
      });
      table.appendChild(tableRow);
    });

    report.appendChild(table);

    const footer = document.createElement('p');
    footer.textContent = 'Prepared by Osmany Hall Management System';
    footer.style.cssText = 'margin:18px 0 0;color:#94a3b8;font-size:11px;text-align:right;';
    report.appendChild(footer);

    document.body.appendChild(report);

    try {
      await document.fonts?.ready;
      const canvas = await html2canvas(report, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        windowWidth: 1200,
      });
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth() - (margin * 2);
      const pageHeight = doc.internal.pageSize.getHeight() - (margin * 2);
      const scale = Math.min(pageWidth / canvas.width, pageHeight / canvas.height);
      const imageWidth = canvas.width * scale;
      const imageHeight = canvas.height * scale;
      const x = (doc.internal.pageSize.getWidth() - imageWidth) / 2;
      const y = (doc.internal.pageSize.getHeight() - imageHeight) / 2;

      doc.addImage(canvas.toDataURL('image/png'), 'PNG', x, y, imageWidth, imageHeight, undefined, 'FAST');
      doc.save(`weekly-meal-routine-${todayLocal()}.pdf`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : 'Unable to download the meal routine.');
    } finally {
      report.remove();
      setIsDownloading(false);
    }
  };

  return (
    <div className="admin-meal-page student-view-menu-page">
      {isRefreshing && <div className="data-refreshing-bar" />}
      
      {/* Unified Professional Header */}
      <header className="student-view-menu-header">
        <div className="student-view-menu-header-main">
          <div className="student-view-menu-title-row">
            <ClipboardList size={22} className="student-view-menu-icon" />
            <h1>Weekly Meal Routine</h1>
          </div>
          <p>Regular items, optional choices, and meal costs for the week.</p>
        </div>

        <Button
          variant="secondary"
          size="sm"
          className="student-view-menu-download-btn"
          onClick={downloadMealRoutine}
          disabled={!menuRows.length || isDownloading || isLoading}
        >
          <Download size={14} /> {isDownloading ? 'Exporting...' : 'Download PDF'}
        </Button>
      </header>

      {error && <div className="admin-meal-message">{error}</div>}

      <section className="admin-meal-menu-section student-menu-content-card">

        {isLoading && !moduleData ? (
          <TableSkeleton rows={7} cols={4} />
        ) : (
          moduleData && (
            <>
              {/* Desktop / Tablet Table View */}
              <div className="admin-meal-table-wrap student-menu-desktop-table">
                <table className="admin-meal-table">
                  <thead>
                    <tr>
                      <th className="sticky-day-col">Day</th>
                      {mealTypes.map((mealType) => <th key={mealType.id}>{mealType.label}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {menuRows.map((row) => (
                      <tr key={row.dayId}>
                        <td className="sticky-day-col"><strong>{row.dayLabel}</strong></td>
                        {mealTypes.map((mealType) => (
                          <td key={mealType.id}>
                            <StudentMealCell meal={row.mealsByType[mealType.id]} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile View: Day Filter Pill Tabs & Spacious Day Cards */}
              <div className="student-menu-mobile-tabs">
                <button
                  type="button"
                  className={`student-menu-tab-btn ${selectedDay === 'all' ? 'is-active' : ''}`}
                  onClick={() => setSelectedDay('all')}
                >
                  All Days
                </button>
                {DAY_TABS.map((day) => (
                  <button
                    key={day.id}
                    type="button"
                    className={`student-menu-tab-btn ${selectedDay === day.id ? 'is-active' : ''}`}
                    onClick={() => setSelectedDay(day.id)}
                  >
                    {day.short}
                  </button>
                ))}
              </div>

              <div className="student-menu-mobile-cards">
                {filteredMenuRows.map((row) => (
                  <div key={row.dayId} className="student-menu-day-card">
                    <div className="student-menu-day-header">
                      <strong>{row.dayLabel}</strong>
                    </div>
                    <div className="student-menu-day-meals">
                      {mealTypes.map((mealType) => (
                        <div key={mealType.id} className="student-menu-meal-block">
                          <div className="student-menu-meal-badge">
                            <span>{mealType.label}</span>
                          </div>
                          <StudentMealCell meal={row.mealsByType[mealType.id]} isMobile />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )
        )}
      </section>
    </div>
  );
}
