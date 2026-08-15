import { useCallback, useEffect, useState } from 'react';
import { Edit2, KeyRound, Plus, ShieldCheck, UserCheck, Users, UserX } from 'lucide-react';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import RolePermissionMatrix from '../../components/permissions/RolePermissionMatrix';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { adminDataService } from '../../services/adminDataService';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

const emptyForm = {
  fullName: '', email: '', userName: '', role: 'male_wing_admin', wing: 'Male',
  designation: 'Male Wing Administrator', password: '', isActive: true,
};

export default function AdminSettings() {
  useDocumentTitle('Admin Settings');
  const { isSuperAdmin } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState('accounts');
  const [admins, setAdmins] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setAdmins(await adminDataService.getAdminAccounts()); setError(''); }
    catch (loadError) { setError(loadError.message); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing('new'); setForm(emptyForm); setError(''); };
  const openEdit = (admin) => { setEditing(admin.id); setForm({ ...admin, password: '' }); setError(''); };
  const updateRole = (role) => {
    const female = role === 'female_wing_admin';
    setForm({ ...form, role, wing: female ? 'Female' : 'Male', designation: female ? 'Female Wing Administrator' : 'Male Wing Administrator' });
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    const isNew = editing === 'new';
    try {
      if (isNew) await adminDataService.createAdminAccount(form);
      else await adminDataService.updateAdminAccount(editing, form);
      setEditing(null);
      await load();
      toast.success(
        isNew ? 'Administrator account created' : 'Administrator account updated',
        `${form.fullName} · ${form.designation}.`,
      );
    } catch (saveError) { setError(saveError.message); }
    finally { setSaving(false); }
  };

  return (
    <div className="admin-settings-page">
      <header className="admin-meal-header">
        <div><h1>System Settings</h1><p>Manage wing administrators and hall-wide access settings.</p></div>
        {tab === 'accounts' ? <Button onClick={openCreate}><Plus size={16} /> Add Wing Admin</Button> : null}
      </header>

      {/* Role permissions are the super admin's own lever — never expose it to a role that
          could then grant itself more than it was given. */}
      {isSuperAdmin ? (
        <div className="settings-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'accounts'}
            className={`settings-tab${tab === 'accounts' ? ' is-active' : ''}`}
            onClick={() => setTab('accounts')}
          >
            <Users size={16} /> Administrator Accounts
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'permissions'}
            className={`settings-tab${tab === 'permissions' ? ' is-active' : ''}`}
            onClick={() => setTab('permissions')}
          >
            <KeyRound size={16} /> Role Permissions
          </button>
        </div>
      ) : null}

      {isSuperAdmin && tab === 'permissions' ? <RolePermissionMatrix /> : null}

      {tab === 'permissions' && isSuperAdmin ? null : (
      <>
      {error && !editing ? <div className="student-message student-message-error">{error}</div> : null}

      <section className="settings-summary-grid">
        <article><ShieldCheck size={22} /><div><strong>Super Admin</strong><span>Full access to both wings and settings</span></div></article>
        <article><UserCheck size={22} /><div><strong>Male Wing Admin</strong><span>Male students and operations only</span></div></article>
        <article><UserCheck size={22} /><div><strong>Female Wing Admin</strong><span>Female students and operations only</span></div></article>
      </section>

      <section className="admin-meal-menu-section">
        <div className="admin-meal-section-head"><div><h2>Wing Administrators</h2><p>Accounts are scoped to their assigned wing.</p></div></div>
        <div className="admin-meal-table-wrap">
          <table className="admin-meal-table">
            <thead><tr><th>Name</th><th>Wing</th><th>Login</th><th>Designation</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              {admins.map((admin) => (
                <tr key={admin.id}>
                  <td><strong>{admin.fullName}</strong></td>
                  <td><span className={`wing-pill is-${admin.wing?.toLowerCase()}`}>{admin.wing} Wing</span></td>
                  <td>{admin.email}<small className="settings-username">@{admin.userName}</small></td>
                  <td>{admin.designation}</td>
                  <td>{admin.isActive ? <span className="settings-active"><UserCheck size={14} /> Active</span> : <span className="settings-inactive"><UserX size={14} /> Disabled</span>}</td>
                  <td><button type="button" className="settings-edit" onClick={() => openEdit(admin)}><Edit2 size={15} /> Edit</button></td>
                </tr>
              ))}
              {!admins.length ? <tr><td colSpan="6" className="settings-empty">No wing administrator accounts yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>

      <Modal isOpen={Boolean(editing)} onClose={() => setEditing(null)} title={editing === 'new' ? 'Create Wing Administrator' : 'Edit Wing Administrator'}>
        <form className="admin-meal-form" onSubmit={save}>
          {error ? <div className="admin-meal-form-error"><ShieldCheck size={19} /><div><strong>Could not save account</strong><span>{error}</span></div></div> : null}
          <div>
            <label>Full Name<input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} required /></label>
            <label>Admin Type<select value={form.role} onChange={(e) => updateRole(e.target.value)}><option value="male_wing_admin">Male Wing Admin</option><option value="female_wing_admin">Female Wing Admin</option></select></label>
          </div>
          <div>
            <label>Email<input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
            <label>Username<input value={form.userName} onChange={(e) => setForm({ ...form, userName: e.target.value })} required /></label>
          </div>
          <label>Designation<input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} required /></label>
          <label>{editing === 'new' ? 'Temporary Password' : 'New Password (optional)'}<input type="password" minLength="8" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={editing === 'new'} /></label>
          <label className="settings-active-toggle"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Account is active</label>
          <div className="payment-review-actions"><Button variant="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Administrator'}</Button></div>
        </form>
      </Modal>
      </>
      )}
    </div>
  );
}
