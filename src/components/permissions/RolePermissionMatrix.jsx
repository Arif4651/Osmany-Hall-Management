import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Plus, ShieldCheck, Trash2, TriangleAlert } from 'lucide-react';
import Button from '../ui/Button';
import Modal from '../ui/Modal';
import { permissionService } from '../../services/permissionService';
import { useAuth } from '../../context/AuthContext';

const ACTIONS = [
  { key: 'canView', label: 'View' },
  { key: 'canCreate', label: 'Create' },
  { key: 'canEdit', label: 'Edit' },
  { key: 'canDelete', label: 'Delete' },
];

/** Depth-first walk so parents are always visited before their children. */
function flatten(nodes, depth = 0, out = []) {
  for (const node of nodes) {
    out.push({ ...node, depth, hasChildren: node.children?.length > 0 });
    if (node.children?.length) flatten(node.children, depth + 1, out);
  }
  return out;
}

function collectKeys(node, out = []) {
  out.push(node.key);
  for (const child of node.children ?? []) collectKeys(child, out);
  return out;
}

function findNode(nodes, key) {
  for (const node of nodes) {
    if (node.key === key) return node;
    const hit = findNode(node.children ?? [], key);
    if (hit) return hit;
  }
  return null;
}

/** Every ancestor of `key`, nearest first — used to auto-grant the path to a checked child. */
function ancestorsOf(nodes, key, trail = []) {
  for (const node of nodes) {
    if (node.key === key) return trail;
    const hit = ancestorsOf(node.children ?? [], key, [...trail, node.key]);
    if (hit) return hit;
  }
  return null;
}

