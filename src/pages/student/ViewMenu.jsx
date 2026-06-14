import { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { financialService } from '../../services/financialService';
import { formatCurrency, todayLocal } from '../../utils/formatters';

function itemNames(items = []) {
  return items.map((item) => item.name).join(', ') || 'Not configured';
}

function mealCost(meal) {
  return (meal?.commonItems || []).reduce((sum, item) => sum + Number(item.cost || 0), 0);
}

function StudentMealCell({ meal }) {
  const hasItems = Boolean(meal?.commonItems?.length || meal?.optionalItems?.length);
  if (!hasItems) return <span className="meal-empty">Not configured</span>;

  return (
    <div className="meal-menu-cell student-meal-menu-cell">
      <strong>{itemNames(meal.commonItems)}</strong>
      {meal.optionalItems.length > 0 && (
        <span>Options: {meal.optionalItems.map((item) => item.name).join(', ')}</span>
      )}
      <span className="meal-menu-cost">Cost: {formatCurrency(mealCost(meal))}</span>
    </div>
  );
}

export default function ViewMenu() {
  useDocumentTitle('View Menu');
  const [moduleData, setModuleData] = useState(null);
  const [error, setError] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    financialService.getWeeklyMenu()
      .then((data) => {
        setModuleData(data);
        setError('');
      })
      .catch((loadError) => setError(loadError.message));
  }, []);

  const mealTypes = useMemo(() => moduleData?.settings?.mealTypes || [], [moduleData]);
  const menuRows = useMemo(() => (moduleData?.days || []).map((day) => ({
    dayId: day.id,
    dayLabel: day.label,
    mealsByType: Object.fromEntries(day.meals.map((meal) => [meal.mealTypeId, meal])),
  })), [moduleData]);

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
          options.textContent = `Options: ${meal.optionalItems.map((item) => item.name).join(', ')}`;
          options.style.cssText = 'margin-top:5px;color:#6d3bb3;font-size:12px;';
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
      <header className="admin-meal-header">
        <div>
          <h1>Weekly Menu</h1>
          <p>View the complete day-by-day meal routine.</p>
        </div>
      </header>

      {error && <div className="admin-meal-message">{error}</div>}

      <section className="admin-meal-menu-section">
        <div className="admin-meal-section-head">
          <div>
            <h2>Meal Routine</h2>
            <p>Regular items, optional choices, and meal costs for the full week.</p>
          </div>
          <Button variant="secondary" onClick={downloadMealRoutine} disabled={!menuRows.length || isDownloading}>
            <Download size={16} /> {isDownloading ? 'Preparing PDF...' : 'Download PDF'}
          </Button>
        </div>

        {!moduleData && !error ? <div className="weekly-menu-loading">Loading weekly menu...</div> : null}

        {moduleData ? (
          <div className="admin-meal-table-wrap">
            <table className="admin-meal-table">
              <thead>
                <tr>
                  <th>Day</th>
                  {mealTypes.map((mealType) => <th key={mealType.id}>{mealType.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {menuRows.map((row) => (
                  <tr key={row.dayId}>
                    <td><strong>{row.dayLabel}</strong></td>
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
        ) : null}
      </section>
    </div>
  );
}
