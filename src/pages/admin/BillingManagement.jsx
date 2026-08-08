import { useCallback, useEffect, useState } from 'react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Calculator, Coffee, HandCoins, RefreshCcw, ShieldAlert } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import Modal from '../../components/ui/Modal';
import Button from '../../components/ui/Button';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { useQueryCache } from '../../context/QueryCacheContext';
import { TableSkeleton } from '../../components/ui/PageSkeleton';
import MonthYearPicker from '../../components/financial/MonthYearPicker';
import OthersBillPanel from '../../components/financial/OthersBillPanel';
import { MENU_KEYS } from '../../services/permissionService';
import { adminDataService } from '../../services/adminDataService';
import { formatCurrency, moneyInput, todayLocal } from '../../utils/formatters';
import { useAuth } from '../../context/AuthContext';

const now = new Date();
const initialFilters = { month: now.getMonth() + 1, year: now.getFullYear(), status: 'All', gender: 'All' };
const baseHeaders = ['Student Name', 'Roll', 'Hall ID', 'Service Bill', 'Monthly Bill', 'DSW Subsidy', 'Guest Meal Bill'];
const tailHeaders = ['Due Bill', 'Total Bill', 'Status'];
const emptySubsidyForm = { wing: 'Male', subsidyAmount: '', date: todayLocal(), mealPeriod: 'breakfast', notes: '' };

const getAlign = (header) => {
  if (['Service Bill', 'Monthly Bill', 'DSW Subsidy', 'Guest Meal Bill', 'Others Bill', 'Due Bill', 'Total Bill'].includes(header)) return 'right';
  if (header === 'Status') return 'center';
  return 'left';
};

