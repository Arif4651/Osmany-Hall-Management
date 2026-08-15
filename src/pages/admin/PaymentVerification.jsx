import { useCallback, useEffect, useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { useQueryCache } from '../../context/QueryCacheContext';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import { adminDataService } from '../../services/adminDataService';
import { formatCurrency, formatDate, moneyInput } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const monthNames = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat('en', { month: 'short' }).format(new Date(2000, index, 1)));

export default function PaymentVerification() {
  useDocumentTitle('Payment Verification');
  const { user, role, canChooseFinanceWing, isPermissionsLoading } = useAuth();
  const { invalidate } = useQueryCache();
  const toast = useToast();
  // Wing-locked unless the server says this role may switch wings on financial screens.
  const isWingAdmin = (role === 'male_wing_admin' || role === 'female_wing_admin') && !canChooseFinanceWing;

  // Wing-locked admins start on their own wing; anyone who may choose starts on every wing.
  const [gender, setGender] = useState(() => user?.wing || 'All');
  const [hasAppliedWingDefault, setHasAppliedWingDefault] = useState(false);

  // canChooseFinanceWing arrives with the permissions fetch, after first render — apply the
  // default once it lands, and only once, so a manual switch afterwards is never overridden.
  useEffect(() => {
    if (isPermissionsLoading || hasAppliedWingDefault) return;
    setGender(canChooseFinanceWing ? 'All' : (user?.wing || 'All'));
    setHasAppliedWingDefault(true);
  }, [isPermissionsLoading, canChooseFinanceWing, hasAppliedWingDefault, user?.wing]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [reviewing, setReviewing] = useState(null);
  const [approvedAmount, setApprovedAmount] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Reset page to 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [gender, statusFilter, searchQuery]);

  const cacheKey = `admin-payments-${gender}-${statusFilter}-${searchQuery}-${page}-${pageSize}`;

  const {
    data: paymentData = null,
    isLoading: loading,
    isRefreshing,
    error: loadError,
    refresh
  } = useCachedFetch(
    cacheKey,
    () => adminDataService.getPayments({ gender, status: statusFilter, search: searchQuery, page, pageSize }),
    { ttl: 30_000 }
  );

  const rows = paymentData?.items || [];

  useEffect(() => {
    if (loadError) {
      setError(loadError.message);
    } else {
      setError('');
    }
  }, [loadError]);

  const load = useCallback(async () => {
    refresh();
  }, [refresh]);

  const review = async (id, action, amount = null) => {
    const row = rows.find((item) => item.id === id);
    setSubmitting(true);
    setError('');
    try {
      await adminDataService.reviewPayment(id, action, amount);
      setReviewing(null);
      // Names the student and the amount that actually moved, so the admin can confirm they
      // acted on the row they meant to without hunting for it again in the table.
      toast.success(
        action === 'approve' ? 'Payment approved' : 'Payment rejected',
        action === 'approve'
          ? `${row?.studentName || 'Student'} · ${formatCurrency(amount ?? row?.submittedAmount ?? 0)} deducted from the due bill.`
          : `${row?.studentName || 'Student'}'s submission was rejected.`,
      );
      invalidate('admin-payments-');
      invalidate('admin-billing-combined');
      invalidate('due-rows-');
      await load();
    } catch (reviewError) {
      toast.error(
        action === 'approve' ? 'Could not approve payment' : 'Could not reject payment',
        reviewError?.message,
      );
    } finally {
      setSubmitting(false);
    }
  };

  const openApproval = (row) => {
    setReviewing(row);
    setApprovedAmount(row.submittedAmount);
  };

  const approve = () => review(reviewing.id, 'approve', moneyInput(approvedAmount));

  const totalPages = paymentData?.totalPages || 1;
  const total = paymentData?.total || 0;
  const pageStart = total ? (page - 1) * pageSize + 1 : 0;
  const pageEnd = Math.min(page * pageSize, total);

  return (
    <div className="financial-page">
      {isRefreshing && <div className="data-refreshing-bar" />}

      <header>
        <h1>Payment Verification</h1>
        <p>Review student payment submissions and update monthly dues atomically.</p>
      </header>

      {error && <div className="student-message student-message-error">{error}</div>}

      <div className="wing-filter-bar">
        <strong>{gender === 'All' ? 'All Wings — Payments' : `${gender} Wing Payments`}</strong>
        {isWingAdmin ? (
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            background: user?.wing === 'Female' ? '#fce7f3' : '#dbeafe',
            color: user?.wing === 'Female' ? '#9d174d' : '#1e40af',
            border: `1px solid ${user?.wing === 'Female' ? '#f9a8d4' : '#93c5fd'}`,
            borderRadius: '6px',
            padding: '0.3rem 0.8rem',
            fontWeight: 600,
            fontSize: '0.82rem',
          }}>
            Restricted to {user?.wing} Wing
          </span>
        ) : (
          <div className="wing-switcher">
            {['All', 'Male', 'Female'].map((wing) => (
              <button
                type="button"
                key={wing}
                className={gender === wing ? 'is-active' : ''}
                onClick={() => setGender(wing)}
              >
                {wing === 'All' ? 'All Wings' : `${wing} Wing`}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="financial-card filter-row" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', padding: '1rem', marginTop: '0.5rem' }}>
        <label className="field-control" style={{ flex: '1', minWidth: '220px' }}>
          <span>Search Student / Roll / ID / Txn</span>
          <input
            type="text"
            placeholder="Search name, roll, hall ID, transaction..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
          />
        </label>
        <label className="field-control" style={{ minWidth: '180px' }}>
          <span>Status Filter</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All Statuses</option>
            <option value="under_review">Under Review / Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </label>
      </div>

      <section className="financial-card table-wrap sticky-page-table">
        {loading && !rows.length ? (
          <TableSkeleton rows={8} cols={12} />
        ) : (
          <>
            <table className="data-table payment-verification-table" style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Student Info</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Billing Period</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem' }}>Amount</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem' }}>Charges</th>
                  <th style={{ textAlign: 'right', padding: '0.75rem' }}>Approved Amount</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Category</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Transaction ID</th>
                  <th style={{ textAlign: 'left', padding: '0.75rem' }}>Submitted At</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>Status</th>
                  <th style={{ textAlign: 'center', padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: 'center', padding: '3rem', color: 'var(--muted)' }}>
                      No payment submissions found.
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
                    } else if (statusNorm === 'pending' || statusNorm === 'under review' || statusNorm === 'under_review') {
                      badgeBg = '#fffbeb';
                      badgeColor = '#b45309';
                    } else if (statusNorm === 'rejected') {
                      badgeBg = '#fef2f2';
                      badgeColor = '#b91c1c';
                    }

                    return (
                      <tr key={row.id} style={{ borderBottom: '1px solid var(--border)', verticalAlign: 'middle' }}>
                        <td className="student-cell" style={{ padding: '0.75rem', textAlign: 'left' }}>
                          <div style={{ fontWeight: '600', color: 'var(--primary)' }}>{row.studentName}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--muted)', marginTop: '0.15rem' }}>
                            <span style={{ fontWeight: '500' }}>{row.rollNumber}</span>
                            {row.hallId && <span> / {row.hallId}</span>}
                          </div>
                          {/* Only in the combined view, where rows from both wings are interleaved. */}
                          {gender === 'All' && row.gender ? (
                            <span className={`wing-pill is-${row.gender.toLowerCase()}`} style={{ marginTop: '0.3rem' }}>
                              {row.gender} Wing
                            </span>
                          ) : null}
                        </td>
                        <td className="billing-cell" data-label="Billing Period" style={{ padding: '0.75rem', textAlign: 'left' }}>
                          {monthNames[row.billingMonth - 1]} {row.billingYear}
                        </td>
                        <td className="amount-cell" data-label="Amount" style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600' }}>
                          {formatCurrency(row.submittedAmount)}
                        </td>
                        <td className="charges-cell" data-label="Charges" style={{ padding: '0.75rem', textAlign: 'right', color: 'var(--muted)' }}>
                          {formatCurrency(row.submittedCharge)}
                        </td>
                        <td className="approved-amount-cell" data-label="Approved Amount" style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: row.approvedAmount ? 'var(--success)' : 'inherit' }}>
                          {row.approvedAmount == null ? '—' : formatCurrency(row.approvedAmount)}
                        </td>
                        <td className="category-cell" data-label="Category" style={{ padding: '0.75rem', textAlign: 'left' }}>
                          {row.category}
                        </td>
                        <td className="transaction-cell" data-label="Transaction ID" style={{ padding: '0.75rem', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.9rem', color: '#334155' }}>
                          {row.transactionId}
                        </td>
                        <td className="submitted-at-cell" data-label="Submitted At" style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)', fontSize: '0.85rem' }}>
                          {formatDate(row.submittedAtUtc)}
                        </td>
                        <td className="status-cell" data-label="Status" style={{ padding: '0.75rem', textAlign: 'center' }}>
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
                            minWidth: '95px'
                          }}>
                            {statusNorm}
                          </span>
                        </td>
                        <td className="actions-cell" style={{ padding: '0.75rem', textAlign: 'center' }}>{row.status === 'under_review' && (
                            <div style={{ display: 'inline-flex', gap: '0.35rem' }}>
                              <button
                                className="approve-action"
                                onClick={() => openApproval(row)}
                                disabled={submitting}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.35rem 0.6rem',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: submitting ? 'not-allowed' : 'pointer',
                                  background: '#ecfdf5',
                                  color: '#065f46',
                                  opacity: submitting ? 0.6 : 1
                                }}
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button
                                className="danger-action"
                                onClick={() => review(row.id, 'reject')}
                                disabled={submitting}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  padding: '0.35rem 0.6rem',
                                  fontSize: '0.8rem',
                                  fontWeight: '600',
                                  border: 'none',
                                  borderRadius: '4px',
                                  cursor: submitting ? 'not-allowed' : 'pointer',
                                  background: '#fef2f2',
                                  color: '#991b1b',
                                  opacity: submitting ? 0.6 : 1
                                }}
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          )}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="student-pagination-row" style={{ marginTop: '1rem', padding: '0.5rem 0' }}>
                <div>
                  <span>Rows per page</span>
                  <select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                    <option value={50}>50</option>
                  </select>
                  <span style={{ marginLeft: '1rem', color: 'var(--muted)', fontSize: '0.9rem' }}>
                    Showing {pageStart}-{pageEnd} of {total} payments
                  </span>
                </div>
                <div className="inline-actions">
                  <Button variant="secondary" onClick={() => setPage(Math.max(1, page - 1))} disabled={page <= 1}>
                    Previous
                  </Button>
                  <span style={{ alignSelf: 'center' }}>Page {page} of {totalPages}</span>
                  <Button variant="secondary" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
                    Next
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </section>

      <Modal
        isOpen={!!reviewing}
        onClose={() => {
          if (!submitting) setReviewing(null);
        }}
        title="Approve Payment"
      >
        <div className="payment-review-summary">
          <div><span>Student</span><strong>{reviewing?.studentName}</strong></div>
          <div><span>Submitted amount</span><strong>{formatCurrency(reviewing?.submittedAmount || 0)}</strong></div>
          <div><span>Submitted charges</span><strong>{formatCurrency(reviewing?.submittedCharge || 0)}</strong></div>
        </div>
        <label className="field-control">
          <span>Amount to deduct from due bill</span>
          <input
            type="number"
            min="0"
            step="0.01"
            required
            value={approvedAmount}
            onChange={(event) => setApprovedAmount(event.target.value)}
            disabled={submitting}
          />
        </label>
        {submitting && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            <Loader2 size={16} className="spin-icon" />
            <span>Processing approval and updating student billing...</span>
          </div>
        )}
        <div className="payment-review-actions">
          <Button variant="secondary" onClick={() => setReviewing(null)} disabled={submitting}>Cancel</Button>
          <Button onClick={approve} disabled={submitting}>
            {submitting ? (
              <><Loader2 size={16} className="spin-icon" /> Approving...</>
            ) : (
              <><Check size={16} />Confirm Approval</>
            )}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
