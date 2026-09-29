import { useMemo, useState, useCallback, Fragment } from 'react';
import { CalendarDays, Download, FileText, Printer, TrendingUp, TrendingDown, Package, BarChart3, Loader2, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, ChevronDown, ChevronRight, Search, ChevronsUpDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { adminDataService } from '../../services/adminDataService';
import { useToast } from '../../context/ToastContext';
import { TableSkeleton } from '../../components/ui/PageSkeleton';

const formatNumber = (value) => Number(value || 0).toFixed(2);
const formatDisplayDate = (value) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric',
}).format(new Date(`${value}T00:00:00`));

const CATEGORY_COLORS = {
  Common: '#3b82f6',
  Options: '#8b5cf6',
  Others: '#f59e0b',
};
const PIE_COLORS = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#ec4899'];

const todayLocal = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const firstDayOfMonth = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

// ── Summary Card ─────────────────────────────────────────────────────────────
function SummaryCard({ icon: Icon, label, value, subValue, color, className = '' }) {
  return (
    <div className={`report-summary-card ${className}`} style={{ '--card-accent': color }}>
      <div className="report-summary-card__icon">
        <Icon size={22} />
      </div>
      <div className="report-summary-card__content">
        <span className="report-summary-card__label">{label}</span>
        <strong className="report-summary-card__value">{value}</strong>
        {subValue && <span className="report-summary-card__sub">{subValue}</span>}
      </div>
    </div>
  );
}

// ── Custom Chart Tooltip ─────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="report-chart-tooltip">
      <p className="report-chart-tooltip__label">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="report-chart-tooltip__row" style={{ color: entry.color }}>
          <span className="report-chart-tooltip__dot" style={{ background: entry.color }} />
          {entry.name}: <strong>৳{formatNumber(entry.value)}</strong>
        </p>
      ))}
    </div>
  );
}

