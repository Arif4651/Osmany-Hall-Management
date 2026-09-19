import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Download, RefreshCw, X, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import {
  auditLogService,
  AUDIT_MODULES,
  AUDIT_ACTIONS,
  getActionBadgeClass,
} from '../../services/auditLogService';

const PAGE_SIZE = 50;
const DATE_PRESETS = [
  { label: 'Today', days: 0 },
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function dateFromPreset(days) {
  if (days === 0) return new Date().toISOString().slice(0, 10);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function formatDateTime(utcStr) {
  if (!utcStr) return '—';
  return new Date(utcStr).toLocaleString('en-US', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: true,
  });
}

function RoleChip({ role }) {
  const label = {
    super_admin: 'Super Admin',
    admin: 'Admin',
    male_wing_admin: 'Male Wing Admin',
    female_wing_admin: 'Female Wing Admin',
    student: 'Student',
  }[role] ?? role;

  const cls = {
    super_admin: 'role-chip role-chip--super',
    admin: 'role-chip role-chip--admin',
    male_wing_admin: 'role-chip role-chip--male',
    female_wing_admin: 'role-chip role-chip--female',
    student: 'role-chip role-chip--student',
  }[role] ?? 'role-chip';

  return <span className={cls}>{label}</span>;
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className={`log-stat-card log-stat-card--${accent}`}>
      <div className="log-stat-icon">{icon}</div>
      <div className="log-stat-body">
        <span className="log-stat-value">{value ?? '—'}</span>
        <span className="log-stat-label">{label}</span>
      </div>
    </div>
  );
}

// ── JSON pretty-viewer ──────────────────────────────────────────────────────
function JsonViewer({ label, json }) {
  if (!json) return null;
  let parsed;
  try { parsed = JSON.parse(json); } catch { parsed = json; }
  return (
    <div className="log-json-block">
      <p className="log-json-label">{label}</p>
      <pre className="log-json-content">{JSON.stringify(parsed, null, 2)}</pre>
    </div>
  );
}