export default function BillingManagement() {
  useDocumentTitle('Bill Management');
  const { user, can } = useAuth();
  const canSeeOthersBill = can(MENU_KEYS.adminOthersBill, 'view');
  const headers = canSeeOthersBill ? [...baseHeaders, 'Others Bill', ...tailHeaders] : [...baseHeaders, ...tailHeaders];
  const { invalidate } = useQueryCache();
  // Bill Management is wing-locked for every wing admin, regardless of cross-wing finance access
  // (that access still applies on Payment Verification). Only a genuinely wing-less role
  // (admin/super_admin, no user.wing) gets to choose a wing here.
  const lockedWing = user?.wing || null;
  const [filters, setFilters] = useState(initialFilters);
  const [serviceWing, setServiceWing] = useState(() => lockedWing || 'Male');
  const [serviceAmount, setServiceAmount] = useState('');
  const [hasServiceBill, setHasServiceBill] = useState(false);
  const [editingSubsidy, setEditingSubsidy] = useState(null);
  const [editSubsidyForm, setEditSubsidyForm] = useState({
    id: '',
    wing: 'Male',
    subsidyAmount: '',
    date: '',
    mealPeriod: 'breakfast',
    notes: ''
  });
  const [savingEditSubsidy, setSavingEditSubsidy] = useState(false);
  const [subsidyForm, setSubsidyForm] = useState(() => ({
    ...emptySubsidyForm,
    wing: lockedWing || 'Male',
  }));
  const [confirmSubsidyOpen, setConfirmSubsidyOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('service');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [savingService, setSavingService] = useState(false);
  const [savingSubsidy, setSavingSubsidy] = useState(false);

  useEffect(() => {
    if (lockedWing) {
      setSubsidyForm((current) => ({ ...current, wing: lockedWing }));
      setServiceWing(lockedWing);
      return;
    }
    if (filters.gender === 'Male' || filters.gender === 'Female') {
      setSubsidyForm((current) => ({ ...current, wing: filters.gender }));
      setServiceWing(filters.gender);
    }
  }, [filters.gender, lockedWing]);

  const combinedKey = `admin-billing-combined-${filters.month}-${filters.year}-${filters.status}-${lockedWing || filters.gender}-${serviceWing}`;

  const {
    data: combinedData = null,
    isLoading: loading,
    isRefreshing,
    error: loadError,
    refresh
  } = useCachedFetch(combinedKey, async () => {
    const billingRows = await adminDataService.getBillingRecords(filters);
    
    let sBillAmount = '';
    let hasSBill = false;
    try {
      const sBill = await adminDataService.getServiceBill({
        month: parseInt(filters.month, 10),
        year: parseInt(filters.year, 10),
        wing: serviceWing,
      });
      if (sBill > 0) {
        sBillAmount = String(sBill);
        hasSBill = true;
      }
    } catch {
      // ignore
    }

    let subsidies = [];
    try {
      const currentWing = lockedWing || filters.gender;
      if (currentWing === 'All') {
        const [maleSubs, femaleSubs] = await Promise.all([
          adminDataService.getDswSubsidies({ month: parseInt(filters.month, 10), year: parseInt(filters.year, 10), wing: 'Male' }),
          adminDataService.getDswSubsidies({ month: parseInt(filters.month, 10), year: parseInt(filters.year, 10), wing: 'Female' })
        ]);
        subsidies = [...(maleSubs || []), ...(femaleSubs || [])];
      } else {
        subsidies = await adminDataService.getDswSubsidies({
          month: parseInt(filters.month, 10),
          year: parseInt(filters.year, 10),
          wing: currentWing
        });
      }
    } catch {
      // ignore
    }

    return { rows: billingRows, serviceAmount: sBillAmount, hasServiceBill: hasSBill, dswSubsidies: subsidies || [] };
  }, { ttl: 30_000 });

  const rows = combinedData?.rows || [];
  const dswSubsidies = combinedData?.dswSubsidies || [];

  useEffect(() => {
    if (combinedData) {
      setServiceAmount(combinedData.serviceAmount || '');
      setHasServiceBill(combinedData.hasServiceBill || false);
    } else {
      setServiceAmount('');
      setHasServiceBill(false);
    }
  }, [combinedData]);

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

  const deleteServiceBill = async () => {
    if (!window.confirm(`Are you sure you want to delete the ${serviceWing} wing service bill for ${filters.month}/${filters.year}? This will recalculate all bills for this month.`)) return;
    setSavingService(true);
    setMessage("Deleting service bill, please wait...");
    setError("");
    try {
      await adminDataService.deleteServiceBill({
        month: parseInt(filters.month, 10),
        year: parseInt(filters.year, 10),
        wing: serviceWing,
      });
      setMessage('Service bill deleted successfully and bills recalculated.');
      setError('');
      setServiceAmount('');
      setHasServiceBill(false);
      invalidate('admin-billing-combined');
      await load();
    } catch (err) {
      setError(err.message);
      setMessage("");
    } finally {
      setSavingService(false);
    }
  };

  const deleteSubsidy = async (id) => {
    if (!window.confirm("Are you sure you want to delete this DSW subsidy? This will recalculate all affected student bills.")) return;
    setMessage("Deleting DSW subsidy, please wait...");
    setError("");
    try {
      await adminDataService.deleteDswSubsidy(id);
      setMessage("DSW subsidy deleted successfully and bills recalculated.");
      setError("");
      invalidate('admin-billing-combined');
      await load();
    } catch (err) {
      setError(err.message);
      setMessage("");
    }
  };

  const openEditSubsidy = (sub) => {
    setEditingSubsidy(sub);
    setEditSubsidyForm({
      id: sub.id,
      wing: sub.wing,
      subsidyAmount: String(sub.subsidyAmount),
      date: sub.date,
      mealPeriod: sub.mealPeriod,
      notes: sub.notes || ''
    });
  };

  const submitEditSubsidy = async () => {
    if (!editSubsidyForm.subsidyAmount || Number(editSubsidyForm.subsidyAmount) <= 0) {
      alert('Enter a valid subsidy amount.');
      return;
    }
    if (!editSubsidyForm.date) {
      alert('Select a subsidy date.');
      return;
    }
    setSavingEditSubsidy(true);
    try {
      await adminDataService.updateDswSubsidy(editSubsidyForm.id, {
        wing: editSubsidyForm.wing,
        subsidyAmount: Number(editSubsidyForm.subsidyAmount),
        date: editSubsidyForm.date,
        mealPeriod: editSubsidyForm.mealPeriod,
        notes: editSubsidyForm.notes.trim() || null,
      });
      setMessage('DSW subsidy updated successfully and bills recalculated.');
      setError('');
      setEditingSubsidy(null);
      invalidate('admin-billing-combined');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSavingEditSubsidy(false);
    }
  };


  const exportRows = () => rows.map((row) => ({
    'Student Name': row.studentName,
    Roll: row.rollNumber,
    'Hall ID': row.hallId,
    'Service Bill': row.serviceBill,
    'Monthly Bill': row.monthlyBill,
    'DSW Subsidy': row.dswSubsidy || 0,
    'Guest Meal Bill': row.guestMealBill || 0,
    ...(canSeeOthersBill ? { 'Others Bill': row.othersBill || 0 } : {}),
    'Due Bill': row.dueBill,
    'Total Bill': row.totalBill,
    Status: row.status,
  }));

  const exportCsv = () => {
    const sheet = utils.json_to_sheet(exportRows());
    const book = utils.book_new();
    utils.book_append_sheet(book, sheet, 'Bills');
    writeFile(book, `bills-${filters.year}-${filters.month}.csv`, { bookType: 'csv' });
  };

  const exportExcel = () => {
    const sheet = utils.json_to_sheet(exportRows());
    const book = utils.book_new();
    utils.book_append_sheet(book, sheet, 'Bills');
    writeFile(book, `bills-${filters.year}-${filters.month}.xlsx`);
  };

  const exportPdf = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    autoTable(doc, {
      head: [headers],
      body: rows.map((row) => [
        row.studentName,
        row.rollNumber,
        row.hallId,
        row.serviceBill,
        row.monthlyBill,
        row.dswSubsidy || 0,
        row.guestMealBill || 0,
        ...(canSeeOthersBill ? [row.othersBill || 0] : []),
        row.dueBill,
        row.totalBill,
        row.status,
      ]),
    });
    doc.save(`bills-${filters.year}-${filters.month}.pdf`);
  };

  const saveService = async (event) => {
    event.preventDefault();
    setSavingService(true);
    try {
      await adminDataService.saveServiceBill({
        month: parseInt(filters.month, 10),
        year: parseInt(filters.year, 10),
        amountPerStudent: moneyInput(serviceAmount),
        wing: serviceWing,
      });
      setMessage('Service bill saved and bills recalculated.');
      setError('');
      invalidate('admin-billing-combined');
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingService(false);
    }
  };

  const validateSubsidyForm = () => {
    if (!subsidyForm.subsidyAmount || Number(subsidyForm.subsidyAmount) <= 0) return 'Enter a valid subsidy amount.';
    if (!subsidyForm.date) return 'Select a subsidy date.';
    if (!subsidyForm.mealPeriod) return 'Select a meal period.';
    if (!subsidyForm.wing) return 'Select a wing for this subsidy.';
    return '';
  };

  const submitSubsidy = async () => {
    const validationError = validateSubsidyForm();
    if (validationError) {
      setError(validationError);
      setConfirmSubsidyOpen(false);
      return;
    }

    setSavingSubsidy(true);
    try {
      await adminDataService.createDswSubsidy({
        wing: subsidyForm.wing,
        subsidyAmount: Number(subsidyForm.subsidyAmount),
        date: subsidyForm.date,
        mealPeriod: subsidyForm.mealPeriod,
        notes: subsidyForm.notes.trim() || null,
      });
      setConfirmSubsidyOpen(false);
      setSubsidyForm({
        ...emptySubsidyForm,
        wing: lockedWing || subsidyForm.wing,
      });
      setMessage('DSW subsidy applied successfully and affected bills were recalculated.');
      setError('');
      invalidate('admin-billing-combined');
      await load();
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSavingSubsidy(false);
    }
  };

  const recalculateMonth = async () => {
    try {
      await adminDataService.recalculateBillingMonth({ month: Number(filters.month), year: Number(filters.year) });
      setMessage('Billing month recalculated successfully.');
      setError('');
      invalidate('admin-billing-combined');
      await load();
    } catch (recalcError) {
      setError(recalcError.message);
    }
  };

  return (
    <div className="financial-page">
      {isRefreshing && <div className="data-refreshing-bar" />}
      <header>
        <h1>Bill Management</h1>
        <p>Monthly bills calculated from stock-out transactions, subsidy adjustments, and historical meal participation.</p>
      </header>
      {message && <div className="student-message student-message-success">{message}</div>}
      {error && <div className="student-message student-message-error">{error}</div>}

      <section className="financial-card filter-row">
        <MonthYearPicker
          month={Number(filters.month)}
          year={Number(filters.year)}
          minYear={now.getFullYear() - 3}
          maxYear={now.getFullYear() + 3}
          onChange={({ month, year }) => setFilters({ ...filters, month, year })}
          label="Billing period"
        />
        <label>Status<select value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}><option>All</option><option>Unpaid</option><option>Partial Paid</option><option>Paid</option></select></label>
        <label>Wing<select value={lockedWing || filters.gender} disabled={Boolean(lockedWing)} onChange={(e) => setFilters({ ...filters, gender: e.target.value })}>{!lockedWing ? <option>All</option> : null}<option>Male</option><option>Female</option></select></label>
        <button className="primary-action" onClick={load} disabled={loading}>Generate</button>
        <button type="button" className="btn btn-secondary" onClick={recalculateMonth} disabled={loading}><RefreshCcw size={15} /> Recalculate</button>
      </section>

      <div className="billing-management-layout is-tabbed-card" style={{ gridTemplateColumns: 'minmax(0, 1fr)', width: '100%', maxWidth: '800px', margin: '0 auto 1.5rem' }}>
        <div className="financial-card billing-control-card" style={{ width: '100%', boxSizing: 'border-box' }}>
          <nav className="billing-tabs">
            <button
              type="button"
              className={`billing-tab-btn ${activeTab === 'service' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('service')}
            >
              <Calculator size={16} />
              <span>Service Bill Config</span>
            </button>
            <button
              type="button"
              className={`billing-tab-btn ${activeTab === 'subsidy' ? 'is-active' : ''}`}
              onClick={() => setActiveTab('subsidy')}
            >
              <HandCoins size={16} />
              <span>DSW Subsidy Distribution</span>
            </button>
            {/* Hidden for a role without this grant — currently the male wing admin, until a
                super admin turns it on from Role Permissions. */}
            {canSeeOthersBill ? (
              <button
                type="button"
                className={`billing-tab-btn ${activeTab === 'others' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('others')}
              >
                <Coffee size={16} />
                <span>Others Bill</span>
              </button>
            ) : null}
          </nav>

          {activeTab === 'others' && canSeeOthersBill ? (
            <OthersBillPanel
              month={filters.month}
              year={filters.year}
              wing={lockedWing || filters.gender}
              lockedWing={lockedWing}
              onGenerated={() => { invalidate('admin-billing-combined'); load(); }}
            />
          ) : null}

          {/* Others Bill has already been handled above — this branch only ever needs to
              distinguish Service Bill from DSW Subsidy, not act as a catch-all "else". */}
          {activeTab === 'others' ? null : activeTab === 'service' ? (
            <form onSubmit={saveService} className="billing-tab-content">
              <div className="billing-control-grid">
                <label className="billing-control-field">
                  <strong>Wing</strong>
                  {!lockedWing ? (
                    <select value={serviceWing} onChange={(e) => setServiceWing(e.target.value)}>
                      <option>Male</option>
                      <option>Female</option>
                    </select>
                  ) : (
                    <input value={`${lockedWing} Wing`} disabled readOnly />
                  )}
                </label>
                <label className="billing-control-field">
                  <strong>Monthly Service Bill</strong>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    required
                    value={serviceAmount}
                    onChange={(e) => setServiceAmount(e.target.value)}
                    placeholder="Enter amount per student"
                  />
                </label>
              </div>
              <div className="billing-control-footer">
                <div className="inline-actions" style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button className="primary-action" type="submit" disabled={savingService}>
                    {savingService ? 'Saving...' : 'Save Service Bill'}
                  </button>
                  {hasServiceBill && (
                    <button
                      type="button"
                      className="danger-action"
                      onClick={deleteServiceBill}
                      disabled={savingService}
                    >
                      Delete Service Bill
                    </button>
                  )}
                  <button type="button" onClick={exportCsv}>CSV</button>
                  <button type="button" onClick={exportExcel}>Excel</button>
                  <button type="button" onClick={exportPdf}>PDF</button>
                  <button type="button" onClick={() => window.print()}>Print</button>
                </div>
              </div>
            </form>
          ) : (
            <div className="billing-tab-content">
              <div className="billing-control-grid">
                {!lockedWing ? (
                  <label className="billing-control-field">
                    <strong>Wing</strong>
                    <select value={subsidyForm.wing} onChange={(e) => setSubsidyForm({ ...subsidyForm, wing: e.target.value })}>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                    </select>
                  </label>
                ) : (
                  <label className="billing-control-field">
                    <strong>Wing</strong>
                    <input value={`${user.wing} Wing`} disabled />
                  </label>
                )}
                <label className="billing-control-field">
                  <strong>Subsidy Amount</strong>
                  <input
                    type="number"
                    min="0"
                    step="0.0001"
                    value={subsidyForm.subsidyAmount}
                    onChange={(e) => setSubsidyForm({ ...subsidyForm, subsidyAmount: e.target.value })}
                    required
                    placeholder="e.g. 25000"
                  />
                </label>
                <label className="billing-control-field">
                  <strong>Date</strong>
                  <input
                    type="date"
                    value={subsidyForm.date}
                    onChange={(e) => setSubsidyForm({ ...subsidyForm, date: e.target.value })}
                    required
                  />
                </label>
                <label className="billing-control-field">
                  <strong>Meal Period</strong>
                  <select value={subsidyForm.mealPeriod} onChange={(e) => setSubsidyForm({ ...subsidyForm, mealPeriod: e.target.value })}>
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                  </select>
                </label>
                <label className="billing-control-field is-full">
                  <strong>Notes / Description <span style={{ fontWeight: 'normal', color: 'var(--muted)', fontSize: '0.78rem' }}>(Optional)</span></strong>
                  <input
                    value={subsidyForm.notes}
                    onChange={(e) => setSubsidyForm({ ...subsidyForm, notes: e.target.value })}
                    placeholder="Optional note for internal tracking"
                  />
                </label>
                <div className="billing-control-inline-note is-full">
                  The subsidy will be shared equally among eligible meal-active students only.
                </div>
              </div>
              <div className="billing-control-footer is-right">
                <button
                  type="button"
                  className="primary-action"
                  onClick={() => setConfirmSubsidyOpen(true)}
                  disabled={savingSubsidy}
                >
                  {savingSubsidy ? 'Applying...' : 'Save Subsidy'}
                </button>
              </div>

              {/* Applied DSW Subsidies List */}
              <div className="applied-subsidies-section" style={{ marginTop: '1.5rem', borderTop: '1px solid var(--border)', paddingTop: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--primary)' }}>
                  Applied DSW Subsidies for {filters.month}/{filters.year}
                </h3>
                <div className="table-wrap" style={{ overflowX: 'auto', marginTop: '0.5rem' }}>
                  <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', minWidth: '720px' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border)' }}>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Wing</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Meal</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Subsidy</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Students</th>
                        <th style={{ padding: '0.5rem', textAlign: 'right' }}>Per Student</th>
                        <th style={{ padding: '0.5rem', textAlign: 'left' }}>Notes</th>
                        <th style={{ padding: '0.5rem', textAlign: 'center' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dswSubsidies.length === 0 ? (
                        <tr>
                          <td colSpan="8" style={{ textAlign: 'center', padding: '1rem', color: 'var(--muted)' }}>
                            No applied DSW subsidies found for this period.
                          </td>
                        </tr>
                      ) : (
                        dswSubsidies.map((sub) => (
                          <tr key={sub.id} style={{ borderBottom: '1px solid var(--border)' }}>
                            <td style={{ padding: '0.5rem', textAlign: 'left' }}>{sub.date}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'left' }}>{sub.wing}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'left', textTransform: 'capitalize' }}>{sub.mealPeriod}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '600' }}>{formatCurrency(sub.subsidyAmount)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>{sub.eligibleStudentCount}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'right', color: '#047857', fontWeight: '600' }}>{formatCurrency(sub.perStudentSubsidy)}</td>
                            <td style={{ padding: '0.5rem', textAlign: 'left', color: 'var(--muted)', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={sub.notes || ''}>
                              {sub.notes || '-'}
                            </td>
                            <td style={{ padding: '0.5rem', textAlign: 'center' }}>
                              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-xs"
                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', height: 'auto', minHeight: '0' }}
                                  onClick={() => openEditSubsidy(sub)}
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  className="danger-action"
                                  style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem', borderRadius: '4px', height: 'auto', minHeight: '0' }}
                                  onClick={() => deleteSubsidy(sub.id)}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <section className="financial-card billing-table-card">
        {loading && !rows.length ? (
          <TableSkeleton rows={8} cols={headers.length} />
        ) : (
          <div className="table-wrap sticky-page-table billing-table-scroll">
            <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {headers.map((header) => (
                    <th key={header} style={{ textAlign: getAlign(header), padding: '0.75rem' }}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                      No billing records found.
                    </td>
                  </tr>
                ) : (
                rows.map((row) => {
                  const statusNorm = String(row.status || '').toLowerCase().replace('_', ' ').trim();
                  let badgeBg = '#f1f5f9';
                  let badgeColor = '#64748b';
                  if (statusNorm === 'paid') { badgeBg = '#ecfdf5'; badgeColor = '#047857'; }
                  else if (statusNorm === 'partial paid' || statusNorm === 'partial_paid') { badgeBg = '#fffbeb'; badgeColor = '#b45309'; }
                  else if (statusNorm === 'unpaid') { badgeBg = '#fef2f2'; badgeColor = '#b91c1c'; }

                  return (
                    <tr key={row.studentId} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--primary)' }}>{row.studentName}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '500' }}>{row.rollNumber}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)', fontSize: '0.9rem' }}>{row.hallId}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(row.serviceBill)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(row.monthlyBill)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: '#047857', fontWeight: '700' }}>{formatCurrency(row.dswSubsidy || 0)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(row.guestMealBill || 0)}</td>
                      {canSeeOthersBill && (
                        <td style={{ padding: '0.75rem', textAlign: 'right' }}>{formatCurrency(row.othersBill || 0)}</td>
                      )}
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '500' }}>
                        {formatCurrency(row.dueBill)}
                        {row.isOverridden && (
                          <span className="warning-badge" style={{ marginLeft: '0.35rem', background: '#fffbeb', color: '#b45309', padding: '0.1rem 0.35rem', borderRadius: '4px', fontSize: '0.7rem', fontWeight: '600' }}>
                            Override
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', fontWeight: '600', color: 'var(--primary)' }}>{formatCurrency(row.totalBill)}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <span style={{ background: badgeBg, color: badgeColor, padding: '0.25rem 0.6rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600', textTransform: 'capitalize', display: 'inline-block', textAlign: 'center', minWidth: '95px' }}>
                          {statusNorm}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>

      <Modal
        isOpen={confirmSubsidyOpen}
        onClose={() => !savingSubsidy && setConfirmSubsidyOpen(false)}
        title="Confirm DSW Subsidy"
        actions={(
          <>
            <Button variant="secondary" onClick={() => setConfirmSubsidyOpen(false)} disabled={savingSubsidy}>Cancel</Button>
            <Button onClick={submitSubsidy} disabled={savingSubsidy}>{savingSubsidy ? 'Applying...' : 'Apply Subsidy'}</Button>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#92400e' }}>
            <ShieldAlert size={18} />
            <strong>Check this financial action before applying</strong>
          </div>
          <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.6 }}>
            This will distribute <strong>{formatCurrency(Number(subsidyForm.subsidyAmount || 0))}</strong> across all meal-active students in the <strong>{subsidyForm.wing}</strong> wing for <strong>{subsidyForm.date}</strong> during <strong style={{ textTransform: 'capitalize' }}>{subsidyForm.mealPeriod}</strong>.
          </p>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(editingSubsidy)}
        onClose={() => !savingEditSubsidy && setEditingSubsidy(null)}
        title="Edit DSW Subsidy"
        actions={(
          <>
            <Button variant="secondary" onClick={() => setEditingSubsidy(null)} disabled={savingEditSubsidy}>Cancel</Button>
            <Button onClick={submitEditSubsidy} disabled={savingEditSubsidy}>
              {savingEditSubsidy ? 'Saving...' : 'Save Changes'}
            </Button>
          </>
        )}
      >
        <div style={{ display: 'grid', gap: '0.85rem' }}>
          <label className="billing-control-field">
            <strong>Wing</strong>
            {!lockedWing ? (
              <select
                value={editSubsidyForm.wing}
                onChange={(e) => setEditSubsidyForm({ ...editSubsidyForm, wing: e.target.value })}
              >
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            ) : (
              <input value={`${user.wing} Wing`} disabled className="field-control" style={{ background: '#f1f5f9' }} />
            )}
          </label>
          <label className="billing-control-field">
            <strong>Subsidy Amount</strong>
            <input
              type="number"
              min="0"
              step="0.0001"
              value={editSubsidyForm.subsidyAmount}
              onChange={(e) => setEditSubsidyForm({ ...editSubsidyForm, subsidyAmount: e.target.value })}
              required
            />
          </label>
          <label className="billing-control-field">
            <strong>Date</strong>
            <input
              type="date"
              value={editSubsidyForm.date}
              onChange={(e) => setEditSubsidyForm({ ...editSubsidyForm, date: e.target.value })}
              required
            />
          </label>
          <label className="billing-control-field">
            <strong>Meal Period</strong>
            <select
              value={editSubsidyForm.mealPeriod}
              onChange={(e) => setEditSubsidyForm({ ...editSubsidyForm, mealPeriod: e.target.value })}
            >
              <option value="breakfast">Breakfast</option>
              <option value="lunch">Lunch</option>
              <option value="dinner">Dinner</option>
            </select>
          </label>
          <label className="billing-control-field">
            <strong>Notes / Description (Optional)</strong>
            <input
              value={editSubsidyForm.notes}
              onChange={(e) => setEditSubsidyForm({ ...editSubsidyForm, notes: e.target.value })}
              placeholder="Optional notes"
            />
          </label>
        </div>
      </Modal>
    </div>
  );
}
