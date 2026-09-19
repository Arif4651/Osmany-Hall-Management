import { useState, useCallback, useEffect, useRef } from 'react';
import {
  BarChart2, ChevronLeft, ChevronRight, X, Search, ChevronsUpDown,
  ChevronUp, ChevronDown, Download, User, AlertCircle, Loader2,
} from 'lucide-react';
import { adminDataService } from '../../services/adminDataService';
import { useToast } from '../../context/ToastContext';
import { DEPARTMENTS, STUDENT_LEVELS, HALL_NAMES } from '../../types/student.types';
import { utils, writeFile } from 'xlsx';

// ── helpers ─────────────────────────────────────────────────────────────────

function monthLabel(year, month) {
  return new Date(year, month - 1, 1).toLocaleString('default', { month: 'long', year: 'numeric' });
}

function todayYearMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function parseYearMonth(str) {
  const [y, m] = str.split('-').map(Number);
  return { year: y, month: m };
}

// ── sub-components ───────────────────────────────────────────────────────────

const SummaryCard = ({ label, value, sub, color }) => (
  <div
    style={{
      background: '#ffffff',
      border: '1px solid var(--border)',
      borderRadius: '10px',
      padding: '0.9rem 1.1rem',
      flex: '1 1 140px',
      minWidth: 0,
      borderTop: `3px solid ${color}`,
    }}
  >
    <div style={{ fontSize: '0.78rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.3rem' }}>
      {label}
    </div>
    <div style={{ fontSize: '1.65rem', fontWeight: 800, color: '#111', lineHeight: 1 }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: '0.76rem', color: 'var(--muted)', marginTop: '0.25rem' }}>{sub}</div>}
  </div>
);

const MealBadge = ({ isOn }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '2.1rem',
      height: '1.7rem',
      borderRadius: '5px',
      fontSize: '0.72rem',
      fontWeight: 700,
      border: isOn ? '1.5px solid #16a34a' : '1.5px solid #e2e8f0',
      background: isOn ? '#dcfce7' : '#f8fafc',
      color: isOn ? '#15803d' : '#94a3b8',
    }}
  >
    {isOn ? 'ON' : 'OFF'}
  </span>
);

const SortIcon = ({ field, sortBy, sortAsc }) => {
  if (sortBy !== field) return <ChevronsUpDown size={13} style={{ marginLeft: '3px', opacity: 0.4 }} />;
  return sortAsc ? <ChevronUp size={13} style={{ marginLeft: '3px' }} /> : <ChevronDown size={13} style={{ marginLeft: '3px' }} />;
};

// ── main component ───────────────────────────────────────────────────────────

/**
 * Monthly Meal-Off Analysis section.
 *
 * Props:
 *  - activeWing: resolved wing string ('Male' | 'Female' | null for super-admin)
 *  - isWingAdmin: bool — if true, wing dropdown is locked
 */
