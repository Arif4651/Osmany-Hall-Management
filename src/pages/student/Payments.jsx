import { useState, useEffect } from 'react';
import { Send, CreditCard } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { useQueryCache } from '../../context/QueryCacheContext';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
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
  const { invalidate } = useQueryCache();

  const [form, setForm] = useState({
    categoryId: '',
    billingMonth: now.getMonth() + 1,
    billingYear: now.getFullYear(),
    amount: '',
    charges: '',
    transactionId: '',
  });
  
  const [message, setMessage] = useState('');
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Fetch categories with a long TTL (10 minutes)
  const { data: categories = [] } = useCachedFetch(
    'payment-categories',
    () => financialService.getCategories(),
    { ttl: 10 * 60_000 }
  );

  // Fetch payments list with a shorter TTL (30 seconds)
  const {
    data: rows = [],
    isLoading,
    isRefreshing,
    error: loadError,
    refresh
  } = useCachedFetch(
    'my-payments',
    () => financialService.getMyPayments(),
    { ttl: 30_000 }
  );

  // Auto-select the first category when categories load
  useEffect(() => {
    if (categories.length > 0 && !form.categoryId) {
      setForm((prev) => ({ ...prev, categoryId: categories[0].id }));
    }
  }, [categories, form.categoryId]);

  const submit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setMessage('');
    
    try {
      await financialService.submitPayment({
        ...form,
        amount: moneyInput(form.amount),
        charges: moneyInput(form.charges || 0),
      });
      setForm((prev) => ({ ...prev, amount: '', charges: '', transactionId: '' }));
      setMessage('Payment submitted successfully.');
      
      // Invalidate the cache to force a fresh fetch
      invalidate('my-payments');
      refresh();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const error = loadError || submitError;

  return (
    <div className="financial-page">
      {isRefreshing && <div className="data-refreshing-bar" />}
      
      <header style={{ display: 'flex', alignItems: 'center', gap: '0.62rem' }}>
        <CreditCard size={28} style={{ color: 'var(--primary, #1e3a8a)', flexShrink: 0 }} />
        <div>
          <h1 style={{ margin: 0 }}>Payments</h1>
          <p style={{ margin: '0.25rem 0 0 0' }}>Submit a payment for a specific billing month.</p>
        </div>
      </header>

      {message && <div className="student-message student-message-success">{message}</div>}
      {error && <div className="student-message student-message-error">{error}</div>}

      <form className="financial-card payment-form" onSubmit={submit}>
        <label>
          Payment Category
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
          >
            {categories.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label>
          Billing Month
          <select
            value={form.billingMonth}
            onChange={(e) => setForm({ ...form, billingMonth: Number(e.target.value) })}
          >
            {months.map((month) => (
              <option key={month.value} value={month.value}>{month.label}</option>
            ))}
          </select>
        </label>
        <label>
          Billing Year
          <select
            value={form.billingYear}
            onChange={(e) => setForm({ ...form, billingYear: Number(e.target.value) })}
          >
            {years.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        </label>
        <label>
          Amount
          <input
            type="number"
            min="0.01"
            step="0.01"
            required
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
        </label>
        <label>
          Charges
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={form.charges}
            onChange={(e) => setForm({ ...form, charges: e.target.value })}
          />
        </label>
        <label>
          Transaction ID / Account No
          <input
            required
            value={form.transactionId}
            onChange={(e) => setForm({ ...form, transactionId: e.target.value })}
          />
        </label>
        <button className="primary-action payment-submit" type="submit" disabled={submitting}>
          <Send size={17} />
          {submitting ? 'Submitting...' : 'Submit Payment'}
        </button>
      </form>

      <section className="financial-card table-wrap">
        {isLoading && !rows.length ? (
          <TableSkeleton rows={5} cols={8} />
        ) : (
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
        )}
      </section>
    </div>
  );
}
