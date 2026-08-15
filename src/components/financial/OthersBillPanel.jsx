import { useCallback, useEffect, useMemo, useState } from 'react';
import { Calculator, HandCoins, RefreshCcw, Trash2, TriangleAlert } from 'lucide-react';
import Button from '../ui/Button';
import { adminDataService } from '../../services/adminDataService';
import { formatCurrency } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';

/**
 * Pooled monthly bills for optional items, split by consumption.
 *
 * Preview and generate hit the same server-side calculation — the client never derives a rate or
 * an amount itself, so what the admin approves is exactly what gets stored.
 */
export default function OthersBillPanel({ month, year, wing, lockedWing, onGenerated }) {
  const toast = useToast();
  const [items, setItems] = useState([]);
  const [bills, setBills] = useState([]);
  const [itemId, setItemId] = useState('');
  const [billWing, setBillWing] = useState(lockedWing || 'Male');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // Generating a bill always targets one concrete wing, independent of the page's "All" filter —
  // a locked admin can only ever target their own wing, mirroring the DSW Subsidy form.
  useEffect(() => {
    if (lockedWing) setBillWing(lockedWing);
  }, [lockedWing]);

  const effectiveWing = billWing;

  const load = useCallback(async () => {
    try {
      const [itemRows, billRows] = await Promise.all([
        adminDataService.getAdditionalItems(),
        adminDataService.getOthersBills({ month, year, wing: wing === 'All' ? undefined : wing }),
      ]);
      const active = itemRows.filter((x) => x.isActive);
      setItems(active);
      setBills(billRows);
      setItemId((current) => current || active[0]?.id || '');
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, [month, year, wing]);

  useEffect(() => { load(); }, [load]);

  // A changed month/item invalidates any preview still on screen.
  useEffect(() => { setPreview(null); }, [month, year, itemId, billWing]);

  const selectedItem = useMemo(() => items.find((x) => x.id === itemId), [items, itemId]);

  const existing = useMemo(
    () => bills.find((b) => b.itemId === itemId && b.wing === effectiveWing),
    [bills, itemId, effectiveWing],
  );

  const request = () => ({
    month: parseInt(month, 10),
    year: parseInt(year, 10),
    itemId,
    wing: effectiveWing,
    totalAmount: Number(amount || 0),
    notes: notes.trim() || null,
  });

  const runPreview = async () => {
    if (!itemId) return setError('Select an item first.');
    if (!amount || Number(amount) <= 0) return setError('Enter the total bill amount.');
    setBusy('preview');
    setError('');
    try {
      setPreview(await adminDataService.previewOthersBill(request()));
    } catch (previewError) {
      setError(previewError.message);
      setPreview(null);
    } finally {
      setBusy('');
    }
  };

  const generate = async () => {
    if (!itemId) return setError('Select an item first.');
    if (!amount || Number(amount) <= 0) return setError('Enter the total bill amount.');
    const label = existing ? 'Regenerate' : 'Generate';
    if (!window.confirm(
      `${label} the ${selectedItem?.name} bill for ${month}/${year} (${effectiveWing} wing)?\n\n`
      + `This ${existing ? 'replaces the current snapshot and ' : ''}applies the amounts to each student's monthly bill.`,
    )) return;

    setBusy('generate');
    setError('');
    const total = formatCurrency(amount);
    try {
      await adminDataService.generateOthersBill(request());
      setPreview(null);
      setAmount('');
      setNotes('');
      await load();
      onGenerated?.();
      toast.success(
        existing ? 'Others bill regenerated' : 'Others bill generated',
        `${selectedItem?.name} · ${total} · ${effectiveWing} wing · ${month}/${year} · applied to student bills.`,
      );
    } catch (generateError) {
      toast.error('Could not generate bill', generateError?.message);
    } finally {
      setBusy('');
    }
  };

  const remove = async (bill) => {
    if (!window.confirm(`Delete the ${bill.itemName} bill for ${bill.month}/${bill.year}? Student bills will be recalculated without it.`)) return;
    setBusy('delete');
    try {
      await adminDataService.deleteOthersBill(bill.id);
      await load();
      onGenerated?.();
      toast.success(
        'Others bill deleted',
        `${bill.itemName} · ${bill.month}/${bill.year} · student bills were recalculated without it.`,
      );
    } catch (deleteError) {
      toast.error('Could not delete bill', deleteError?.message);
    } finally {
      setBusy('');
    }
  };

  const shown = preview ?? existing ?? null;

  return (
    <div className="billing-tab-content others-bill-panel">
      <div className="others-bill-intro">
        <HandCoins size={18} />
        <p>
          Enter the month&apos;s total for an item. It is shared out by each student&apos;s actual
          count — <strong>not</strong> divided equally — and the parts always add back up to the
          total you enter.
        </p>
      </div>

      {error ? <div className="student-message student-message-error">{error}</div> : null}

      {!items.length ? (
        <p className="others-bill-empty">
          No additional items are configured yet. Add one under Meal Management → Additional Meal
          Items before entering a bill.
        </p>
      ) : (
        <>
          <div className="billing-control-grid">
            <label className="billing-control-field">
              <strong>Item</strong>
              <select value={itemId} onChange={(e) => setItemId(e.target.value)}>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
              </select>
            </label>
            <label className="billing-control-field">
              <strong>Wing</strong>
              {!lockedWing ? (
                <select value={billWing} onChange={(e) => setBillWing(e.target.value)}>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              ) : (
                <input value={`${lockedWing} Wing`} disabled readOnly />
              )}
            </label>
            <label className="billing-control-field">
              <strong>Total Bill Amount</strong>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 3000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </label>
            <label className="billing-control-field">
              <strong>Notes (optional)</strong>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. September tea" />
            </label>
          </div>

          <div className="billing-control-footer">
            <Button variant="secondary" onClick={runPreview} disabled={busy !== ''}>
              <Calculator size={15} /> {busy === 'preview' ? 'Calculating…' : 'Preview Distribution'}
            </Button>
            <Button onClick={generate} disabled={busy !== ''}>
              <RefreshCcw size={15} />
              {busy === 'generate' ? 'Generating…' : existing ? 'Regenerate Bill' : 'Generate Bill'}
            </Button>
          </div>
        </>
      )}

      {existing?.hasDrifted ? (
        <div className="others-bill-drift">
          <TriangleAlert size={18} />
          <div>
            <strong>Consumption has changed since this bill was generated</strong>
            <span>
              Generated against {existing.totalConsumptionCount} units; there are now{' '}
              {existing.currentConsumptionCount}. Student bills still show the amounts frozen at
              generation. Regenerate to apply the new counts.
            </span>
          </div>
        </div>
      ) : null}

      {shown ? (
        <section className="others-bill-result">
          <header>
            <div>
              <h4>{preview ? 'Preview' : 'Generated'} — {shown.itemName} · {shown.wing} wing</h4>
              <p>
                {formatCurrency(shown.totalAmount)} ÷ {shown.totalConsumptionCount} units ={' '}
                <strong>{formatCurrency(shown.unitRate)}</strong> per unit
              </p>
            </div>
            {!preview && existing ? (
              <button type="button" className="others-bill-delete" onClick={() => remove(existing)} disabled={busy !== ''}>
                <Trash2 size={15} /> Delete
              </button>
            ) : null}
          </header>

          <div className="admin-meal-table-wrap">
            <table className="admin-meal-table">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Student</th>
                  <th style={{ textAlign: 'left' }}>Roll</th>
                  <th style={{ textAlign: 'right' }}>Count</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                </tr>
              </thead>
              <tbody>
                {shown.allocations.map((row) => (
                  <tr key={row.studentId}>
                    <td style={{ textAlign: 'left' }}>{row.studentName}</td>
                    <td style={{ textAlign: 'left' }}>{row.rollNumber}</td>
                    <td style={{ textAlign: 'right' }}>{row.consumptionCount}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatCurrency(row.allocatedAmount)}</td>
                  </tr>
                ))}
                {!shown.allocations.length ? (
                  <tr><td colSpan="4" className="settings-empty">No consumption recorded for this month.</td></tr>
                ) : null}
                <tr>
                  <td colSpan="2" style={{ fontWeight: 700 }}>Total</td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {shown.allocations.reduce((s, r) => s + r.consumptionCount, 0)}
                  </td>
                  <td style={{ textAlign: 'right', fontWeight: 700 }}>
                    {formatCurrency(shown.allocations.reduce((s, r) => s + Number(r.allocatedAmount), 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {bills.length > 0 ? (
        <section className="others-bill-existing">
          <h4>Generated bills for {month}/{year}</h4>
          <ul>
            {bills.map((bill) => (
              <li key={bill.id}>
                <span>{bill.itemName} · {bill.wing}</span>
                <span>{formatCurrency(bill.totalAmount)} over {bill.totalConsumptionCount} units</span>
                {bill.hasDrifted ? <em className="others-bill-stale">counts changed</em> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