export default function MonthlyMealAnalysis({ activeWing, isWingAdmin }) {
  const toast = useToast();

  // ── collapse / expand ──────────────────────────────────────────────────────
  const [isExpanded, setIsExpanded] = useState(false);

  // ── filter state ───────────────────────────────────────────────────────────
  const [analysisMonth, setAnalysisMonth] = useState(todayYearMonth);
  const [wingFilter, setWingFilter] = useState(activeWing ?? 'All');
  const [hallFilter, setHallFilter] = useState('All');
  const [deptFilter, setDeptFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  // ── pagination / sort ──────────────────────────────────────────────────────
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState('totalOff');
  const [sortAsc, setSortAsc] = useState(false);

  // ── ranking data ───────────────────────────────────────────────────────────
  const [rankingData, setRankingData] = useState(null);
  const [rankingLoading, setRankingLoading] = useState(false);
  const [rankingError, setRankingError] = useState('');

  // ── student detail ─────────────────────────────────────────────────────────
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const detailRef = useRef(null);

  // Keep wing filter in sync with parent's resolved wing (when admin changes the
  // gender selector on the parent Meal Sheet page, reflect that here too).
  useEffect(() => {
    if (isWingAdmin) {
      setWingFilter(activeWing ?? 'All');
    }
  }, [activeWing, isWingAdmin]);

  // Reset page on any filter change.
  useEffect(() => {
    setPage(1);
  }, [analysisMonth, wingFilter, hallFilter, deptFilter, levelFilter, appliedSearch, pageSize, sortBy, sortAsc]);

  // ── fetch ranking ──────────────────────────────────────────────────────────
  const fetchRanking = useCallback(async () => {
    if (!isExpanded) return;
    setRankingLoading(true);
    setRankingError('');
    try {
      const { year, month } = parseYearMonth(analysisMonth);
      const wing = wingFilter === 'All' ? undefined : wingFilter;
      const hall = hallFilter === 'All' ? undefined : hallFilter;
      const dept = deptFilter === 'all' ? undefined : deptFilter;
      const lvl  = levelFilter === 'all' ? undefined : levelFilter;
      const search = appliedSearch || undefined;

      const data = await adminDataService.getMonthlyMealAnalysis({
        month, year, wing, hall, department: dept, level: lvl, search,
        page, pageSize, sortBy, sortAsc,
      });
      setRankingData(data);
    } catch (err) {
      setRankingError(err instanceof Error ? err.message : 'Failed to load monthly analysis.');
    } finally {
      setRankingLoading(false);
    }
  }, [isExpanded, analysisMonth, wingFilter, hallFilter, deptFilter, levelFilter, appliedSearch, page, pageSize, sortBy, sortAsc]);

  useEffect(() => {
    fetchRanking();
  }, [fetchRanking]);

  // ── fetch student detail ───────────────────────────────────────────────────
  const fetchDetail = useCallback(async (studentRecordId) => {
    if (!studentRecordId) { setDetailData(null); return; }
    setDetailLoading(true);
    setDetailError('');
    try {
      const { year, month } = parseYearMonth(analysisMonth);
      const wing = wingFilter === 'All' ? undefined : wingFilter;
      const data = await adminDataService.getStudentMonthlyMealDetail(studentRecordId, month, year, wing);
      setDetailData(data);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'Failed to load student detail.');
    } finally {
      setDetailLoading(false);
    }
  }, [analysisMonth, wingFilter]);

  const selectStudent = useCallback((studentRecordId) => {
    setSelectedStudentId(studentRecordId);
    fetchDetail(studentRecordId);
    // scroll to detail panel after next paint
    setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
  }, [fetchDetail]);

  const closeDetail = useCallback(() => {
    setSelectedStudentId(null);
    setDetailData(null);
    setDetailError('');
  }, []);

  // When month/wing changes while a student is selected, refresh detail automatically.
  useEffect(() => {
    if (selectedStudentId) fetchDetail(selectedStudentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysisMonth, wingFilter]);

  // ── sort toggle ────────────────────────────────────────────────────────────
  const toggleSort = (field) => {
    if (sortBy === field) setSortAsc(a => !a);
    else { setSortBy(field); setSortAsc(false); }
  };

  // ── search bar ─────────────────────────────────────────────────────────────
  const handleSearchKey = (e) => {
    if (e.key === 'Enter') { setAppliedSearch(searchInput); setPage(1); }
  };

  // ── export ─────────────────────────────────────────────────────────────────
  const exportRankingExcel = () => {
    if (!rankingData?.rows?.length) return;
    const { year, month } = parseYearMonth(analysisMonth);
    const rows = rankingData.rows.map(r => ({
      'Rank': r.rank,
      'Student Name': r.studentName,
      'Student ID': r.studentId,
      'Hall': r.hallName,
      'Room': r.roomNo,
      'Department': r.department,
      'Level': r.level,
      'Breakfast OFF': r.breakfastOff,
      'Lunch OFF': r.lunchOff,
      'Dinner OFF': r.dinnerOff,
      'Total OFF': r.totalOff,
      'Total Applicable': r.totalApplicable,
      'OFF %': r.offPercent,
    }));
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.json_to_sheet(rows), 'Monthly OFF Ranking');
    writeFile(book, `meal-off-ranking-${year}-${String(month).padStart(2, '0')}.xlsx`);
    toast.success('Exported', `${rows.length} rows exported.`);
  };

  // ── derived ────────────────────────────────────────────────────────────────
  const { year: selYear, month: selMonth } = parseYearMonth(analysisMonth);
  const summary = rankingData?.summary;
  const totalPages = rankingData?.totalPages ?? 0;
  const totalRows = rankingData?.totalRows ?? 0;

  const availableHalls = isWingAdmin
    ? (activeWing === 'Female' ? [] : HALL_NAMES.filter(h => h !== 'Osmany Hall-Female'))
    : (wingFilter === 'Female' ? [] : HALL_NAMES.filter(h => h !== 'Osmany Hall-Female'));

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <section
      className="financial-card"
      style={{ marginTop: '1.5rem', padding: 0, overflow: 'hidden' }}
      id="monthly-meal-analysis"
      aria-label="Monthly Meal Analysis section"
    >
      {/* ── Section header (always visible) ─────────────────────────────── */}
      <button
        type="button"
        onClick={() => setIsExpanded(v => !v)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.9rem 1.25rem',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
          textAlign: 'left',
          gap: '0.75rem',
        }}
        aria-expanded={isExpanded}
        aria-controls="monthly-analysis-body"
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <BarChart2 size={18} style={{ color: '#3730a3', flexShrink: 0 }} />
          <span style={{ fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
            Monthly Meal Analysis
          </span>
          {rankingData && (
            <span style={{
              background: '#eef2ff', color: '#3730a3',
              borderRadius: '20px', padding: '0.15rem 0.6rem',
              fontSize: '0.76rem', fontWeight: 700,
            }}>
              {monthLabel(selYear, selMonth)}
            </span>
          )}
        </span>
        {isExpanded ? <ChevronUp size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />}
      </button>

      {/* ── Collapsible body ─────────────────────────────────────────────── */}
      {isExpanded && (
        <div id="monthly-analysis-body" style={{ padding: '1.25rem' }}>

          {/* ── Filters ───────────────────────────────────────────────────── */}
          <div
            className="wing-filter-bar"
            style={{ flexWrap: 'wrap', marginBottom: '1.25rem', gap: '0.6rem' }}
          >
            {/* Month picker */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                id="analysis-month-picker"
                type="month"
                value={analysisMonth}
                onChange={e => { setAnalysisMonth(e.target.value); setPage(1); }}
                style={{
                  padding: '0.5rem 0.75rem',
                  borderRadius: '6px',
                  border: '1px solid var(--border)',
                  background: '#fff',
                  color: 'var(--text)',
                  fontSize: '0.9rem',
                  outline: 'none',
                }}
              />
            </div>

            {/* Wing filter (locked for wing admins) */}
            {isWingAdmin ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: activeWing === 'Female' ? '#fce7f3' : '#dbeafe',
                color: activeWing === 'Female' ? '#9d174d' : '#1e40af',
                border: `1px solid ${activeWing === 'Female' ? '#f9a8d4' : '#93c5fd'}`,
                borderRadius: '6px', padding: '0.4rem 0.9rem', fontWeight: 600, fontSize: '0.85rem',
              }}>
                {activeWing} Wing Only
              </span>
            ) : (
              <select
                value={wingFilter}
                onChange={e => { setWingFilter(e.target.value); setHallFilter('All'); setPage(1); }}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
              >
                <option value="All">All Gender</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            )}

            {/* Hall filter (only for male wing) */}
            {availableHalls.length > 1 && (
              <select
                value={hallFilter}
                onChange={e => { setHallFilter(e.target.value); setPage(1); }}
                style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
              >
                <option value="All">All Halls</option>
                {availableHalls.map(h => <option key={h} value={h}>{h}</option>)}
              </select>
            )}

            {/* Department filter */}
            <select
              value={deptFilter}
              onChange={e => { setDeptFilter(e.target.value); setPage(1); }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Level filter */}
            <select
              value={levelFilter}
              onChange={e => { setLevelFilter(e.target.value); setPage(1); }}
              style={{ padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', cursor: 'pointer' }}
            >
              <option value="all">All Levels</option>
              {STUDENT_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>

            {/* Search */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Search size={15} style={{ position: 'absolute', left: '0.6rem', color: 'var(--muted)', pointerEvents: 'none' }} />
              <input
                type="text"
                placeholder="Name or Student ID…"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                onKeyDown={handleSearchKey}
                style={{
                  padding: '0.5rem 0.75rem 0.5rem 2rem',
                  borderRadius: '6px', border: '1px solid var(--border)',
                  background: '#fff', color: 'var(--text)', fontSize: '0.9rem', outline: 'none', width: '200px',
                }}
              />
              {searchInput && (
                <button type="button" onClick={() => { setSearchInput(''); setAppliedSearch(''); setPage(1); }}
                  style={{ position: 'absolute', right: '0.5rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}>
                  <X size={14} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="btn btn-primary"
              style={{ padding: '0.5rem 1rem', fontSize: '0.88rem' }}
              onClick={() => { setAppliedSearch(searchInput); setPage(1); }}
            >
              Search
            </button>
          </div>

          {/* ── Error ─────────────────────────────────────────────────────── */}
          {rankingError && (
            <div className="student-message student-message-error" style={{ marginBottom: '1rem' }}>
              {rankingError}
            </div>
          )}

          {/* ── Summary cards ─────────────────────────────────────────────── */}
          {summary && (
            <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
              <SummaryCard label="Total Students" value={summary.totalStudents} color="#6366f1" />
              <SummaryCard
                label="Students w/ ≥1 OFF"
                value={summary.studentsWithAtLeastOneOff}
                sub={summary.totalStudents > 0 ? `${((summary.studentsWithAtLeastOneOff / summary.totalStudents) * 100).toFixed(1)}% of total` : ''}
                color="#f59e0b"
              />
              <SummaryCard label="Total OFF Meals" value={summary.totalOffMeals} color="#ef4444" />
              <SummaryCard
                label="Avg OFF / Student"
                value={summary.averageOffPerStudent}
                sub="meals this month"
                color="#8b5cf6"
              />
            </div>
          )}

          {/* ── Ranking section ────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#334155' }}>
              Meal-Off Frequency Ranking
              {rankingData && !rankingLoading && (
                <span style={{ fontWeight: 400, color: 'var(--muted)', marginLeft: '0.5rem', fontSize: '0.82rem' }}>
                  {totalRows} student{totalRows !== 1 ? 's' : ''} · sorted by Total OFF ↓
                </span>
              )}
            </div>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportRankingExcel}
              disabled={!rankingData?.rows?.length}
              title="Export ranking to Excel"
              style={{ padding: '0.45rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.84rem' }}
            >
              <Download size={14} /> Export
            </button>
          </div>

          {/* ── Table ─────────────────────────────────────────────────────── */}
          <div className="table-wrap" style={{ overflowX: 'auto' }} role="region" aria-label="Monthly meal-off ranking table">
            <table className="data-table" style={{ fontSize: '0.84rem' }}>
              <thead>
                <tr>
                  <th style={{ width: '3rem', textAlign: 'center' }}>#</th>
                  <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    Student Name <SortIcon field="name" sortBy={sortBy} sortAsc={sortAsc} />
                  </th>
                  <th>Student ID</th>
                  <th>Hall</th>
                  <th onClick={() => toggleSort('breakfastOff')} style={{ cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    B-OFF <SortIcon field="breakfastOff" sortBy={sortBy} sortAsc={sortAsc} />
                  </th>
                  <th onClick={() => toggleSort('lunchOff')} style={{ cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    L-OFF <SortIcon field="lunchOff" sortBy={sortBy} sortAsc={sortAsc} />
                  </th>
                  <th onClick={() => toggleSort('dinnerOff')} style={{ cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    D-OFF <SortIcon field="dinnerOff" sortBy={sortBy} sortAsc={sortAsc} />
                  </th>
                  <th onClick={() => toggleSort('totalOff')} style={{ cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    Total OFF <SortIcon field="totalOff" sortBy={sortBy} sortAsc={sortAsc} />
                  </th>
                  <th onClick={() => toggleSort('offPercent')} style={{ cursor: 'pointer', textAlign: 'center', whiteSpace: 'nowrap' }}>
                    OFF % <SortIcon field="offPercent" sortBy={sortBy} sortAsc={sortAsc} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {rankingLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      {Array.from({ length: 9 }).map((_, j) => (
                        <td key={j}>
                          <div style={{ height: '1rem', background: '#e2e8f0', borderRadius: '4px', animation: 'pulse 1.5s ease-in-out infinite', width: j === 1 ? '10rem' : '4rem' }} />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : !rankingData?.rows?.length ? (
                  <tr>
                    <td colSpan={9} style={{ textAlign: 'center', color: 'var(--muted)', padding: '2.5rem 1rem' }}>
                      {appliedSearch || deptFilter !== 'all' || levelFilter !== 'all' || hallFilter !== 'All'
                        ? 'No students found matching the selected filters.'
                        : `No meal data found for ${monthLabel(selYear, selMonth)}.`}
                    </td>
                  </tr>
                ) : (
                  rankingData.rows.map(row => (
                    <tr
                      key={row.studentRecordId}
                      onClick={() => selectStudent(row.studentRecordId)}
                      style={{
                        cursor: 'pointer',
                        background: selectedStudentId === row.studentRecordId ? '#eef2ff' : undefined,
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={e => { if (selectedStudentId !== row.studentRecordId) e.currentTarget.style.background = '#f8fafc'; }}
                      onMouseLeave={e => { if (selectedStudentId !== row.studentRecordId) e.currentTarget.style.background = ''; }}
                      title="Click to view student detail"
                    >
                      <td style={{ textAlign: 'center', color: 'var(--muted)', fontWeight: 600 }}>{row.rank}</td>
                      <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{row.studentName}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.82rem' }}>{row.studentId}</td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--muted)' }}>{row.hallName}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: row.breakfastOff > 0 ? '#dc2626' : '#94a3b8' }}>{row.breakfastOff}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: row.lunchOff > 0 ? '#dc2626' : '#94a3b8' }}>{row.lunchOff}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{ fontWeight: 700, color: row.dinnerOff > 0 ? '#dc2626' : '#94a3b8' }}>{row.dinnerOff}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block',
                          background: row.totalOff === 0 ? '#f0fdf4' : row.offPercent >= 50 ? '#fef2f2' : '#fff7ed',
                          color: row.totalOff === 0 ? '#15803d' : row.offPercent >= 50 ? '#dc2626' : '#ea580c',
                          border: `1px solid ${row.totalOff === 0 ? '#bbf7d0' : row.offPercent >= 50 ? '#fecaca' : '#fed7aa'}`,
                          borderRadius: '20px', padding: '0.15rem 0.55rem',
                          fontWeight: 700, fontSize: '0.82rem',
                        }}>
                          {row.totalOff}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 600, color: row.offPercent === 0 ? '#15803d' : row.offPercent >= 50 ? '#dc2626' : '#ea580c' }}>
                        {row.offPercent}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ─────────────────────────────────────────────────── */}
          {totalRows > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem', color: 'var(--muted)' }}>
                <span>Rows:</span>
                <select
                  value={pageSize}
                  onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                  style={{ padding: '0.2rem 0.4rem', borderRadius: '4px', border: '1px solid var(--border)', background: '#fff', fontSize: '0.83rem' }}
                >
                  {[10, 25, 50, 100].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <span style={{ fontWeight: 600 }}>
                  {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, totalRows)} of {totalRows}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <button type="button" className="btn btn-secondary" disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))} style={{ padding: '0.3rem 0.55rem' }}>
                  <ChevronLeft size={15} />
                </button>
                {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                  let pNum;
                  if (totalPages <= 7) pNum = i + 1;
                  else if (page <= 4) pNum = i + 1;
                  else if (page >= totalPages - 3) pNum = totalPages - 6 + i;
                  else pNum = page - 3 + i;
                  if (pNum < 1 || pNum > totalPages) return null;
                  return (
                    <button key={pNum} type="button" onClick={() => setPage(pNum)}
                      className={`btn ${pNum === page ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ padding: '0.3rem 0.6rem', fontSize: '0.83rem', minWidth: '2rem', justifyContent: 'center', border: pNum === page ? 'none' : '1px solid var(--border)' }}>
                      {pNum}
                    </button>
                  );
                })}
                <button type="button" className="btn btn-secondary" disabled={page >= totalPages}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))} style={{ padding: '0.3rem 0.55rem' }}>
                  <ChevronRight size={15} />
                </button>
              </div>
            </div>
          )}

          {/* ── Student Detail Panel ───────────────────────────────────────── */}
          {selectedStudentId && (
            <div
              ref={detailRef}
              style={{
                marginTop: '1.5rem',
                border: '1.5px solid #818cf8',
                borderRadius: '10px',
                background: '#f8faff',
                overflow: 'hidden',
              }}
              id="monthly-student-detail"
              aria-label="Student monthly meal detail"
            >
              {/* Detail header */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.8rem 1.1rem', background: '#eef2ff', borderBottom: '1px solid #c7d2fe',
              }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700, color: '#3730a3', fontSize: '0.95rem' }}>
                  <User size={16} />
                  Student Monthly Detail — {monthLabel(selYear, selMonth)}
                </span>
                <button type="button" onClick={closeDetail}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'flex', padding: '0.25rem' }}
                  aria-label="Close student detail">
                  <X size={18} />
                </button>
              </div>

              <div style={{ padding: '1.1rem' }}>
                {detailLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--muted)', padding: '1rem 0' }}>
                    <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Loading student data…
                  </div>
                ) : detailError ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#dc2626' }}>
                    <AlertCircle size={16} /> {detailError}
                  </div>
                ) : detailData ? (
                  <>
                    {/* Student info row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem', alignItems: 'flex-start' }}>
                      <div style={{ minWidth: '10rem' }}>
                        <div style={{ fontWeight: 800, fontSize: '1.05rem', color: '#1e293b' }}>{detailData.studentName}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--muted)', fontFamily: 'monospace' }}>{detailData.studentId}</div>
                      </div>
                      {[
                        ['Hall', detailData.hallName],
                        ['Room', detailData.roomNo || '—'],
                        ['Dept', detailData.department],
                        ['Level', detailData.level],
                        ['Gender', detailData.gender],
                      ].map(([label, val]) => (
                        <div key={label} style={{ minWidth: '5rem' }}>
                          <div style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem', color: '#334155' }}>{val}</div>
                        </div>
                      ))}
                    </div>

                    {/* Meal statistics grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                      {[
                        { label: 'Breakfast', on: detailData.breakfastOn, off: detailData.breakfastOff, color: '#2563eb' },
                        { label: 'Lunch',     on: detailData.lunchOn,     off: detailData.lunchOff,     color: '#16a34a' },
                        { label: 'Dinner',    on: detailData.dinnerOn,    off: detailData.dinnerOff,    color: '#d97706' },
                      ].map(({ label, on, off, color }) => (
                        <div key={label} style={{
                          background: '#fff', border: `1.5px solid ${color}22`,
                          borderTop: `3px solid ${color}`, borderRadius: '8px', padding: '0.7rem 0.9rem',
                        }}>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color, marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
                          <div style={{ display: 'flex', gap: '0.6rem' }}>
                            <div>
                              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#15803d' }}>{on}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>ON</div>
                            </div>
                            <div style={{ width: '1px', background: '#e2e8f0', margin: '0 0.1rem' }} />
                            <div>
                              <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#dc2626' }}>{off}</div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>OFF</div>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Totals card */}
                      <div style={{
                        background: '#fff', border: '1.5px solid #e2e8f0',
                        borderTop: '3px solid #6366f1', borderRadius: '8px', padding: '0.7rem 0.9rem',
                        gridColumn: 'span 1',
                      }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#6366f1', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Overall</div>
                        <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                          <div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#15803d' }}>{detailData.totalOn}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Total ON</div>
                          </div>
                          <div style={{ width: '1px', background: '#e2e8f0', margin: '0 0.1rem' }} />
                          <div>
                            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#dc2626' }}>{detailData.totalOff}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Total OFF</div>
                          </div>
                          <div style={{ width: '1px', background: '#e2e8f0', margin: '0 0.1rem' }} />
                          <div>
                            <div style={{
                              fontSize: '1.3rem', fontWeight: 800,
                              color: detailData.offPercent === 0 ? '#15803d' : detailData.offPercent >= 50 ? '#dc2626' : '#ea580c',
                            }}>
                              {detailData.offPercent}%
                            </div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>OFF %</div>
                          </div>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginTop: '0.35rem' }}>
                          of {detailData.totalApplicable} applicable meals
                        </div>
                      </div>
                    </div>

                    {/* Daily breakdown table */}
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#334155', marginBottom: '0.6rem' }}>
                      Day-by-Day Breakdown
                    </div>
                    <div className="table-wrap" style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.83rem' }}>
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th style={{ textAlign: 'center' }}>Breakfast</th>
                            <th style={{ textAlign: 'center' }}>Lunch</th>
                            <th style={{ textAlign: 'center' }}>Dinner</th>
                            <th style={{ textAlign: 'center' }}>OFF count</th>
                          </tr>
                        </thead>
                        <tbody>
                          {detailData.dailyBreakdown.map(row => {
                            const offCount = [row.breakfastOn, row.lunchOn, row.dinnerOn].filter(v => !v).length;
                            return (
                              <tr key={row.date}
                                style={{ background: offCount === 3 ? '#fff1f2' : offCount > 0 ? '#fffbf0' : undefined }}>
                                <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                                  {new Date(row.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)', marginLeft: '0.35rem' }}>
                                    {new Date(row.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'short' })}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}><MealBadge isOn={row.breakfastOn} /></td>
                                <td style={{ textAlign: 'center' }}><MealBadge isOn={row.lunchOn} /></td>
                                <td style={{ textAlign: 'center' }}><MealBadge isOn={row.dinnerOn} /></td>
                                <td style={{ textAlign: 'center' }}>
                                  {offCount > 0 ? (
                                    <span style={{
                                      display: 'inline-block',
                                      background: offCount === 3 ? '#fef2f2' : '#fff7ed',
                                      color: offCount === 3 ? '#dc2626' : '#ea580c',
                                      border: `1px solid ${offCount === 3 ? '#fecaca' : '#fed7aa'}`,
                                      borderRadius: '12px', padding: '0.1rem 0.45rem',
                                      fontWeight: 700, fontSize: '0.78rem',
                                    }}>
                                      {offCount}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#94a3b8', fontSize: '0.78rem' }}>—</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