export default function InventoryReport({ gender }) {
  const toast = useToast();
  const [dateFrom, setDateFrom] = useState(firstDayOfMonth);
  const [dateTo, setDateTo] = useState(todayLocal);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [itemFilter, setItemFilter] = useState('all');
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [dailySearch, setDailySearch] = useState('');
  const [dailyPeriodFilter, setDailyPeriodFilter] = useState('All');

  const toggleDay = (dateStr) => {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) next.delete(dateStr);
      else next.add(dateStr);
      return next;
    });
  };

  const expandAllDays = () => {
    if (!report?.dailyBreakdown) return;
    setExpandedDays(new Set(report.dailyBreakdown.map((d) => d.date)));
  };

  const collapseAllDays = () => {
    setExpandedDays(new Set());
  };

  const fetchReport = useCallback(async () => {
    if (!dateFrom || !dateTo) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminDataService.getInventoryReport({ from: dateFrom, to: dateTo, wing: gender });
      setReport(data);
    } catch (err) {
      setError(err?.message || 'Failed to load report.');
      setReport(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, gender]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const filteredItems = useMemo(() => {
    if (!report?.items) return [];
    if (itemFilter === 'all') return report.items;
    if (itemFilter === 'stored') return report.items.filter(i => i.isStored);
    if (itemFilter === 'non-stored') return report.items.filter(i => !i.isStored);
    return report.items.filter(i => i.category === itemFilter);
  }, [report, itemFilter]);

  const dailyChartData = useMemo(() => {
    if (!report?.dailyBreakdown) return [];
    return report.dailyBreakdown.map(d => ({
      date: formatDisplayDate(d.date),
      rawDate: d.date,
      'Stock In': Number(d.stockInCost || 0),
      'Stock Out': Number(d.stockOutCost || 0),
      'Non-Stock': Number(d.nonStockCost || 0),
    }));
  }, [report]);

  const categoryChartData = useMemo(() => {
    if (!report?.categoryBreakdown) return [];
    return report.categoryBreakdown.map(c => ({
      name: c.category,
      value: Number(c.totalCost || 0),
      items: c.itemCount,
      transactions: c.transactionCount,
    }));
  }, [report]);

  const topItems = useMemo(() => {
    if (!report?.items) return [];
    return [...report.items]
      .sort((a, b) => (b.totalStockInCost + b.totalStockOutCost) - (a.totalStockInCost + a.totalStockOutCost))
      .slice(0, 8)
      .map(item => ({
        name: item.itemName.length > 12 ? item.itemName.substring(0, 12) + '…' : item.itemName,
        fullName: item.itemName,
        'Total Cost': Number(item.totalStockInCost) + Number(item.totalStockOutCost),
        category: item.category,
      }));
  }, [report]);

  // ── Export: PDF ─────────────────────────────────────────────────────────────
  const exportPDF = () => {
    if (!report) return;
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });

    // Page 1: Overview & Executive Summary
    doc.setFontSize(16);
    doc.setTextColor(20, 26, 122);
    doc.text('Inventory Report — Executive Summary', 40, 40);

    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    const wingText = report.wing ? `${report.wing} Wing` : 'All Wings';
    doc.text(`Period: ${dateFrom} to ${dateTo}  |  ${wingText}  |  Generated: ${new Date().toLocaleDateString('en-GB')}`, 40, 56);

    // Summary table
    autoTable(doc, {
      startY: 70,
      head: [['Metric', 'Amount (Tk) / Value']],
      body: [
        ['Total Stock In Cost', `Tk ${formatNumber(report.totalStockInCost)}`],
        ['Total Stock Out Cost', `Tk ${formatNumber(report.totalStockOutCost)}`],
        ['Total Non-Stock Cost', `Tk ${formatNumber(report.totalNonStockCost)}`],
        ['Grand Total Cost', `Tk ${formatNumber(report.grandTotalCost)}`],
        ['Total Transactions', `${report.totalTransactions}`],
        ['Unique Items', `${report.uniqueItemCount}`],
      ],
      theme: 'striped',
      styles: { fontSize: 8.5, cellPadding: 3.5 },
      headStyles: { fillColor: [32, 42, 122], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: 40, right: 40 },
    });

    // Category breakdown on Page 1
    const catStartY = doc.lastAutoTable ? doc.lastAutoTable.finalY + 16 : 220;
    doc.setFontSize(11);
    doc.setTextColor(20, 26, 122);
    doc.text('Cost by Category', 40, catStartY);

    autoTable(doc, {
      startY: catStartY + 6,
      head: [['Category', 'Total Cost (Tk)', 'Items', 'Transactions', '% of Total']],
      body: (report.categoryBreakdown || []).map((c) => [
        c.category,
        formatNumber(c.totalCost),
        c.itemCount,
        c.transactionCount,
        `${report.grandTotalCost > 0 ? ((Number(c.totalCost) / Number(report.grandTotalCost)) * 100).toFixed(1) : '0.0'}%`,
      ]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [32, 42, 122], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: 40, right: 40 },
    });

    // Page 2: Overall Item Summary across Period
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(20, 26, 122);
    doc.text('Item Breakdown (Overall Period)', 40, 40);

    autoTable(doc, {
      startY: 52,
      head: [['Item Name', 'Category', 'Unit', 'Stored', 'Stock In Qty', 'Stock In (Tk)', 'Stock Out Qty', 'Stock Out (Tk)', 'Txns']],
      body: (report.items || []).map((i) => [
        i.itemName,
        i.category,
        i.unit,
        i.isStored ? 'Yes' : 'No',
        formatNumber(i.totalStockIn),
        formatNumber(i.totalStockInCost),
        formatNumber(i.totalStockOut),
        formatNumber(i.totalStockOutCost),
        i.transactionCount,
      ]),
      theme: 'striped',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [32, 42, 122], textColor: [255, 255, 255], fontStyle: 'bold' },
      margin: { left: 40, right: 40 },
    });

    // Page 3+: Daily Detailed Product Breakdown (Every product, in/out, and meal period)
    doc.addPage();
    doc.setFontSize(14);
    doc.setTextColor(20, 26, 122);
    doc.text('Daily Product Breakdown — Movements by Date & Meal Period', 40, 40);

    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('Detailed stock-in, stock-out, and meal period allocation for every product day-by-day', 40, 54);

    let currentY = 68;
    (report.dailyBreakdown || []).forEach((d) => {
      const dayItems = (d.items && d.items.length > 0) ? d.items : [];

      if (currentY > 480) {
        doc.addPage();
        currentY = 40;
      }

      const dayHeader = `${formatDisplayDate(d.date)}  —  Stock In: Tk ${formatNumber(d.stockInCost)}  |  Stock Out: Tk ${formatNumber(d.stockOutCost)}  |  Non-Stock: Tk ${formatNumber(d.nonStockCost)}`;
      doc.setFontSize(10);
      doc.setTextColor(30, 58, 138);
      doc.text(dayHeader, 40, currentY);

      if (dayItems.length === 0) {
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.text('No item movement recorded for this day.', 50, currentY + 12);
        currentY += 24;
      } else {
        autoTable(doc, {
          startY: currentY + 4,
          head: [['Item Name', 'Category', 'Meal Period', 'Unit', 'Stock In Qty', 'Stock In (Tk)', 'Stock Out Qty', 'Stock Out (Tk)']],
          body: dayItems.map((i) => [
            i.itemName,
            i.category,
            i.mealPeriod || 'General',
            i.unit,
            formatNumber(i.stockInQuantity),
            formatNumber(i.stockInCost),
            formatNumber(i.stockOutQuantity),
            formatNumber(i.stockOutCost),
          ]),
          theme: 'striped',
          styles: { fontSize: 7.5, cellPadding: 2.5 },
          headStyles: { fillColor: [40, 60, 110], textColor: [255, 255, 255], fontStyle: 'bold' },
          margin: { left: 40, right: 40 },
        });
        currentY = (doc.lastAutoTable ? doc.lastAutoTable.finalY : currentY + 40) + 16;
      }
    });

    const cleanFrom = String(dateFrom || '').slice(0, 10).replace(/[^a-zA-Z0-9_-]/g, '-');
    const cleanTo = String(dateTo || '').slice(0, 10).replace(/[^a-zA-Z0-9_-]/g, '-');
    const fileName = `inventory-report-${cleanFrom}-to-${cleanTo}.pdf`;

    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      link.remove();
      URL.revokeObjectURL(url);
    }, 1000);
    toast.success('Inventory report exported', fileName);
  };

  // ── Print ───────────────────────────────────────────────────────────────────
  const handlePrint = () => {
    if (!report) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Inventory Report - ${dateFrom} to ${dateTo}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; padding: 24px; color: #1e293b; font-size: 12px; }
        h1 { font-size: 1.5rem; color: #141a7a; margin-bottom: 4px; }
        p.sub { font-size: 0.85rem; color: #64748b; margin-top: 0; margin-bottom: 20px; }
        h2 { font-size: 1.15rem; color: #141a7a; margin-top: 24px; margin-bottom: 8px; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 4px; }
        h3.day-head { font-size: 0.95rem; color: #1e40af; margin-top: 14px; margin-bottom: 6px; background: #f0f4ff; padding: 6px 10px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 11px; }
        th, td { border: 1px solid #cbd5e1; padding: 5px 8px; text-align: left; }
        th { background: #f1f5f9; font-weight: 600; color: #141a7a; }
        tr:nth-child(even) { background: #f8fafc; }
        .text-right { text-align: right; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 10px; font-weight: 600; }
        .badge-breakfast { background: #fff7ed; color: #c2410c; }
        .badge-lunch { background: #f0fdf4; color: #15803d; }
        .badge-dinner { background: #eef2ff; color: #4338ca; }
        .badge-general { background: #f1f5f9; color: #475569; }
      </style>
      </head><body>
      <h1>Inventory Report</h1>
      <p class="sub">Period: ${dateFrom} to ${dateTo} | Wing: ${report.wing || 'All'} | Generated: ${new Date().toLocaleDateString('en-GB')}</p>
      
      <h2>Executive Summary</h2>
      <table>
        <tr><th>Metric</th><th>Amount</th></tr>
        <tr><td>Total Stock In Cost</td><td class="text-right">Tk ${formatNumber(report.totalStockInCost)}</td></tr>
        <tr><td>Total Stock Out Cost</td><td class="text-right">Tk ${formatNumber(report.totalStockOutCost)}</td></tr>
        <tr><td>Total Non-Stock Cost</td><td class="text-right">Tk ${formatNumber(report.totalNonStockCost)}</td></tr>
        <tr><td><strong>Grand Total Cost</strong></td><td class="text-right"><strong>Tk ${formatNumber(report.grandTotalCost)}</strong></td></tr>
        <tr><td>Total Transactions</td><td class="text-right">${report.totalTransactions}</td></tr>
        <tr><td>Unique Items</td><td class="text-right">${report.uniqueItemCount}</td></tr>
      </table>

      <h2>Daily Product Breakdown (By Day & Meal Period)</h2>
      ${(report.dailyBreakdown || []).map((d) => `
        <h3 class="day-head">
          ${formatDisplayDate(d.date)} &nbsp;—&nbsp; 
          <small>Stock In: Tk ${formatNumber(d.stockInCost)} | Stock Out: Tk ${formatNumber(d.stockOutCost)} | Non-Stock: Tk ${formatNumber(d.nonStockCost)}</small>
        </h3>
        <table>
          <thead>
            <tr>
              <th>Product / Item</th>
              <th>Category</th>
              <th>Meal Period</th>
              <th>Unit</th>
              <th class="text-right">Stock In Qty</th>
              <th class="text-right">Stock In (Tk)</th>
              <th class="text-right">Stock Out Qty</th>
              <th class="text-right">Stock Out (Tk)</th>
            </tr>
          </thead>
          <tbody>
            ${(d.items && d.items.length > 0) ? d.items.map((i) => `
              <tr>
                <td><strong>${i.itemName}</strong></td>
                <td>${i.category}</td>
                <td><span class="badge badge-${(i.mealPeriod || 'general').toLowerCase()}">${i.mealPeriod || 'General'}</span></td>
                <td>${i.unit}</td>
                <td class="text-right">${formatNumber(i.stockInQuantity)}</td>
                <td class="text-right">${formatNumber(i.stockInCost)}</td>
                <td class="text-right">${formatNumber(i.stockOutQuantity)}</td>
                <td class="text-right">${formatNumber(i.stockOutCost)}</td>
              </tr>
            `).join('') : '<tr><td colspan="8" style="text-align: center; color: #94a3b8;">No items transacted</td></tr>'}
          </tbody>
        </table>
      `).join('')}
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
    toast.success('Print window opened', `${dateFrom} to ${dateTo}`);
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="report-container">
      {/* ── Date Range Picker ────────────────────────────────────────── */}
      <div className="report-controls">
        <div className="report-date-range">
          <label className="report-date-field">
            <CalendarDays size={16} />
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              onClick={(e) => { if (typeof e.target.showPicker === 'function') { try { e.target.showPicker(); } catch (err) {} } }}
            />
          </label>
          <span className="report-date-separator">→</span>
          <label className="report-date-field">
            <CalendarDays size={16} />
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              onClick={(e) => { if (typeof e.target.showPicker === 'function') { try { e.target.showPicker(); } catch (err) {} } }}
            />
          </label>
          <button
            type="button"
            className="report-generate-btn"
            onClick={fetchReport}
            disabled={loading || !dateFrom || !dateTo}
          >
            {loading ? <><Loader2 size={16} className="spin-icon" /> Generating...</> : <><BarChart3 size={16} /> Generate Report</>}
          </button>
        </div>

        {report && (
          <div className="report-export-btns">
            <button type="button" onClick={exportPDF} className="report-export-btn report-export-pdf" title="Download PDF Report">
              <FileText size={16} /> PDF
            </button>
            <button type="button" onClick={handlePrint} className="report-export-btn report-export-print" title="Print Report">
              <Printer size={16} /> Print
            </button>
          </div>
        )}
      </div>

      {/* ── Error ────────────────────────────────────────────────────── */}
      {error && (
        <div className="report-error">
          <AlertTriangle size={18} /> {error}
        </div>
      )}

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {loading && <TableSkeleton rows={6} cols={5} />}

      {/* ── No report yet ────────────────────────────────────────────── */}
      {!loading && !report && !error && (
        <div className="report-empty">
          <BarChart3 size={48} strokeWidth={1.2} />
          <h3>Select a date range to generate your inventory report</h3>
          <p>Choose start and end dates above, then click <strong>Generate Report</strong> to see full analytics across all inventory items.</p>
        </div>
      )}

      {/* ── Report Content ───────────────────────────────────────────── */}
      {!loading && report && (
        <>
          {/* ── Summary Cards ────────────────────────────────────── */}
          <div className="report-period-badge">
            <CalendarDays size={14} />
            {formatDisplayDate(report.from)} — {formatDisplayDate(report.to)}
            <span className="report-period-wing">{report.wing} Wing</span>
          </div>

          <div className="report-summary-grid">
            <SummaryCard
              icon={ArrowUpRight}
              label="Total Stock In"
              value={`৳${formatNumber(report.totalStockInCost)}`}
              subValue={`${report.items.filter(i => i.isStored).length} stored items`}
              color="#10b981"
            />
            <SummaryCard
              icon={ArrowDownRight}
              label="Total Stock Out"
              value={`৳${formatNumber(report.totalStockOutCost)}`}
              subValue="Stored item consumption"
              color="#3b82f6"
            />
            <SummaryCard
              icon={Package}
              label="Non-Stock Cost"
              value={`৳${formatNumber(report.totalNonStockCost)}`}
              subValue="Daily purchased items"
              color="#f59e0b"
            />
            <SummaryCard
              icon={TrendingUp}
              label="Grand Total"
              value={`৳${formatNumber(report.grandTotalCost)}`}
              subValue={`${report.totalTransactions} transactions · ${report.uniqueItemCount} items`}
              color="#8b5cf6"
            />
          </div>

          {/* ── Charts Row ───────────────────────────────────────── */}
          <div className="report-charts-row">
            {/* Daily Spend Area Chart */}
            <div className="report-chart-card report-chart-card--wide">
              <h3><TrendingUp size={18} /> Daily Spend Trend</h3>
              {dailyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={dailyChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradIn" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradOut" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.02} />
                      </linearGradient>
                      <linearGradient id="gradNon" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => `৳${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="Stock In" stroke="#10b981" fill="url(#gradIn)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Stock Out" stroke="#3b82f6" fill="url(#gradOut)" strokeWidth={2} />
                    <Area type="monotone" dataKey="Non-Stock" stroke="#f59e0b" fill="url(#gradNon)" strokeWidth={2} />
                    <Legend verticalAlign="top" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="report-chart-empty">No daily data for this period</div>
              )}
            </div>

            {/* Category Pie Chart */}
            <div className="report-chart-card">
              <h3><Layers size={18} /> Cost by Category</h3>
              {categoryChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={95}
                      paddingAngle={3}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      labelLine={{ stroke: '#94a3b8', strokeWidth: 1 }}
                    >
                      {categoryChartData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => `৳${formatNumber(value)}`} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="report-chart-empty">No category data</div>
              )}
            </div>
          </div>

          {/* Top Items Bar Chart */}
          {topItems.length > 0 && (
            <div className="report-chart-card report-chart-card--full">
              <h3><BarChart3 size={18} /> Top Items by Cost</h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={topItems} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} tickFormatter={v => `৳${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="Total Cost" fill="#6366f1" radius={[6, 6, 0, 0]} maxBarSize={42}>
                    {topItems.map((entry, i) => (
                      <Cell key={i} fill={CATEGORY_COLORS[entry.category] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ── Items Table ──────────────────────────────────────── */}
          <div className="report-section">
            <div className="report-section-header">
              <h3><Package size={18} /> Item Breakdown</h3>
              <div className="report-item-filters">
                {['all', 'stored', 'non-stored', 'Common', 'Options', 'Others'].map(f => (
                  <button
                    key={f}
                    type="button"
                    className={itemFilter === f ? 'is-active' : ''}
                    onClick={() => setItemFilter(f)}
                  >
                    {f === 'all' ? 'All' : f === 'stored' ? 'Stored' : f === 'non-stored' ? 'Non-Stored' : f}
                  </button>
                ))}
              </div>
            </div>
            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Unit</th>
                    <th className="num">Stock In Qty</th>
                    <th className="num">Stock In Cost</th>
                    <th className="num">Stock Out Qty</th>
                    <th className="num">Stock Out Cost</th>
                    <th className="num">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.length === 0 ? (
                    <tr><td colSpan={9} className="report-table-empty">No items match this filter</td></tr>
                  ) : (
                    filteredItems.map((item, i) => (
                      <tr key={item.itemId}>
                        <td className="row-num">{i + 1}</td>
                        <td className="item-name">{item.itemName}</td>
                        <td>
                          <span className={`report-cat-badge cat-${item.category.toLowerCase()}`}>
                            {item.category}
                          </span>
                        </td>
                        <td className="unit">{item.unit.toUpperCase()}</td>
                        <td className="num in">{formatNumber(item.totalStockIn)}</td>
                        <td className="num in">৳{formatNumber(item.totalStockInCost)}</td>
                        <td className="num out">{formatNumber(item.totalStockOut)}</td>
                        <td className="num out">৳{formatNumber(item.totalStockOutCost)}</td>
                        <td className="num">{item.transactionCount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredItems.length > 0 && (
                  <tfoot>
                    <tr>
                      <td colSpan={4}><strong>Total ({filteredItems.length} items)</strong></td>
                      <td className="num"><strong>{formatNumber(filteredItems.reduce((s, i) => s + Number(i.totalStockIn), 0))}</strong></td>
                      <td className="num"><strong>৳{formatNumber(filteredItems.reduce((s, i) => s + Number(i.totalStockInCost), 0))}</strong></td>
                      <td className="num"><strong>{formatNumber(filteredItems.reduce((s, i) => s + Number(i.totalStockOut), 0))}</strong></td>
                      <td className="num"><strong>৳{formatNumber(filteredItems.reduce((s, i) => s + Number(i.totalStockOutCost), 0))}</strong></td>
                      <td className="num"><strong>{filteredItems.reduce((s, i) => s + i.transactionCount, 0)}</strong></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── Daily Table ──────────────────────────────────────── */}
          <div className="report-section">
            <div className="report-section-header">
              <h3>
                <CalendarDays size={18} /> Daily Product & Movement Breakdown
                <span className="day-items-count-badge">{report.dailyBreakdown.length} days</span>
              </h3>
              <div className="report-daily-header-actions">
                <div className="report-daily-search">
                  <Search size={14} />
                  <input
                    type="text"
                    value={dailySearch}
                    onChange={(e) => setDailySearch(e.target.value)}
                    placeholder="Search product..."
                  />
                </div>
                <div className="report-period-pills">
                  {['All', 'Breakfast', 'Lunch', 'Dinner', 'General'].map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`report-period-pill ${dailyPeriodFilter === p ? 'is-active' : ''}`}
                      onClick={() => setDailyPeriodFilter(p)}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button type="button" className="report-toggle-btn" onClick={expandAllDays} title="Expand all days">
                  <ChevronsUpDown size={14} /> Expand All
                </button>
                <button type="button" className="report-toggle-btn" onClick={collapseAllDays} title="Collapse all days">
                  Collapse All
                </button>
              </div>
            </div>

            <div className="report-table-wrap">
              <table className="report-table">
                <thead>
                  <tr>
                    <th style={{ width: '40px' }}></th>
                    <th>Date</th>
                    <th>Products</th>
                    <th className="num">Stock In</th>
                    <th className="num">Stock Out</th>
                    <th className="num">Non-Stock</th>
                    <th className="num">Day Total</th>
                    <th className="num">Txns</th>
                  </tr>
                </thead>
                <tbody>
                  {report.dailyBreakdown.length === 0 ? (
                    <tr><td colSpan={8} className="report-table-empty">No data for this period</td></tr>
                  ) : (
                    report.dailyBreakdown.map((d) => {
                      const isExpanded = expandedDays.has(d.date);
                      const rawDayItems = d.items || [];
                      const dayItems = rawDayItems.filter((i) => {
                        const matchSearch = !dailySearch || i.itemName.toLowerCase().includes(dailySearch.toLowerCase()) || i.category.toLowerCase().includes(dailySearch.toLowerCase());
                        const matchPeriod = dailyPeriodFilter === 'All' || (i.mealPeriod || 'General').toLowerCase() === dailyPeriodFilter.toLowerCase();
                        return matchSearch && matchPeriod;
                      });

                      return (
                        <Fragment key={d.date}>
                          <tr
                            className={`report-day-row ${isExpanded ? 'is-expanded' : ''}`}
                            onClick={() => toggleDay(d.date)}
                            title="Click to view all products and periods for this day"
                          >
                            <td>
                              <span className="report-day-expand-icon">
                                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              </span>
                            </td>
                            <td className="date-cell">
                              <strong>{formatDisplayDate(d.date)}</strong>
                            </td>
                            <td>
                              <span className="day-items-count-badge">
                                {rawDayItems.length} {rawDayItems.length === 1 ? 'item' : 'items'}
                              </span>
                            </td>
                            <td className="num in">৳{formatNumber(d.stockInCost)}</td>
                            <td className="num out">৳{formatNumber(d.stockOutCost)}</td>
                            <td className="num non-stock">৳{formatNumber(d.nonStockCost)}</td>
                            <td className="num total">
                              <strong>৳{formatNumber(Number(d.stockInCost) + Number(d.stockOutCost) + Number(d.nonStockCost))}</strong>
                            </td>
                            <td className="num">{d.transactionCount}</td>
                          </tr>

                          {isExpanded && (
                            <tr className="report-day-subtable-row">
                              <td colSpan={8}>
                                <div className="report-day-subtable-wrap">
                                  {dayItems.length === 0 ? (
                                    <div style={{ padding: '0.75rem', color: '#64748b', fontSize: '0.82rem' }}>
                                      {rawDayItems.length === 0
                                        ? 'No individual product transactions recorded for this day.'
                                        : 'No products match the selected search or period filter.'}
                                    </div>
                                  ) : (
                                    <table className="report-day-subtable">
                                      <thead>
                                        <tr>
                                          <th>Product / Item</th>
                                          <th>Category</th>
                                          <th>Meal Period</th>
                                          <th>Unit</th>
                                          <th className="num">Stock In Qty</th>
                                          <th className="num">Stock In (৳)</th>
                                          <th className="num">Stock Out Qty</th>
                                          <th className="num">Stock Out (৳)</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {dayItems.map((i, idx) => (
                                          <tr key={`${i.itemId}-${i.mealPeriod}-${idx}`}>
                                            <td>
                                              <strong>{i.itemName}</strong>
                                              {!i.isStored && (
                                                <small style={{ color: '#d97706', marginLeft: '0.4rem', fontWeight: 600 }}>
                                                  (Non-Stock)
                                                </small>
                                              )}
                                            </td>
                                            <td>
                                              <span className={`report-cat-badge cat-${i.category.toLowerCase()}`}>
                                                {i.category}
                                              </span>
                                            </td>
                                            <td>
                                              <span className={`meal-badge meal-badge--${(i.mealPeriod || 'general').toLowerCase()}`}>
                                                {i.mealPeriod || 'General'}
                                              </span>
                                            </td>
                                            <td style={{ color: '#64748b', fontWeight: 600 }}>{i.unit}</td>
                                            <td className="num" style={{ color: Number(i.stockInQuantity) > 0 ? '#059669' : '#94a3b8' }}>
                                              {formatNumber(i.stockInQuantity)}
                                            </td>
                                            <td className="num" style={{ color: Number(i.stockInCost) > 0 ? '#059669' : '#94a3b8', fontWeight: 600 }}>
                                              ৳{formatNumber(i.stockInCost)}
                                            </td>
                                            <td className="num" style={{ color: Number(i.stockOutQuantity) > 0 ? '#dc2626' : '#94a3b8' }}>
                                              {formatNumber(i.stockOutQuantity)}
                                            </td>
                                            <td className="num" style={{ color: Number(i.stockOutCost) > 0 ? '#dc2626' : '#94a3b8', fontWeight: 600 }}>
                                              ৳{formatNumber(i.stockOutCost)}
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
                {report.dailyBreakdown.length > 0 && (
                  <tfoot>
                    <tr>
                      <td></td>
                      <td><strong>Total</strong></td>
                      <td></td>
                      <td className="num"><strong>৳{formatNumber(report.dailyBreakdown.reduce((s, d) => s + Number(d.stockInCost), 0))}</strong></td>
                      <td className="num"><strong>৳{formatNumber(report.dailyBreakdown.reduce((s, d) => s + Number(d.stockOutCost), 0))}</strong></td>
                      <td className="num"><strong>৳{formatNumber(report.dailyBreakdown.reduce((s, d) => s + Number(d.nonStockCost), 0))}</strong></td>
                      <td className="num"><strong>৳{formatNumber(report.grandTotalCost)}</strong></td>
                      <td className="num"><strong>{report.totalTransactions}</strong></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* ── Category Table ───────────────────────────────────── */}
          <div className="report-section">
            <h3><Layers size={18} /> Category Breakdown</h3>
            <div className="report-table-wrap">
              <table className="report-table report-table--compact">
                <thead>
                  <tr>
                    <th>Category</th>
                    <th className="num">Total Cost</th>
                    <th className="num">Items</th>
                    <th className="num">Transactions</th>
                    <th className="num">% of Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.categoryBreakdown.map(c => (
                    <tr key={c.category}>
                      <td>
                        <span className={`report-cat-badge cat-${c.category.toLowerCase()}`}>{c.category}</span>
                      </td>
                      <td className="num">৳{formatNumber(c.totalCost)}</td>
                      <td className="num">{c.itemCount}</td>
                      <td className="num">{c.transactionCount}</td>
                      <td className="num">
                        <div className="report-pct-bar">
                          <div
                            className="report-pct-bar__fill"
                            style={{
                              width: `${report.grandTotalCost > 0 ? (Number(c.totalCost) / Number(report.grandTotalCost) * 100) : 0}%`,
                              background: CATEGORY_COLORS[c.category] || '#6366f1',
                            }}
                          />
                          <span>{report.grandTotalCost > 0 ? (Number(c.totalCost) / Number(report.grandTotalCost) * 100).toFixed(1) : '0.0'}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
