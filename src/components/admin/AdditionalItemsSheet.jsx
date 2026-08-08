import { useCallback, useEffect, useState } from 'react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Coffee, Download, FileSpreadsheet, FileText, Loader2, Printer } from 'lucide-react';
import { adminDataService } from '../../services/adminDataService';
import { useAuth } from '../../context/AuthContext';
import { MENU_KEYS } from '../../services/permissionService';

/** Cycled by position so an extra meal period beyond the usual three still gets a pill color. */
const PERIOD_PALETTE = [
  { bg: '#eef2ff', color: '#3730a3' },
  { bg: '#ecfdf5', color: '#065f46' },
  { bg: '#fffbeb', color: '#92400e' },
  { bg: '#fdf2f8', color: '#9d174d' },
];

/**
 * Chosen to sit clearly apart from every PERIOD_PALETTE hue (blue/green/amber/pink) and from the
 * pink wing badge elsewhere on this page, so an item pill is never mistaken for a period pill.
 */
const ITEM_PALETTE = [
  { bg: '#f3e8ff', color: '#7e22ce' }, // purple — Tea lands here today
  { bg: '#e0f2fe', color: '#0369a1' }, // sky
  { bg: '#f1f5f9', color: '#334155' }, // slate
  { bg: '#ffe4e6', color: '#be123c' }, // rose
];

/**
 * Same item, same color everywhere it appears — the summary pill and every chip in the table
 * body below it. Hashing the name (rather than position of first appearance) keeps that mapping
 * stable across dates even as which items show up on a given day changes.
 */
function colorForItem(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return ITEM_PALETTE[hash % ITEM_PALETTE.length];
}

/**
 * Who took an optional item (tea and similar) on the Meal Sheet's selected date — a roster in the
 * same spirit as the meal sheet above it, not a monthly report. Only students with at least one
 * mark that day appear, one column per meal slot.
 *
 * Hidden entirely for a role without admin.additional-items — currently that's the male wing
 * admin by default, until a super admin turns it on from Role Permissions. Same rule the Meal
 * Management and Bill Management pages already follow for this feature.
 */
