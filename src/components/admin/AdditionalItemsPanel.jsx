import { useCallback, useEffect, useMemo, useState } from 'react';
import { Coffee, Edit2, Plus, Power, Trash2 } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { adminDataService } from '../../services/adminDataService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const WING_LABELS = { Female: 'Female wing only', Male: 'Male wing only', All: 'Both wings' };

/**
 * Admin catalogue for optional consumables (Tea and similar).
 *
 * Eligibility is a wing on the item rather than a per-student list, so it reads straight off the
 * student's existing gender — and widening Tea to the male wing later is a dropdown change here,
 * not a deployment. Who took what on a given day lives on the Meal Sheet page, alongside the
 * regular meal roster, rather than as a report on this page.
 *
 * A wing admin only ever works within their own wing: they see the items that apply to it and
 * cannot retarget one at the other wing. Only a super admin, who has no wing of their own, can
 * choose freely or mark an item as available to both.
 */
export default function AdditionalItemsPanel() {
  const { user } = useAuth();
  const toast = useToast();
  // The admin's own wing, or null for a super admin. Note this is deliberately user.wing and not
  // the page's selected wing — the latter is just a viewing filter.
  const adminWing = user?.wing || null;
  const [items, setItems] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(() => ({
    code: '', name: '', defaultQuantity: 1, isActive: true,
    eligibleWing: user?.wing || 'Female',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setItems(await adminDataService.getAdditionalItems());
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  /**
   * Wing choices this admin may pick. A wing admin gets exactly one — their own — except when
   * editing an item that is already marked for both wings, where "All" stays selectable so
   * saving an unrelated field cannot silently narrow it to one wing.
   */
  const wingOptions = useMemo(() => {
    if (!adminWing) return ['Female', 'Male', 'All'];
    const current = editing && editing !== 'new' ? form.eligibleWing : null;
    return current === 'All' ? [adminWing, 'All'] : [adminWing];
  }, [adminWing, editing, form.eligibleWing]);

  const openCreate = () => {
    setForm({
      code: '', name: '', defaultQuantity: 1, isActive: true,
      eligibleWing: adminWing || 'Female',
    });
    setEditing('new');
    setError('');
  };
  const openEdit = (item) => { setForm({ ...item }); setEditing(item.id); setError(''); };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const payload = {
        code: form.code.trim().toLowerCase(),
        name: form.name.trim(),
        eligibleWing: form.eligibleWing,
        defaultQuantity: Number(form.defaultQuantity) || 1,
        isActive: form.isActive,
      };
      const isNew = editing === 'new';
      if (isNew) await adminDataService.createAdditionalItem(payload);
      else await adminDataService.updateAdditionalItem(editing, payload);
      setEditing(null);
      await load();
      toast.success(
        isNew ? 'Additional item created' : 'Additional item updated',
        `${payload.name} · ${WING_LABELS[payload.eligibleWing] || payload.eligibleWing}`
        + `${payload.isActive ? '' : ' · inactive'}.`,
      );
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.name}"? If it already has selections or bills it will be deactivated instead.`)) return;
    try {
      const result = await adminDataService.deleteAdditionalItem(item.id);
      await load();
      // The server decides between a real delete and a deactivation, so its own wording is the
      // accurate one — fall back only when it says nothing.
      toast.success('Item removed', result?.message || `"${item.name}" is no longer offered.`);
    } catch (deleteError) {
      toast.error('Could not remove item', deleteError?.message);
    }
  };

  return (
    <section className="admin-meal-menu-section additional-items-panel">
      <div className="admin-meal-section-head">
        <div>
          <h2><Coffee size={18} /> Additional Meal Items</h2>
          <p>
            Optional extras students mark per date and meal. Eligibility follows the student&apos;s
            wing, so assigning an item to a wing is all that is needed to open it up.
          </p>
        </div>
        <Button onClick={openCreate}><Plus size={16} /> Add Item</Button>
      </div>

      {error && !editing ? <div className="student-message student-message-error">{error}</div> : null}

      <div className="admin-meal-table-wrap">
        <table className="admin-meal-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Item</th>
              <th style={{ textAlign: 'left' }}>Code</th>
              <th style={{ textAlign: 'left' }}>Eligible Wing</th>
              <th style={{ textAlign: 'right' }}>Qty / selection</th>
              <th style={{ textAlign: 'center' }}>Status</th>
              <th style={{ textAlign: 'center' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td style={{ textAlign: 'left' }}><strong>{item.name}</strong></td>
                <td style={{ textAlign: 'left' }}><code>{item.code}</code></td>
                <td style={{ textAlign: 'left' }}>
                  <span className={`wing-pill is-${item.eligibleWing.toLowerCase()}`}>
                    {item.eligibleWing === 'All' ? 'Both wings' : `${item.eligibleWing} wing`}
                  </span>
                </td>
                <td style={{ textAlign: 'right' }}>{item.defaultQuantity}</td>
                <td style={{ textAlign: 'center' }}>
                  {item.isActive
                    ? <span className="settings-active"><Power size={13} /> Active</span>
                    : <span className="settings-inactive">Inactive</span>}
                </td>
                <td style={{ textAlign: 'center' }}>
                  <button type="button" className="settings-edit" onClick={() => openEdit(item)}>
                    <Edit2 size={14} /> Edit
                  </button>
                  <button type="button" className="settings-edit" onClick={() => remove(item)}>
                    <Trash2 size={14} /> Delete
                  </button>
                </td>
              </tr>
            ))}
            {!items.length ? (
              <tr><td colSpan="6" className="settings-empty">No additional items configured yet.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Modal
        isOpen={Boolean(editing)}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Add Additional Item' : 'Edit Additional Item'}
      >
        <form className="admin-meal-form" onSubmit={save}>
          {error ? <div className="student-message student-message-error">{error}</div> : null}
          <div>
            <label>
              Item Name
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              Code
              <input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                disabled={editing !== 'new'}
                placeholder="e.g. tea"
                required
              />
            </label>
          </div>
          <div>
            <label>
              Eligible Wing
              <select
                value={form.eligibleWing}
                disabled={wingOptions.length === 1}
                onChange={(e) => setForm({ ...form, eligibleWing: e.target.value })}
              >
                {wingOptions.map((option) => (
                  <option key={option} value={option}>{WING_LABELS[option]}</option>
                ))}
              </select>
              {adminWing ? (
                <small className="role-form-hint">
                  Items you manage apply to the {adminWing} wing.
                </small>
              ) : null}
            </label>
            <label>
              Quantity per selection
              <input
                type="number" min="1" max="20" value={form.defaultQuantity}
                onChange={(e) => setForm({ ...form, defaultQuantity: e.target.value })}
              />
            </label>
          </div>
          <label className="settings-active-toggle">
            <input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} />
            Available to students
          </label>
          {editing !== 'new' ? (
            <p className="role-form-hint">
              The code is fixed once created — billing history is written against it.
            </p>
          ) : null}
          <div className="payment-review-actions">
            <Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Item'}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