export default function RolePermissionMatrix() {
  const { refreshPermissions, role: myRole } = useAuth();

  const [roles, setRoles] = useState([]);
  const [selectedRole, setSelectedRole] = useState('');
  const [matrix, setMatrix] = useState(null);
  const [grants, setGrants] = useState({});
  const [collapsed, setCollapsed] = useState(() => new Set());

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [roleForm, setRoleForm] = useState({ key: '', label: '', area: 'admin' });

  const loadRoles = useCallback(async () => {
    try {
      const rows = await permissionService.getRoles();
      setRoles(rows);
      setSelectedRole((current) => current || rows.find((r) => r.key !== 'super_admin')?.key || rows[0]?.key || '');
      setError('');
    } catch (loadError) {
      setError(loadError.message);
    }
  }, []);

  useEffect(() => { loadRoles(); }, [loadRoles]);

  const loadMatrix = useCallback(async (role) => {
    if (!role) return;
    setLoading(true);
    setMessage('');
    try {
      const result = await permissionService.getRoleMatrix(role);
      setMatrix(result);
      const next = {};
      for (const row of flatten(result.menus)) {
        next[row.key] = {
          canView: row.canView, canCreate: row.canCreate,
          canEdit: row.canEdit, canDelete: row.canDelete,
        };
      }
      setGrants(next);
      setError('');
    } catch (loadError) {
      setError(loadError.message);
      setMatrix(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMatrix(selectedRole); }, [selectedRole, loadMatrix]);

  const rows = useMemo(() => (matrix ? flatten(matrix.menus) : []), [matrix]);

  // A collapsed ancestor hides its whole subtree.
  const visibleRows = useMemo(() => {
    if (!matrix) return [];
    const hidden = new Set();
    for (const key of collapsed) {
      const node = findNode(matrix.menus, key);
      if (node) for (const child of collectKeys(node).slice(1)) hidden.add(child);
    }
    return rows.filter((row) => !hidden.has(row.key));
  }, [rows, collapsed, matrix]);

  const isImmutable = Boolean(matrix?.isImmutable);

  const setGrant = useCallback((keys, action, value) => {
    setGrants((current) => {
      const next = { ...current };
      for (const key of keys) {
        next[key] = { ...(next[key] ?? {}), [action]: value };
      }
      return next;
    });
    setMessage('');
  }, []);

  /**
   * Toggling a node applies to its whole subtree, and switching one on also switches on the
   * same action for every ancestor — a page the role cannot reach is not a useful grant.
   */
  const toggleNode = useCallback((node, action, value) => {
    if (isImmutable) return;
    const keys = collectKeys(node);
    if (value && matrix) keys.push(...(ancestorsOf(matrix.menus, node.key) ?? []));
    setGrant(keys, action, value);
  }, [isImmutable, matrix, setGrant]);

  const toggleColumn = useCallback((action, value) => {
    if (isImmutable) return;
    setGrant(rows.map((row) => row.key), action, value);
  }, [isImmutable, rows, setGrant]);

  const columnState = useCallback((action) => {
    if (!rows.length) return 'none';
    const on = rows.filter((row) => grants[row.key]?.[action]).length;
    if (on === 0) return 'none';
    return on === rows.length ? 'all' : 'some';
  }, [rows, grants]);

  const toggleCollapse = (key) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const grantedCount = useMemo(
    () => rows.filter((row) => ACTIONS.some((a) => grants[row.key]?.[a.key])).length,
    [rows, grants],
  );

  const save = async () => {
    if (!selectedRole || isImmutable) return;
    setSaving(true);
    setError('');
    try {
      const payload = rows.map((row) => ({
        menuKey: row.key,
        canView: Boolean(grants[row.key]?.canView),
        canCreate: Boolean(grants[row.key]?.canCreate),
        canEdit: Boolean(grants[row.key]?.canEdit),
        canDelete: Boolean(grants[row.key]?.canDelete),
      }));
      await permissionService.saveRoleMatrix(selectedRole, payload);
      setMessage(`Permissions saved for ${matrix?.roleLabel ?? selectedRole}.`);
      // If the super admin just edited their own role, their nav must reflect it immediately.
      if (selectedRole === myRole) await refreshPermissions();
      await loadMatrix(selectedRole);
    } catch (saveError) {
      setError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const createRole = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      await permissionService.createRole(roleForm);
      setIsRoleModalOpen(false);
      setRoleForm({ key: '', label: '', area: 'admin' });
      await loadRoles();
      setSelectedRole(roleForm.key.trim().toLowerCase());
      setMessage('Role created. Assign its permissions below.');
    } catch (createError) {
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  };

  const deleteRole = async () => {
    const current = roles.find((r) => r.key === selectedRole);
    if (!current || current.isSystem) return;
    if (!window.confirm(`Delete the role "${current.label}"? This cannot be undone.`)) return;
    setSaving(true);
    try {
      await permissionService.deleteRole(selectedRole);
      setSelectedRole('');
      await loadRoles();
      setMessage('Role deleted.');
      setError('');
    } catch (deleteError) {
      setError(deleteError.message);
    } finally {
      setSaving(false);
    }
  };

  const activeRole = roles.find((r) => r.key === selectedRole);

  return (
    <section className="role-permissions">
      <header className="role-permissions-head">
        <div>
          <h2>Assign Role Permissions</h2>
          <p>Choose a role, then grant it exactly what it may view, create, edit and delete.</p>
        </div>
        <div className="role-permissions-head-actions">
          <Button variant="secondary" onClick={() => setIsRoleModalOpen(true)}>
            <Plus size={16} /> New Role
          </Button>
          {activeRole && !activeRole.isSystem ? (
            <Button variant="ghost" onClick={deleteRole} disabled={saving}>
              <Trash2 size={16} /> Delete Role
            </Button>
          ) : null}
        </div>
      </header>

      {message ? <div className="student-message student-message-success">{message}</div> : null}
      {error ? <div className="student-message student-message-error">{error}</div> : null}

      <label className="role-select-field">
        <span>Select Role</span>
        <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value)}>
          {!roles.length ? <option value="">No roles available</option> : null}
          {roles.map((role) => (
            <option key={role.key} value={role.key}>
              {role.label}{role.isSystem ? '' : ' (custom)'}
            </option>
          ))}
        </select>
      </label>

      {isImmutable ? (
        <div className="role-permissions-locked">
          <ShieldCheck size={18} />
          <div>
            <strong>Super Admin always has full access</strong>
            <span>
              This role is granted everything by definition and cannot be edited — it is the account
              that repairs the others.
            </span>
          </div>
        </div>
      ) : null}

      <div className="role-matrix-wrap">
        <table className="role-matrix">
          <thead>
            <tr>
              <th className="role-matrix-menu-col">Menu</th>
              {ACTIONS.map((action) => {
                const state = columnState(action.key);
                return (
                  <th key={action.key}>
                    <label className="role-matrix-col-toggle">
                      <input
                        type="checkbox"
                        checked={state === 'all'}
                        ref={(el) => { if (el) el.indeterminate = state === 'some'; }}
                        disabled={isImmutable || loading || !rows.length}
                        onChange={(e) => toggleColumn(action.key, e.target.checked)}
                      />
                      <span>{action.label}</span>
                    </label>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="role-matrix-empty">Loading permissions…</td></tr>
            ) : null}

            {!loading && !visibleRows.length ? (
              <tr><td colSpan={5} className="role-matrix-empty">No menus configured.</td></tr>
            ) : null}

            {!loading && visibleRows.map((row) => {
              const node = matrix ? findNode(matrix.menus, row.key) : null;
              const isSection = row.hasChildren;
              return (
                <tr key={row.key} className={isSection ? 'is-section' : undefined}>
                  <td>
                    <span
                      className="role-matrix-label"
                      style={{ paddingLeft: `${row.depth * 1.4}rem` }}
                    >
                      {isSection ? (
                        <button
                          type="button"
                          className="role-matrix-twisty"
                          onClick={() => toggleCollapse(row.key)}
                          aria-label={collapsed.has(row.key) ? `Expand ${row.label}` : `Collapse ${row.label}`}
                        >
                          {collapsed.has(row.key) ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
                        </button>
                      ) : (
                        <span className="role-matrix-leaf-dash">–</span>
                      )}
                      <span className={isSection ? 'role-matrix-section-name' : undefined}>{row.label}</span>
                    </span>
                  </td>
                  {ACTIONS.map((action) => (
                    <td key={action.key}>
                      <input
                        type="checkbox"
                        className="role-matrix-check"
                        checked={Boolean(grants[row.key]?.[action.key])}
                        disabled={isImmutable}
                        onChange={(e) => node && toggleNode(node, action.key, e.target.checked)}
                        aria-label={`${action.label} ${row.label}`}
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <footer className="role-permissions-foot">
        <span className="role-permissions-count">
          {grantedCount} of {rows.length} menus granted
        </span>
        <Button onClick={save} disabled={saving || loading || isImmutable || !selectedRole}>
          {saving ? 'Saving…' : 'Save Permissions'}
        </Button>
      </footer>

      <Modal
        isOpen={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        title="Create Role"
      >
        <form className="admin-meal-form" onSubmit={createRole}>
          <label>
            Role Key
            <input
              value={roleForm.key}
              onChange={(e) => setRoleForm({ ...roleForm, key: e.target.value })}
              placeholder="e.g. accounts_officer"
              required
            />
            <small className="role-form-hint">
              Lowercase letters, digits, underscores and hyphens. This is permanent.
            </small>
          </label>
          <label>
            Display Name
            <input
              value={roleForm.label}
              onChange={(e) => setRoleForm({ ...roleForm, label: e.target.value })}
              placeholder="e.g. Accounts Officer"
              required
            />
          </label>
          <label>
            Portal
            <select
              value={roleForm.area}
              onChange={(e) => setRoleForm({ ...roleForm, area: e.target.value })}
            >
              <option value="admin">Admin Console</option>
              <option value="student">Student Portal</option>
            </select>
          </label>
          <div className="role-form-note">
            <TriangleAlert size={17} />
            <span>A new role starts with no access at all until you grant it below.</span>
          </div>
          <div className="payment-review-actions">
            <Button variant="secondary" onClick={() => setIsRoleModalOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating…' : 'Create Role'}</Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