// ── Detail Drawer ────────────────────────────────────────────────────────────
function LogDetailDrawer({ logId, onClose }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!logId) return;
    setLoading(true);
    auditLogService.getLog(logId)
      .then(setDetail)
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [logId]);

  return (
    <div className={`log-drawer-overlay ${logId ? 'is-open' : ''}`} onClick={onClose} role="presentation">
      <aside className="log-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Log detail">
        <div className="log-drawer-head">
          <h3>Log Detail</h3>
          <button type="button" className="log-drawer-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {loading && <div className="log-drawer-loading">Loading…</div>}

        {!loading && !detail && (
          <div className="log-drawer-empty">Could not load log detail.</div>
        )}

        {!loading && detail && (
          <div className="log-drawer-body">
            <div className="log-drawer-meta-grid">
              <div className="log-drawer-meta-item">
                <span className="log-drawer-meta-key">Timestamp (UTC)</span>
                <span className="log-drawer-meta-val">{formatDateTime(detail.timestampUtc)}</span>
              </div>
              <div className="log-drawer-meta-item">
                <span className="log-drawer-meta-key">Admin</span>
                <span className="log-drawer-meta-val">{detail.actor}</span>
              </div>
              <div className="log-drawer-meta-item">
                <span className="log-drawer-meta-key">Role</span>
                <span className="log-drawer-meta-val"><RoleChip role={detail.actorRole} /></span>
              </div>
              <div className="log-drawer-meta-item">
                <span className="log-drawer-meta-key">Module</span>
                <span className="log-drawer-meta-val">{detail.module}</span>
              </div>
              <div className="log-drawer-meta-item">
                <span className="log-drawer-meta-key">Action</span>
                <span className="log-drawer-meta-val">
                  <span className={`log-action-badge ${getActionBadgeClass(detail.action)}`}>{detail.action}</span>
                </span>
              </div>
              <div className="log-drawer-meta-item">
                <span className="log-drawer-meta-key">Status</span>
                <span className={`log-drawer-meta-val ${detail.isSuccess ? 'log-status-success' : 'log-status-fail'}`}>
                  {detail.isSuccess ? '✓ Success' : '✗ Failed'}
                </span>
              </div>
              <div className="log-drawer-meta-item log-drawer-meta-item--full">
                <span className="log-drawer-meta-key">Description</span>
                <span className="log-drawer-meta-val">{detail.description}</span>
              </div>
            </div>

            {(detail.oldValues || detail.newValues) && (
              <div className="log-drawer-changes">
                <h4 className="log-drawer-changes-title">Changes</h4>
                <JsonViewer label="Before" json={detail.oldValues} />
                <JsonViewer label="After" json={detail.newValues} />
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function AdminLogs() {
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [error, setError] = useState(null);

  // Filters
  const [selectedModule, setSelectedModule] = useState('All');
  const [selectedAction, setSelectedAction] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [activePreset, setActivePreset] = useState(null);

  const searchTimer = useRef(null);

  const fetchLogs = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: p,
        pageSize: PAGE_SIZE,
        ...(selectedModule && selectedModule !== 'All' ? { module: selectedModule } : {}),
        ...(selectedAction ? { action: selectedAction } : {}),
        ...(search ? { search } : {}),
        ...(fromDate ? { fromDate } : {}),
        ...(toDate ? { toDate } : {}),
      };
      const data = await auditLogService.getLogs(params);
      setLogs(data.items ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
      setPage(data.page ?? 1);
    } catch (err) {
      setError(err.message ?? 'Failed to load logs');
    } finally {
      setLoading(false);
    }
  }, [selectedModule, selectedAction, search, fromDate, toDate]);

  const fetchStats = useCallback(async () => {
    try {
      const s = await auditLogService.getStats();
      setStats(s);
    } catch {
      // Non-critical, silently ignore
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchLogs(1);
    fetchStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule, selectedAction, search, fromDate, toDate]);

  // Debounced search
  const handleSearchChange = (val) => {
    setSearchInput(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => setSearch(val.trim()), 400);
  };

  const applyPreset = (preset) => {
    setActivePreset(preset.days);
    if (preset.days === 0) {
      setFromDate(dateFromPreset(0));
      setToDate(dateFromPreset(0));
    } else {
      setFromDate(dateFromPreset(preset.days));
      setToDate('');
    }
  };

  const clearFilters = () => {
    setSelectedModule('All');
    setSelectedAction('');
    setSearch('');
    setSearchInput('');
    setFromDate('');
    setToDate('');
    setActivePreset(null);
  };

  const hasActiveFilters = selectedModule !== 'All' || selectedAction || search || fromDate || toDate;

  const exportParams = {
    ...(selectedModule && selectedModule !== 'All' ? { module: selectedModule } : {}),
    ...(selectedAction ? { action: selectedAction } : {}),
    ...(search ? { search } : {}),
    ...(fromDate ? { fromDate } : {}),
    ...(toDate ? { toDate } : {}),
  };

  return (
    <div className="page-container logs-page">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-text">
          <h1 className="page-title">System Logs</h1>
          <p className="page-subtitle">
            Complete audit trail of all administrative actions across the hall management system.
          </p>
        </div>
        <div className="logs-header-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => { fetchLogs(1); fetchStats(); }}
            title="Refresh logs"
          >
            <RefreshCw size={15} />
            <span>Refresh</span>
          </button>
          <a
            href={auditLogService.buildExportUrl(exportParams)}
            className="btn btn-secondary"
            target="_blank"
            rel="noreferrer"
            title="Export filtered logs as CSV"
          >
            <Download size={15} />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* ── Stats ──────────────────────────────────────────────────── */}
      {stats && (
        <div className="log-stats-row">
          <StatCard icon="📋" label="Total Logs" value={stats.totalLogs?.toLocaleString()} accent="blue" />
          <StatCard icon="📅" label="Today" value={stats.todayLogs?.toLocaleString()} accent="green" />
          <StatCard icon="🗓️" label="This Week" value={stats.thisWeekLogs?.toLocaleString()} accent="purple" />
          <StatCard icon="👤" label="Active Admins (30d)" value={stats.activeAdmins?.toLocaleString()} accent="orange" />
        </div>
      )}

      {/* ── Module Tabs ─────────────────────────────────────────────── */}
      <div className="log-module-tabs-wrap">
        <div className="log-module-tabs" role="tablist">
          {AUDIT_MODULES.map((m) => (
            <button
              key={m.value}
              type="button"
              role="tab"
              aria-selected={selectedModule === m.value}
              className={`log-module-tab ${selectedModule === m.value ? 'is-active' : ''}`}
              onClick={() => { setSelectedModule(m.value); setPage(1); }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Filter Bar ─────────────────────────────────────────────── */}
      <div className="log-filter-bar">
        {/* Search */}
        <div className="log-filter-search">
          <Search size={14} className="log-filter-search-icon" />
          <input
            id="logs-search"
            type="text"
            className="log-filter-input"
            placeholder="Search admin, action, description…"
            value={searchInput}
            onChange={(e) => handleSearchChange(e.target.value)}
          />
        </div>

        {/* Action filter */}
        <select
          id="logs-action-filter"
          className="log-filter-select"
          value={selectedAction}
          onChange={(e) => setSelectedAction(e.target.value)}
        >
          {AUDIT_ACTIONS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>

        {/* Date presets */}
        <div className="log-date-presets">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className={`log-date-preset ${activePreset === p.days ? 'is-active' : ''}`}
              onClick={() => applyPreset(p)}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom dates */}
        <div className="log-date-range">
          <input
            type="date"
            className="log-filter-date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => { setFromDate(e.target.value); setActivePreset(null); }}
            title="From date"
          />
          <span className="log-date-sep">–</span>
          <input
            type="date"
            className="log-filter-date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => { setToDate(e.target.value); setActivePreset(null); }}
            title="To date"
          />
        </div>

        {hasActiveFilters && (
          <button type="button" className="log-filter-clear" onClick={clearFilters} title="Clear all filters">
            <X size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────── */}
      <div className="log-table-wrap">
        {error && (
          <div className="student-message student-message-error" style={{ margin: '1rem 0' }}>
            {error}
          </div>
        )}

        {loading ? (
          <div className="log-table-loading">
            <div className="log-spinner" />
            <span>Loading logs…</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="log-table-empty">
            <p>No log entries found{hasActiveFilters ? ' matching the current filters' : ''}.</p>
          </div>
        ) : (
          <table className="log-table" aria-label="Audit log entries">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Admin</th>
                <th>Role</th>
                <th>Module</th>
                <th>Action</th>
                <th>Description</th>
                <th>Status</th>
                <th aria-label="Detail" />
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="log-table-row"
                  onClick={() => setSelectedLogId(log.id)}
                  title="Click to view detail"
                >
                  <td className="log-td-timestamp log-mono">{formatDateTime(log.timestampUtc)}</td>
                  <td className="log-td-actor">{log.actor}</td>
                  <td className="log-td-role"><RoleChip role={log.actorRole} /></td>
                  <td className="log-td-module">{log.module}</td>
                  <td className="log-td-action">
                    <span className={`log-action-badge ${getActionBadgeClass(log.action)}`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="log-td-desc">{log.description}</td>
                  <td className="log-td-status">
                    <span className={log.isSuccess ? 'log-status-success' : 'log-status-fail'}>
                      {log.isSuccess ? '✓' : '✗'}
                    </span>
                  </td>
                  <td className="log-td-detail">
                    <ExternalLink size={13} className="log-detail-icon" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {!loading && totalPages > 1 && (
        <div className="log-pagination">
          <span className="log-pagination-info">
            {total.toLocaleString()} entries · Page {page} of {totalPages}
          </span>
          <div className="log-pagination-controls">
            <button
              type="button"
              className="log-page-btn"
              disabled={page <= 1}
              onClick={() => fetchLogs(page - 1)}
              aria-label="Previous page"
            >
              <ChevronLeft size={15} />
            </button>

            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, Math.min(page - 2, totalPages - 4));
              const p = start + i;
              return (
                <button
                  key={p}
                  type="button"
                  className={`log-page-btn ${p === page ? 'is-current' : ''}`}
                  onClick={() => fetchLogs(p)}
                  aria-current={p === page ? 'page' : undefined}
                >
                  {p}
                </button>
              );
            })}

            <button
              type="button"
              className="log-page-btn"
              disabled={page >= totalPages}
              onClick={() => fetchLogs(page + 1)}
              aria-label="Next page"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>
      )}

      {/* ── Detail Drawer ───────────────────────────────────────────── */}
      <LogDetailDrawer
        logId={selectedLogId}
        onClose={() => setSelectedLogId(null)}
      />
    </div>
  );
}
