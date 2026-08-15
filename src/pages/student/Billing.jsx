import { useState } from 'react';
import { Receipt } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import MonthYearPicker from '../../components/financial/MonthYearPicker';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import { financialService } from '../../services/financialService';
import { formatCurrency } from '../../utils/formatters';

const now = new Date();

export default function Billing() {
  useDocumentTitle('Billing');
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });

  const billKey      = `billing-me-${period.month}-${period.year}`;
  const subsidiesKey = `billing-subsidies-me-${period.month}-${period.year}`;
  const othersKey    = `billing-others-me-${period.month}-${period.year}`;

  const { data: bill, isLoading: billLoading, isRefreshing: billRefreshing, error: billError } =
    useCachedFetch(billKey, () => financialService.getMyBill(period.month, period.year), { ttl: 2 * 60_000 });

  const { data: subsidies = [], isLoading: subsidiesLoading, isRefreshing: subsidiesRefreshing } =
    useCachedFetch(subsidiesKey, () => financialService.getMyBillSubsidies(period.month, period.year), { ttl: 2 * 60_000 });

  const { data: othersLines = [], isLoading: othersLoading, isRefreshing: othersRefreshing } =
    useCachedFetch(othersKey, () => financialService.getMyOthersBills(period.month, period.year), { ttl: 2 * 60_000 });

  // Whether this student's wing has any optional item assigned at all — Tea is Female-only
  // today, so a male student's item list is naturally empty. Used only to decide whether the
  // Others Bill card belongs on the page; the amounts themselves always come from `bill`.
  const eligibleKey = `additional-eligible-me-${period.month}-${period.year}`;
  const { data: eligibleMonth, isLoading: eligibleLoading, isRefreshing: eligibleRefreshing } =
    useCachedFetch(eligibleKey, () => financialService.getAdditionalMonth(period.month, period.year), { ttl: 2 * 60_000 });

  const isLoading = billLoading || subsidiesLoading || othersLoading || eligibleLoading;
  const isRefreshing = billRefreshing || subsidiesRefreshing || othersRefreshing || eligibleRefreshing;
  const error = billError;
  const othersTotal = othersLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  // Show the card if the student's wing currently has an item assigned, or if it already has
  // history (an item can be deactivated later without erasing what was billed while it was live).
  const hasAdditionalAccess = (eligibleMonth?.items?.length ?? 0) > 0
    || othersLines.length > 0
    || (bill?.othersBill ?? 0) > 0;

  return (
    <div className="financial-page">
      {/* Thin progress bar during background refresh */}
      {isRefreshing && <div className="data-refreshing-bar" />}

      <header style={{ display: 'flex', alignItems: 'center', gap: '0.62rem' }}>
        <Receipt size={28} style={{ color: 'var(--primary, #1e3a8a)', flexShrink: 0 }} />
        <div>
          <h1 style={{ margin: 0 }}>Billing</h1>
          <p style={{ margin: '0.25rem 0 0 0' }}>Select a month to view your calculated hall bill.</p>
        </div>
      </header>

      {error && <div className="student-message student-message-error">{error}</div>}

      <div className="period-picker-row">
        <MonthYearPicker
          month={period.month}
          year={period.year}
          minYear={now.getFullYear() - 3}
          maxYear={now.getFullYear()}
          onChange={setPeriod}
          label="Billing period"
        />
      </div>

      {isLoading && !bill ? (
        /* First-load skeleton */
        <>
          <div className="skeleton-cards">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="skeleton-card">
                <div className="skeleton-block skeleton-card-title" />
                <div className="skeleton-block skeleton-card-body" />
                <div className="skeleton-block skeleton-card-body short" />
              </div>
            ))}
          </div>
          <TableSkeleton rows={4} cols={4} />
        </>
      ) : null}

      {bill && (
        <section className="summary-grid">
          <div className="financial-card">
            <h3>Monthly Bill</h3>
            <strong>{formatCurrency(bill.monthlyBill)}</strong>
            <p>Regular meal charges before subsidy</p>
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
          {/* Shown whenever the student's wing has an optional item — even at zero this month, so
              they can see it's accounted for rather than wondering if the charge is missing.
              Hidden entirely for a wing with nothing assigned (e.g. male, before Tea is opened
              up there), so the card doesn't sit around showing a permanent, meaningless zero. */}
          {hasAdditionalAccess && (
            <div className="financial-card">
              <h3>Others Bill</h3>
              <strong>{formatCurrency(bill.othersBill ?? 0)}</strong>
              <p>
                {othersLines.length
                  ? `${othersLines.map((line) => `${line.itemName} × ${line.consumptionCount}`).join(', ')} — see breakdown below`
                  : 'Tea and other optional items you selected'}
              </p>
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
            <p>Monthly − Subsidy + Guest + Others + Service + Carried</p>
          </div>
          <div className="financial-card">
            <h3>Due Bill</h3>
            <strong>{formatCurrency(bill.dueBill)}</strong>
            <p>{bill.status}</p>
          </div>
        </section>
      )}

      {bill && othersLines.length > 0 && (
        <section className="financial-card" style={{ display: 'grid', gap: '0.85rem' }}>
          <div>
            <h3 style={{ marginBottom: '0.25rem' }}>Others Bill</h3>
            <p style={{ margin: 0, color: 'var(--muted)' }}>
              Each item&apos;s total was shared out across everyone who took it, in proportion to how
              much each person took.
            </p>
          </div>
          <div className="admin-meal-table-wrap">
            <table className="admin-meal-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'right' }}>Monthly Count</th>
                  <th style={{ textAlign: 'right' }}>Unit Rate</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {othersLines.map((line) => (
                  <tr key={line.itemId}>
                    <td style={{ textAlign: 'left' }}>{line.itemName}</td>
                    <td style={{ textAlign: 'right' }}>{line.consumptionCount}</td>
                    <td style={{ textAlign: 'right' }}>{formatCurrency(line.unitRate)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(line.amount)}</td>
                  </tr>
                ))}
                <tr>
                  <td colSpan="3" style={{ textAlign: 'right', fontWeight: 700 }}>Total Others Bill</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>{formatCurrency(othersTotal)}</td>
                </tr>
              </tbody>
            </table>
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
