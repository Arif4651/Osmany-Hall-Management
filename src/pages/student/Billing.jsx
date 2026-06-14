import { useEffect, useState } from 'react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import BillingPeriodPicker from '../../components/financial/BillingPeriodPicker';
import { financialService } from '../../services/financialService';
import { formatCurrency } from '../../utils/formatters';

const now = new Date();

export default function Billing() {
  useDocumentTitle('Billing');
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [bill, setBill] = useState(null);
  const [subsidies, setSubsidies] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    setBill(null);
    setSubsidies([]);
    setError('');
    Promise.all([
      financialService.getMyBill(period.month, period.year),
      financialService.getMyBillSubsidies(period.month, period.year),
    ])
      .then(([billResponse, subsidyRows]) => {
        setBill(billResponse);
        setSubsidies(subsidyRows);
      })
      .catch((loadError) => setError(loadError.message));
  }, [period]);

  return (
    <div className="financial-page">
      <header>
        <h1>Billing</h1>
        <p>Select a month to view your calculated hall bill.</p>
      </header>
      {error && <div className="student-message student-message-error">{error}</div>}
      <BillingPeriodPicker value={period} onChange={setPeriod} />
      {bill && (
        <section className="summary-grid">
          <div className="financial-card">
            <h3>Monthly Bill</h3>
            <strong>{formatCurrency(bill.monthlyBill)}</strong>
            <p>Regular meal charges after subsidy</p>
          </div>
          {(bill.dswSubsidy ?? 0) > 0 && (
            <div className="financial-card financial-card-highlight">
              <h3>DSW Subsidy</h3>
              <strong>- {formatCurrency(bill.dswSubsidy)}</strong>
              <p>Deducted from eligible meal charges</p>
            </div>
          )}
          {(bill.guestMealBill ?? 0) > 0 && (
            <div className="financial-card financial-card-highlight">
              <h3>Guest Meal Bill</h3>
              <strong>{formatCurrency(bill.guestMealBill)}</strong>
              <p>Extra guest meal charges</p>
            </div>
          )}
          <div className="financial-card">
            <h3>Service Bill</h3>
            <strong>{formatCurrency(bill.serviceBill)}</strong>
          </div>
          <div className="financial-card">
            <h3>Carried Due</h3>
            <strong>{formatCurrency(bill.carriedDue)}</strong>
            <p>Outstanding from previous month</p>
          </div>
          <div className="financial-card">
            <h3>Total Bill</h3>
            <strong>{formatCurrency(bill.totalBill)}</strong>
            <p>Monthly + Guest + Service + Carried</p>
          </div>
          <div className="financial-card">
            <h3>Due Bill</h3>
            <strong>{formatCurrency(bill.dueBill)}</strong>
            <p>{bill.status}</p>
          </div>
        </section>
      )}
      {bill && subsidies.length > 0 && (
        <section className="financial-card" style={{ display: 'grid', gap: '0.85rem' }}>
          <div>
            <h3 style={{ marginBottom: '0.25rem' }}>DSW Subsidy Adjustments</h3>
            <p style={{ margin: 0, color: 'var(--muted)' }}>Monthly subsidy deductions applied to your bill.</p>
          </div>
          <div className="table-wrap">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Meal</th>
                  <th>Note</th>
                  <th style={{ textAlign: 'right' }}>Amount Deducted</th>
                </tr>
              </thead>
              <tbody>
                {subsidies.map((item) => (
                  <tr key={`${item.subsidyId}-${item.date}-${item.mealPeriod}`}>
                    <td>{item.date}</td>
                    <td style={{ textTransform: 'capitalize' }}>{item.mealPeriod}</td>
                    <td>{item.notes || 'DSW Subsidy'}</td>
                    <td style={{ textAlign: 'right', color: '#047857', fontWeight: '700' }}>- {formatCurrency(item.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
