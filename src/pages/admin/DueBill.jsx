import { useCallback, useState, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { FileSpreadsheet, FileText, Printer } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import BillingPeriodPicker from '../../components/financial/BillingPeriodPicker';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { useQueryCache } from '../../context/QueryCacheContext';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import { adminDataService } from '../../services/adminDataService';
import { formatCurrency, moneyInput } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

const now = new Date();

export default function DueBill() {
  useDocumentTitle('Due Bill');
  const { user } = useAuth();
  const { invalidate } = useQueryCache();
  const [gender, setGender] = useState(() => user?.wing || 'Male');
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [editing, setEditing] = useState(null);
  const [adjustment, setAdjustment] = useState({ amount: '', note: '' });
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState('');

  // Filter States
  const [filterAmount, setFilterAmount] = useState('');
  const [filterCondition, setFilterCondition] = useState('all'); // 'all', 'above', 'below'

  const cacheKey = `due-rows-${period.month}-${period.year}-${gender}`;

  const {
    data: rows = [],
    isLoading,
    isRefreshing,
    error: loadError,
    refresh
  } = useCachedFetch(
    cacheKey,
    () => adminDataService.getDueRows(period.month, period.year, gender),
    { ttl: 30_000 }
  );

  const error = loadError || submitError;

  const load = useCallback(async () => {
    refresh();
  }, [refresh]);

  const saveAdjustment = async () => {
    setSubmitError('');
    setMessage('');
    try {
      await adminDataService.saveDueAdjustment({
        studentId: editing.studentId,
        billingMonth: period.month,
        billingYear: period.year,
        adjustedAmount: moneyInput(adjustment.amount),
        note: adjustment.note,
      });
      setEditing(null);
      setMessage('Due bill override saved.');
      invalidate('due-rows-');
      invalidate('admin-billing-combined');
      await load();
    } catch (saveError) {
      setSubmitError(saveError.message);
    }
  };

  // Client-side filtering logic for instant UX updates
  const filteredRows = useMemo(() => {
    if (filterCondition === 'all') return rows;
    const threshold = parseFloat(filterAmount);
    if (isNaN(threshold)) return rows;

    return rows.filter((row) => {
      if (filterCondition === 'above') {
        return row.dueBill >= threshold;
      }
      if (filterCondition === 'below') {
        return row.dueBill <= threshold;
      }
      return true;
    });
  }, [rows, filterAmount, filterCondition]);

  const flatRows = () => filteredRows.map((row) => ({
    'Student Name': row.studentName,
    'Student ID': row.studentCode,
    'Department': row.department || 'N/A',
    'Mobile Number': row.mobileNumber || 'N/A',
    'Hall ID': row.hallId,
    'Due Bill (TK)': row.dueBill,
    'Overridden': row.isOverridden ? 'Yes' : 'No'
  }));

  const exportExcel = () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.json_to_sheet(flatRows()), 'Due Bill');
    writeFile(book, `due-bill-${period.year}-${period.month}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.text(`Due Bill Report - ${period.month}/${period.year}`, 14, 15);
    const data = flatRows();
    autoTable(doc, {
      startY: 22,
      head: [Object.keys(data[0] || {})],
      body: data.map(Object.values)
    });
    doc.save(`due-bill-${period.year}-${period.month}.pdf`);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const tableHtml = `
      <html>
        <head>
          <title>Due Bill Report - ${period.month}/${period.year}</title>
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
          <h1>Due Bill Report</h1>
          <p>Billing Period: ${period.month}/${period.year}</p>
          <table>
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Student ID</th>
                <th>Department</th>
                <th>Mobile Number</th>
                <th>Hall ID</th>
                <th>Due Bill (TK)</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.map(row => `
                <tr>
                  <td>${row.studentName}</td>
                  <td>${row.studentCode}</td>
                  <td>${row.department || 'N/A'}</td>
                  <td>${row.mobileNumber || 'N/A'}</td>
                  <td>${row.hallId}</td>
                  <td>${formatCurrency(row.dueBill)}</td>
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
    <div className="financial-page">
      {isRefreshing && <div className="data-refreshing-bar" />}
      
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
        <header style={{ margin: 0 }}>
          <h1 style={{ margin: 0 }}>Due Bill</h1>
          <p style={{ margin: '0.25rem 0 0 0' }}>Review monthly dues and apply manual due overrides when required.</p>
        </header>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button 
            variant="secondary" 
            onClick={exportExcel} 
            disabled={filteredRows.length === 0 || isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <FileSpreadsheet size={16} /> Excel
          </Button>
          <Button 
            variant="secondary" 
            onClick={exportPdf} 
            disabled={filteredRows.length === 0 || isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <FileText size={16} /> PDF
          </Button>
          <Button 
            variant="secondary" 
            onClick={handlePrint} 
            disabled={filteredRows.length === 0 || isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Printer size={16} /> Print
          </Button>
        </div>
      </div>

      {message && <div className="student-message student-message-success">{message}</div>}
      {error && <div className="student-message student-message-error">{error}</div>}
      
      <BillingPeriodPicker value={period} onChange={setPeriod} />
      <div className="wing-filter-bar">
        <strong>{gender} Wing Dues</strong>
        {user?.role === 'super_admin' ? (
          <div className="wing-switcher">
            {['Male', 'Female'].map((wing) => (
              <button
                type="button"
                key={wing}
                className={gender === wing ? 'is-active' : ''}
                onClick={() => setGender(wing)}
              >
                {wing} Wing
              </button>
            ))}
          </div>
        ) : <span>Restricted to your assigned wing</span>}
      </div>

      {/* Dues filter panel */}
      <section 
        className="financial-card filter-row" 
        style={{ 
          marginTop: '1rem', 
          marginBottom: '1rem', 
          display: 'flex', 
          gap: '1.25rem', 
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--surface-soft, #f8fafc)',
          padding: '1rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontSize: '0.9rem', fontWeight: '600', color: 'var(--text)' }}>Dues Filter:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            value={filterCondition}
            onChange={(e) => {
              setFilterCondition(e.target.value);
              if (e.target.value === 'all') {
                setFilterAmount('');
              }
            }}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: 'var(--surface)',
              color: 'var(--text)',
              fontSize: '0.9rem',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="all">Show All Dues</option>
            <option value="above">Dues Greater than or Equal to (≥)</option>
            <option value="below">Dues Less than or Equal to (≤)</option>
          </select>

          {filterCondition !== 'all' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input
                type="number"
                min="0"
                placeholder="e.g. 10000"
                value={filterAmount}
                onChange={(e) => setFilterAmount(e.target.value)}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  width: '180px',
                  outline: 'none'
                }}
              />
              <span style={{ color: 'var(--muted)', fontSize: '0.9rem' }}>৳</span>
            </div>
          )}
        </div>

        {(filterCondition !== 'all' || filterAmount) && (
          <button
            type="button"
            onClick={() => {
              setFilterCondition('all');
              setFilterAmount('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--error, #e74c3c)',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: '600',
              padding: '0.5rem 0.25rem',
              transition: 'opacity 0.2s'
            }}
            onMouseOver={(e) => { e.currentTarget.style.opacity = '0.8'; }}
            onMouseOut={(e) => { e.currentTarget.style.opacity = '1'; }}
          >
            Clear Filter
          </button>
        )}

        <div style={{ fontSize: '0.85rem', color: 'var(--muted)', marginLeft: 'auto', fontWeight: '600' }}>
          {filteredRows.length === rows.length 
            ? `Total: ${rows.length} students` 
            : `Showing: ${filteredRows.length} of ${rows.length} students`}
        </div>
      </section>

      <section className="financial-card due-table-card">
        {isLoading && !rows.length ? (
          <TableSkeleton rows={8} cols={7} />
        ) : (
          <div className="table-wrap sticky-page-table due-table-scroll" role="region" aria-label="Due bill table" tabIndex={0}>
            <table className="data-table due-table">
              <colgroup>
                <col className="due-col-name" />
                <col className="due-col-student-id" />
                <col className="due-col-department" />
                <col className="due-col-mobile" />
                <col className="due-col-hall-id" />
                <col className="due-col-amount" />
                <col className="due-col-action" />
              </colgroup>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Student ID</th>
                  <th>Department</th>
                  <th>Mobile Number</th>
                  <th>Hall ID</th>
                  <th className="due-amount-cell">Current Due Bill</th>
                  <th className="due-action-cell">Action</th>
                </tr>
              </thead>
              <tbody>
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem 1.5rem' }}>
                    No students found matching the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.studentId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--primary)' }}>
                      {row.studentName}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.9rem', color: '#334155' }}>
                      {row.studentCode}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)' }}>
                      {row.department || 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)' }}>
                      {row.mobileNumber || 'N/A'}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)', fontSize: '0.9rem' }}>
                      {row.hallId}
                    </td>
                    <td className="due-amount-cell" style={{ padding: '0.75rem', fontWeight: '600' }}>
                      {formatCurrency(row.dueBill)}
                      {row.isOverridden && (
                        <span className="warning-badge" style={{
                          marginLeft: '0.35rem',
                          background: '#fffbeb',
                          color: '#b45309',
                          padding: '0.1rem 0.35rem',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: '600',
                          display: 'inline-block'
                        }}>
                          Override
                        </span>
                      )}
                    </td>
                    <td className="due-action-cell" style={{ padding: '0.75rem' }}>
                      <button
                        onClick={() => {
                          setEditing(row);
                          setAdjustment({ amount: row.dueBill, note: '' });
                        }}
                        style={{
                          padding: '0.35rem 0.65rem',
                          fontSize: '0.8rem',
                          fontWeight: '600',
                          border: '1px solid var(--border)',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          background: 'var(--surface)',
                          color: 'var(--text)',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = 'var(--surface-soft, #f8fafc)';
                          e.currentTarget.style.borderColor = 'var(--primary)';
                          e.currentTarget.style.color = 'var(--primary)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = 'var(--surface)';
                          e.currentTarget.style.borderColor = 'var(--border)';
                          e.currentTarget.style.color = 'var(--text)';
                        }}
                      >
                        Override
                      </button>
                    </td>
                  </tr>
                ))
              )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Modal isOpen={!!editing} onClose={() => setEditing(null)} title={`Override Due: ${editing?.studentName || ''}`}>
        <div className="form-grid">
          <p>Current calculated due: <strong>{formatCurrency(editing?.dueBill || 0)}</strong></p>
          <label className="field-control">
            <span>New Amount</span>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={adjustment.amount}
              onChange={(e) => setAdjustment({ ...adjustment, amount: e.target.value })}
            />
          </label>
          <label className="field-control">
            <span>Note</span>
            <textarea
              value={adjustment.note}
              onChange={(e) => setAdjustment({ ...adjustment, note: e.target.value })}
            />
          </label>
          <Button onClick={saveAdjustment}>Confirm Override</Button>
        </div>
      </Modal>
    </div>
  );
}