export default function AdditionalItemsSheet({ date, wing }) {
  const { can } = useAuth();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const hasAccess = can(MENU_KEYS.adminAdditionalItems, 'view');

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      setData(await adminDataService.getAdditionalSheet({ date, wing: wing === 'All' ? undefined : wing }));
      setError('');
    } catch (loadError) {
      setError(loadError.message);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [date, wing]);

  useEffect(() => {
    if (hasAccess) load();
  }, [hasAccess, load]);

  if (!hasAccess) return null;

  const rows = data?.rows ?? [];
  const mealPeriods = data?.mealPeriods ?? [];

  // Two different totals, both "combining" something different: per-period sums every item
  // marked in that slot, regardless of which one; per-item sums one item across all three slots.
  // Plain computation rather than useMemo — a single day's roster is small enough not to need it,
  // and it would sit after the early return above anyway, which Hooks can't do.
  const periodTotals = mealPeriods.map((meal) => ({
    ...meal,
    count: rows.reduce(
      (sum, row) => sum + row.marks.filter((mark) => mark.mealPeriod === meal.code).length,
      0,
    ),
  }));

  const itemCounts = new Map();
  for (const row of rows) {
    for (const mark of row.marks) {
      itemCounts.set(mark.itemName, (itemCounts.get(mark.itemName) ?? 0) + 1);
    }
  }
  const itemTotals = [...itemCounts.entries()].map(([name, count]) => ({ name, count }));

  const grandTotal = data?.totalMarks ?? 0;

  // Every meal-period cell, flattened to one readable string — shared by all four export/print
  // paths below so the sheet, the file, and the printout never disagree on formatting.
  const cellFor = (row, meal) => {
    const itemNames = row.marks.filter((mark) => mark.mealPeriod === meal.code).map((mark) => mark.itemName);
    return itemNames.length ? itemNames.join(', ') : '—';
  };

  const flatRows = () => rows.map((row) => {
    const entry = { Student: row.name, Roll: row.studentCode, Room: row.room };
    for (const meal of mealPeriods) entry[meal.label] = cellFor(row, meal);
    return entry;
  });

  // These operate on this component's own `rows`/`mealPeriods` — the roster for whichever date
  // is selected — never on the regular Meal Sheet's data, so switching views also switches what
  // Excel/CSV/PDF/Print actually produce.
  const exportExcel = () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.json_to_sheet(flatRows()), 'Additional Items');
    writeFile(book, `additional-items-${date}.xlsx`);
  };

  const exportCsv = () => {
    const headers = ['Student', 'Roll', 'Room', ...mealPeriods.map((meal) => meal.label)];
    const rowsList = rows.map((row) => [
      row.name, row.studentCode, row.room,
      ...mealPeriods.map((meal) => cellFor(row, meal)),
    ]);
    const csvContent = [headers, ...rowsList]
      .map((line) => line.map((val) => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `additional-items-${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPdf = () => {
    const doc = new jsPDF();

    doc.setFontSize(16);
    doc.setTextColor(20, 26, 122);
    doc.text('Additional Items Report', 14, 15);

    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${date}  |  Students: ${rows.length}  |  Total marks: ${grandTotal}`, 14, 21);

    autoTable(doc, {
      startY: 26,
      head: [['Student', 'Roll', 'Room', ...mealPeriods.map((meal) => meal.label)]],
      body: rows.map((row) => [
        row.name, row.studentCode, row.room,
        ...mealPeriods.map((meal) => cellFor(row, meal)),
      ]),
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 4, valign: 'middle', overflow: 'linebreak' },
      headStyles: { fillColor: [32, 42, 122], textColor: [255, 255, 255], fontStyle: 'bold' },
    });

    doc.save(`additional-items-${date}.pdf`);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const tableHtml = `
      <html>
        <head>
          <title>Additional Items - ${date}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 1.5rem; margin-bottom: 5px; }
            p { font-size: 0.9rem; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9rem; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
          </style>
        </head>
        <body>
          <h1>Additional Items Report</h1>
          <p>Date: ${date} | Students: ${rows.length} | Total marks: ${grandTotal}</p>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll</th>
                <th>Room</th>
                ${mealPeriods.map((meal) => `<th>${meal.label}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${rows.map((row) => `
                <tr>
                  <td>${row.name}</td>
                  <td>${row.studentCode}</td>
                  <td>${row.room}</td>
                  ${mealPeriods.map((meal) => `<td>${cellFor(row, meal)}</td>`).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(tableHtml);
    printWindow.document.close();
  };

  return (
    <section className="financial-card additional-sheet">
      <div className="admin-meal-section-head">
        <div>
          <h2 style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem' }}>
            <Coffee size={18} /> Additional Items
          </h2>
          <p>Who marked tea and other optional items for this date.</p>
        </div>

        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportExcel}
            disabled={rows.length === 0}
            style={{ padding: '0.5rem 0.75rem' }}
            title="Export to Excel"
          >
            <FileSpreadsheet size={16} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportCsv}
            disabled={rows.length === 0}
            style={{ padding: '0.5rem 0.75rem' }}
            title="Export to CSV"
          >
            <Download size={16} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={exportPdf}
            disabled={rows.length === 0}
            style={{ padding: '0.5rem 0.75rem' }}
            title="Export as PDF"
          >
            <FileText size={16} />
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handlePrint}
            disabled={rows.length === 0}
            style={{ padding: '0.5rem 0.75rem' }}
            title="Print"
          >
            <Printer size={16} />
          </button>
        </div>
      </div>

      {!isLoading && !error && mealPeriods.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'center', margin: '0.9rem 0 1.1rem' }}>
          {/* Total marked in each slot, any item combined — same B/L/D pill style as the meal
              sheet above, so the two rosters read as one consistent page. */}
          {periodTotals.map((meal, index) => {
            const palette = PERIOD_PALETTE[index % PERIOD_PALETTE.length];
            return (
              <span
                key={meal.code}
                style={{
                  background: palette.bg, color: palette.color,
                  padding: '0.35rem 0.75rem', borderRadius: '20px',
                  fontSize: '0.85rem', fontWeight: 'bold',
                }}
              >
                {meal.label} <span style={{ color: 'var(--text)', marginLeft: '0.2rem' }}>{meal.count}</span>
              </span>
            );
          })}

          {/* One item, combined across all three slots — "total tea" regardless of which meal it
              was taken at. Colored via colorForItem so this pill and every "Tea" chip in the
              table below share the same color, and a second item gets its own distinct one. */}
          {itemTotals.map((item) => {
            const palette = colorForItem(item.name);
            return (
              <span
                key={item.name}
                style={{
                  background: palette.bg, color: palette.color,
                  padding: '0.35rem 0.75rem', borderRadius: '20px',
                  fontSize: '0.85rem', fontWeight: 'bold',
                }}
              >
                Total {item.name} <span style={{ color: 'var(--text)', marginLeft: '0.2rem' }}>{item.count}</span>
              </span>
            );
          })}

          {/* Once a second item exists, the per-item pills above no longer sum to an obvious
              total, so spell it out — redundant with a single item, so it's skipped then. */}
          {itemTotals.length > 1 ? (
            <span style={{
              background: '#f3f4f6', color: '#374151',
              padding: '0.35rem 0.75rem', borderRadius: '20px',
              fontSize: '0.85rem', fontWeight: 'bold',
            }}
            >
              All items <span style={{ color: 'var(--text)', marginLeft: '0.2rem' }}>{grandTotal}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {error ? <div className="student-message student-message-error">{error}</div> : null}

      {isLoading ? (
        <p className="additional-sheet-empty"><Loader2 size={15} className="spin" /> Loading…</p>
      ) : null}

      {!isLoading && !error && rows.length === 0 ? (
        <p className="additional-sheet-empty">No additional items were marked for this date.</p>
      ) : null}

      {!isLoading && rows.length > 0 ? (
        <div className="admin-meal-table-wrap">
          <table className="admin-meal-table">
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Student</th>
                <th style={{ textAlign: 'left' }}>Roll</th>
                <th style={{ textAlign: 'left' }}>Room</th>
                {mealPeriods.map((meal) => (
                  <th key={meal.code} style={{ textAlign: 'left' }}>{meal.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.studentId}>
                  <td style={{ textAlign: 'left' }}><strong>{row.name}</strong></td>
                  <td style={{ textAlign: 'left' }}>{row.studentCode}</td>
                  <td style={{ textAlign: 'left' }}>{row.room}</td>
                  {mealPeriods.map((meal) => {
                    const itemNames = row.marks
                      .filter((mark) => mark.mealPeriod === meal.code)
                      .map((mark) => mark.itemName);
                    return (
                      <td key={meal.code} style={{ textAlign: 'left' }}>
                        {itemNames.length ? (
                          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
                            {itemNames.map((name, index) => {
                              const palette = colorForItem(name);
                              return (
                                <span
                                  key={`${name}-${index}`}
                                  style={{
                                    display: 'inline-block',
                                    padding: '0.15rem 0.6rem',
                                    borderRadius: '999px',
                                    fontSize: '0.8rem',
                                    fontWeight: 600,
                                    background: palette.bg,
                                    color: palette.color,
                                  }}
                                >
                                  {name}
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
