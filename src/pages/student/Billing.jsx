import { useState } from 'react';
import { Receipt, Users } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Modal from '../../components/ui/Modal';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import MonthYearPicker from '../../components/financial/MonthYearPicker';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import { financialService } from '../../services/financialService';
import { formatCurrency, formatBalance, isCredit } from '../../utils/formatters';

const now = new Date();

export default function Billing() {
  useDocumentTitle('Billing');
  const [period, setPeriod] = useState({ month: now.getMonth() + 1, year: now.getFullYear() });
  const [guestModalOpen, setGuestModalOpen] = useState(false);

  const billKey        = `billing-me-${period.month}-${period.year}`;
  const subsidiesKey   = `billing-subsidies-me-${period.month}-${period.year}`;
  const othersKey      = `billing-others-me-${period.month}-${period.year}`;
  const guestMealKey   = `billing-guest-meals-me-${period.month}-${period.year}`;

  const { data: bill, isLoading: billLoading, isRefreshing: billRefreshing, error: billError } =
    useCachedFetch(billKey, () => financialService.getMyBill(period.month, period.year), { ttl: 2 * 60_000 });

  const { data: subsidies = [], isLoading: subsidiesLoading, isRefreshing: subsidiesRefreshing } =
    useCachedFetch(subsidiesKey, () => financialService.getMyBillSubsidies(period.month, period.year), { ttl: 2 * 60_000 });

  const { data: othersLines = [], isLoading: othersLoading, isRefreshing: othersRefreshing } =
    useCachedFetch(othersKey, () => financialService.getMyOthersBills(period.month, period.year), { ttl: 2 * 60_000 });

  const { data: guestBreakdown, isLoading: guestLoading, isRefreshing: guestRefreshing } =
    useCachedFetch(guestMealKey, () => financialService.getMyGuestMealBreakdown(period.month, period.year), { ttl: 2 * 60_000 });

  // Whether this student's wing has any optional item assigned at all — Tea is Female-only
  // today, so a male student's item list is naturally empty. Used only to decide whether the
  // Others Bill card belongs on the page; the amounts themselves always come from `bill`.
  const eligibleKey = `additional-eligible-me-${period.month}-${period.year}`;
  const { data: eligibleMonth, isLoading: eligibleLoading, isRefreshing: eligibleRefreshing } =
    useCachedFetch(eligibleKey, () => financialService.getAdditionalMonth(period.month, period.year), { ttl: 2 * 60_000 });

  const isLoading = billLoading || subsidiesLoading || othersLoading || eligibleLoading;
  const isRefreshing = billRefreshing || subsidiesRefreshing || othersRefreshing || eligibleRefreshing || guestRefreshing;
  const error = billError;
  const othersTotal = othersLines.reduce((sum, line) => sum + Number(line.amount || 0), 0);
  // Show the card if the student's wing currently has an item assigned, or if it already has
  // history (an item can be deactivated later without erasing what was billed while it was live).
  const hasAdditionalAccess = (eligibleMonth?.items?.length ?? 0) > 0
    || othersLines.length > 0
    || (bill?.othersBill ?? 0) > 0;

  const monthLabel = new Date(period.year, period.month - 1).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="financial-page">
      {/* Thin progress bar during background refresh */}
      {isRefreshing && <div className="data-refreshing-bar" />}

      <header style={{ display: 'flex', alignItems: 'center', gap: '0.55rem' }}>
        <Receipt size={24} style={{ color: 'var(--primary, #1e3a8a)', flexShrink: 0 }} />
        <div>
          <h1 style={{ margin: 0 }}>Billing</h1>
          <p style={{ margin: '0.15rem 0 0 0' }}>Calculated hall bill and subsidies by month</p>
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
            {/* <p>Regular meal charges before subsidy</p> */}
          </div>
          {(bill.dswSubsidy ?? 0) > 0 && (
            <div className="financial-card financial-card-highlight">
              <h3>DSW Subsidy</h3>
              <strong>- {formatCurrency(bill.dswSubsidy)}</strong>
              {/* <p>Deducted from eligible meal charges</p> */}
            </div>
          )}
          <div
            className="financial-card financial-card-highlight financial-card-clickable"
            onClick={() => setGuestModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && setGuestModalOpen(true)}
            title="Click to view all guest meals for this month"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Guest Meal Bill</h3>
              <span className="badge-clickable-hint">View Details →</span>
            </div>
            <strong>{formatCurrency(bill.guestMealBill ?? 0)}</strong>
            <p>
              {guestBreakdown?.totalGuestCount
                ? `${guestBreakdown.totalGuestCount} guest meal${guestBreakdown.totalGuestCount > 1 ? 's' : ''} opened`
                : 'Click to view monthly guest meals'}
            </p>
          </div>
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
          <div className={`financial-card${isCredit(bill.carriedDue) ? ' financial-card-credit' : ''}`}>
            <h3>Carried {isCredit(bill.carriedDue) ? 'Credit' : 'Due'}</h3>
            <strong>{formatBalance(bill.carriedDue)}</strong>
            <p>
              {isCredit(bill.carriedDue)
                ? 'Overpayment brought forward from last month'
                : 'Outstanding from previous month'}
            </p>
          </div>
          {/* Adjustment card hidden from students by request — the manual correction still flows
              into Total Bill / Due Bill, it just isn't broken out as its own line here.
          {(bill.adjustment ?? 0) !== 0 && (
            <div className="financial-card financial-card-highlight">
              <h3>Adjustment</h3>
              <strong>{bill.adjustment > 0 ? '+ ' : '- '}{formatCurrency(Math.abs(bill.adjustment))}</strong>
            </div>
          )} */}
          
          <div className="financial-card">
            <h3>Total Bill</h3>
            <strong>{formatCurrency(bill.totalBill)}</strong>
            {/* <p>
              Monthly − Subsidy + Guest + Others + Service + Carried
              {(bill.adjustment ?? 0) !== 0 ? ' + Adjustment' : ''}
            </p> */}
          </div>
          {(bill.totalPaid ?? 0) > 0 && (
            <div className="financial-card financial-card-highlight">
              <h3>Paid</h3>
              <strong>- {formatCurrency(bill.totalPaid)}</strong>
              <p>Approved payments for this month</p>
            </div>
          )}
          <div className={`financial-card${isCredit(bill.dueBill) ? ' financial-card-credit' : ''}`}>
            <h3>{isCredit(bill.dueBill) ? 'Credit Balance' : 'Due Bill'}</h3>
            <strong>{formatBalance(bill.dueBill)}</strong>
            <p>
              {isCredit(bill.dueBill)
                ? 'You paid more than this month needed — it goes towards next month'
                : 'Amount you need to pay more'}
            </p>
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
          <div className="admin-meal-table-wrap responsive-table">
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

          {/* Mobile: one card per item, plus a total card so nothing needs the table's footer row. */}
          <div className="responsive-card-list">
            {othersLines.map((line) => (
              <div className="responsive-card" key={line.itemId}>
                <div className="responsive-card-head">
                  <strong>{line.itemName}</strong>
                  <b>{formatCurrency(line.amount)}</b>
                </div>
                <div className="responsive-card-body">
                  <div><span>Monthly Count</span><b>{line.consumptionCount}</b></div>
                  <div><span>Unit Rate</span><b>{formatCurrency(line.unitRate)}</b></div>
                </div>
              </div>
            ))}
            <div className="responsive-card">
              <div className="responsive-card-head">
                <strong>Total Others Bill</strong>
                <b>{formatCurrency(othersTotal)}</b>
              </div>
            </div>
          </div>
        </section>
      )}

      {bill && subsidies.length > 0 && (
        <section className="financial-card" style={{ display: 'grid', gap: '0.85rem' }}>
          <div>
            <h3 style={{ marginBottom: '0.25rem' }}>DSW Subsidy Adjustments</h3>
            <p style={{ margin: 0, color: 'var(--muted)' }}>Monthly subsidy deductions applied to your bill.</p>
          </div>
          <div className="table-wrap responsive-table">
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

          {/* Mobile: one card per subsidy deduction. */}
          <div className="responsive-card-list">
            {subsidies.map((item) => (
              <div className="responsive-card" key={`${item.subsidyId}-${item.date}-${item.mealPeriod}`}>
                <div className="responsive-card-head">
                  <strong>{item.date}</strong>
                  <b style={{ color: '#047857' }}>- {formatCurrency(item.amount)}</b>
                </div>
                <div className="responsive-card-body">
                  <div><span>Meal</span><b style={{ textTransform: 'capitalize' }}>{item.mealPeriod}</b></div>
                  <div className="responsive-card-span"><span>Note</span><b>{item.notes || 'DSW Subsidy'}</b></div>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <Modal
        isOpen={guestModalOpen}
        onClose={() => setGuestModalOpen(false)}
        title={`Guest Meal Details — ${monthLabel}`}
      >
        <div style={{ display: 'grid', gap: '1rem' }}>
          <div className="guest-meal-summary-bar">
            <div>
              <span className="summary-label">Total Guest Meals</span>
              <strong className="summary-val">{guestBreakdown?.totalGuestCount || 0}</strong>
            </div>
            <div style={{ textAlign: 'right' }}>
              <span className="summary-label">Total Guest Bill</span>
              <strong className="summary-val" style={{ color: 'var(--primary, #1e3a8a)' }}>
                {formatCurrency(guestBreakdown?.totalGuestMealBill || 0)}
              </strong>
            </div>
          </div>

          {guestLoading ? (
            <TableSkeleton rows={3} cols={4} />
          ) : !guestBreakdown?.items || guestBreakdown.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'var(--muted)' }}>
              <Users size={32} style={{ margin: '0 auto 0.5rem', opacity: 0.4, display: 'block' }} />
              No guest meals were requested for {monthLabel}.
            </div>
          ) : (
            <>
              {/* Desktop view: clean data table */}
              <div className="table-wrap student-guest-table-wrap">
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem' }}>Date & Day</th>
                      <th style={{ textAlign: 'left', padding: '0.6rem 0.75rem' }}>Meal Period</th>
                      <th style={{ textAlign: 'center', padding: '0.6rem 0.75rem' }}>Guests</th>
                      <th style={{ textAlign: 'right', padding: '0.6rem 0.75rem' }}>Rate / Meal</th>
                      <th style={{ textAlign: 'right', padding: '0.6rem 0.75rem' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {guestBreakdown.items.map((item) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.6rem 0.75rem' }}>
                          <div style={{ fontWeight: 600, color: 'var(--foreground)' }}>{item.date}</div>
                          <small style={{ color: 'var(--muted)', fontSize: '0.74rem' }}>{item.dayOfWeek}</small>
                        </td>
                        <td style={{ padding: '0.6rem 0.75rem', textTransform: 'capitalize' }}>
                          <span className={`meal-badge meal-badge-${item.mealPeriod.toLowerCase()}`}>
                            {item.mealPeriod}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.6rem 0.75rem', fontWeight: 600 }}>
                          {item.guestCount}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.6rem 0.75rem', color: 'var(--muted)' }}>
                          {formatCurrency(item.unitCost)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.6rem 0.75rem', fontWeight: 700, color: 'var(--primary)' }}>
                          {formatCurrency(item.totalCost)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile view: responsive card list */}
              <div className="responsive-card-list student-guest-cards-wrap">
                {guestBreakdown.items.map((item) => (
                  <div className="responsive-card" key={item.id} style={{ padding: '0.65rem 0.75rem' }}>
                    <div className="responsive-card-head" style={{ marginBottom: '0.35rem' }}>
                      <div>
                        <strong>{item.date}</strong>
                        <span style={{ color: 'var(--muted)', fontSize: '0.74rem', marginLeft: '0.35rem' }}>({item.dayOfWeek})</span>
                      </div>
                      <b style={{ color: 'var(--primary)' }}>{formatCurrency(item.totalCost)}</b>
                    </div>
                    <div className="responsive-card-body" style={{ fontSize: '0.8rem' }}>
                      <div>
                        <span>Period</span>
                        <b style={{ textTransform: 'capitalize' }}>{item.mealPeriod}</b>
                      </div>
                      <div>
                        <span>Guests</span>
                        <b>{item.guestCount} {item.guestCount > 1 ? 'meals' : 'meal'}</b>
                      </div>
                      <div>
                        <span>Rate / meal</span>
                        <b>{formatCurrency(item.unitCost)}</b>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
