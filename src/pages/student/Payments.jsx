import { useCallback, useEffect, useState } from 'react';
import { Send } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { financialService } from '../../services/financialService';
import { formatCurrency, formatDate, moneyInput } from '../../utils/formatters';

const now = new Date();
const months = Array.from({ length: 12 }, (_, index) => ({
  value: index + 1,
  label: new Intl.DateTimeFormat('en', { month: 'long' }).format(new Date(2000, index, 1)),
}));
const years = Array.from({ length: 5 }, (_, index) => now.getFullYear() - 2 + index);

export default function Payments() {
  useDocumentTitle('Payments');
  const [categories, setCategories] = useState([]);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({
    categoryId: '',
    billingMonth: now.getMonth() + 1,
    billingYear: now.getFullYear(),
    amount: '',
    charges: '',
    transactionId: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const [nextCategories, payments] = await Promise.all([financialService.getCategories(), financialService.getMyPayments()]);
      setCategories(nextCategories); setRows(payments);
      setForm((prev) => ({ ...prev, categoryId: prev.categoryId || nextCategories[0]?.id || '' }));
    } catch (loadError) { setError(loadError.message); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const submit = async (event) => {
    event.preventDefault();
    try {
      await financialService.submitPayment({
        ...form,
        amount: moneyInput(form.amount),
        charges: moneyInput(form.charges || 0),
      });
      setForm((prev) => ({ ...prev, amount: '', charges: '', transactionId: '' }));
      setMessage('Payment submitted successfully.'); setError(''); await load();
    } catch (submitError) { setError(submitError.message); }
  };
  return (
    <div className="financial-page">
      <header><h1>Payments</h1><p>Submit a payment for a specific billing month.</p></header>
      {message && <div className="student-message student-message-success">{message}</div>}
      {error && <div className="student-message student-message-error">{error}</div>}
      <form className="financial-card payment-form" onSubmit={submit}>
        <label>Payment Category<select required value={form.categoryId} onChange={(e) => setForm({ ...form, categoryId: e.target.value })}>{categories.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
        <label>Billing Month<select value={form.billingMonth} onChange={(e) => setForm({ ...form, billingMonth: Number(e.target.value) })}>{months.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}</select></label>
        <label>Billing Year<select value={form.billingYear} onChange={(e) => setForm({ ...form, billingYear: Number(e.target.value) })}>{years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
        <label>Amount<input type="number" min="0.01" step="0.01" required value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></label>
        <label>Charges<input type="number" min="0" step="0.01" required value={form.charges} onChange={(e) => setForm({ ...form, charges: e.target.value })} /></label>
        <label>Transaction ID / Account No<input required value={form.transactionId} onChange={(e) => setForm({ ...form, transactionId: e.target.value })} /></label>
        <button className="primary-action payment-submit" type="submit"><Send size={17} />Submit Payment</button>
      </form>
      <section className="financial-card table-wrap">
        <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Billing Period</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Submitted At</th>
              <th style={{ textAlign: 'right', padding: '0.75rem' }}>Amount</th>
              <th style={{ textAlign: 'right', padding: '0.75rem' }}>Charges</th>
              <th style={{ textAlign: 'right', padding: '0.75rem' }}>Approved Amount</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Category</th>
              <th style={{ textAlign: 'left', padding: '0.75rem' }}>Transaction ID</th>
              <th style={{ textAlign: 'center', padding: '0.75rem' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                  No payment records found.
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const statusNorm = String(row.status || '').toLowerCase().replace('_', ' ');
                let badgeBg = '#f1f5f9';
                let badgeColor = '#64748b';
                if (statusNorm === 'approved') {
                  badgeBg = '#ecfdf5';
                  badgeColor = '#047857';
                } else if (statusNorm === 'pending' || statusNorm === 'under review') {
                  badgeBg = '#fffbeb';
                  badgeColor = '#b45309';
                } else if (statusNorm === 'rejected') {
                  badgeBg = '#fef2f2';
                  badgeColor = '#b91c1c';
                }
                
                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '500' }}>
                      {months[row.billingMonth - 1]?.label} {row.billingYear}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)' }}>
                      {formatDate(row.submittedAtUtc)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>
                      {formatCurrency(row.submittedAmount)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--muted)' }}>
                      {formatCurrency(row.submittedCharge)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: row.approvedAmount ? 'var(--success)' : 'inherit' }}>
                      {row.approvedAmount == null ? '—' : formatCurrency(row.approvedAmount)}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                      {row.category}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.9rem', color: '#334155' }}>
                      {row.transactionId}
                    </td>
                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                      <span style={{
                        background: badgeBg,
                        color: badgeColor,
                        padding: '0.25rem 0.6rem',
                        borderRadius: '20px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                        display: 'inline-block',
                        textAlign: 'center',
                        minWidth: '85px'
                      }}>
                        {statusNorm}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
