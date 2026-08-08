import { useCallback, useEffect, useState, useMemo } from 'react';
import { utils, writeFile } from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Calendar, Coffee, FileSpreadsheet, FileText, Printer, Search, ArrowUpDown, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { adminDataService } from '../../services/adminDataService';
import { useAuth } from '../../context/AuthContext';
import { todayLocal } from '../../utils/formatters';
import { useCachedFetch } from '../../hooks/useCachedFetch';
import { queryCache } from '../../services/queryCache';
import TableSkeleton from '../../components/ui/TableSkeleton';
import AdditionalItemsSheet from '../../components/admin/AdditionalItemsSheet';
import { MENU_KEYS } from '../../services/permissionService';


const defaultMealSheetDate = todayLocal();

const MealIndicator = ({ label, isOn }) => (
  <span
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '1.85rem',
      height: '1.85rem',
      borderRadius: '50%',
      fontWeight: 'bold',
      fontSize: '0.82rem',
      marginRight: '0.35rem',
      border: isOn ? '1.5px solid var(--success, #00a050)' : '1.5px solid var(--border, #dbe4f1)',
      background: isOn ? 'var(--success, #00a050)' : '#ffffff',
      color: isOn ? '#ffffff' : 'var(--muted, #5b6b84)',
      boxShadow: isOn ? '0 2px 4px rgba(0,160,80,0.2)' : 'none',
      transition: 'all 0.2s ease',
    }}
  >
    {label}
  </span>
);

export default function MealSheet() {
  useDocumentTitle('Meal Sheet');
  const { user, role, can } = useAuth();
  const isWingAdmin = role === 'male_wing_admin' || role === 'female_wing_admin';
  // Hidden for a role without this grant, same as the panels on Meal Management and Bill
  // Management — currently the male wing admin by default.
  const canSeeAdditional = can(MENU_KEYS.adminAdditionalItems, 'view');

  const [date, setDate] = useState(defaultMealSheetDate);
  // 'sheet' = the regular per-student meal roster; 'additional' = who took tea/etc that date.
  const [view, setView] = useState('sheet');

  // For wing admins the filter is permanently locked to their wing gender.
  // For super_admin/admin it starts as 'All' and can be changed via dropdown.
  const [genderFilter, setGenderFilter] = useState(() => {
    if (role === 'male_wing_admin') return 'Male';
    if (role === 'female_wing_admin') return 'Female';
    return 'All';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(20);

  // Sorting
  const [sortField, setSortField] = useState('room');
  const [sortAsc, setSortAsc] = useState(true);

  const mergeMealSheetResponses = useCallback((...responses) => {
    const valid = responses.filter(Boolean);
    if (!valid.length) return null;
    return {
      date: valid[0].date,
      totalStudents: valid.reduce((sum, item) => sum + (item.totalStudents || 0), 0),
      breakfastCount: valid.reduce((sum, item) => sum + (item.breakfastCount || 0), 0),
      lunchCount: valid.reduce((sum, item) => sum + (item.lunchCount || 0), 0),
      dinnerCount: valid.reduce((sum, item) => sum + (item.dinnerCount || 0), 0),
      rows: valid.flatMap((item) => item.rows || []),
    };
  }, []);

  const activeWing = isWingAdmin ? (user?.wing || 'Male') : genderFilter;
  const cacheKey = `mealsheet-${date}-${activeWing}`;

  const fetcher = useCallback(async () => {
    if (isWingAdmin) {
      return adminDataService.getMealSheet(date, user?.wing || 'Male');
    }
    if (genderFilter === 'All') {
      const maleKey = `mealsheet-${date}-Male`;
      const femaleKey = `mealsheet-${date}-Female`;

      const malePromise = queryCache.has(maleKey)
        ? Promise.resolve(queryCache.get(maleKey))
        : queryCache.dedupe(maleKey, () => adminDataService.getMealSheet(date, 'Male'));

      const femalePromise = queryCache.has(femaleKey)
        ? Promise.resolve(queryCache.get(femaleKey))
        : queryCache.dedupe(femaleKey, () => adminDataService.getMealSheet(date, 'Female'));

      const [maleData, femaleData] = await Promise.all([malePromise, femalePromise]);

      queryCache.set(maleKey, maleData, 30_000);
      queryCache.set(femaleKey, femaleData, 30_000);

      return mergeMealSheetResponses(maleData, femaleData);
    }
    return adminDataService.getMealSheet(date, genderFilter);
  }, [date, genderFilter, isWingAdmin, user?.wing, mergeMealSheetResponses]);

  const {
    data,
    isLoading: loading,
    error: fetchError,
  } = useCachedFetch(cacheKey, fetcher, { ttl: 30_000 });

  const error = fetchError || '';

  useEffect(() => {
    setPage(1);
  }, [date, genderFilter]);

  const formatGuestMeal = (row) => {
    const parts = [];
    if (row.breakfastGuestCount > 0) parts.push(`B: ${row.breakfastGuestCount}`);
    if (row.lunchGuestCount > 0) parts.push(`L: ${row.lunchGuestCount}`);
    if (row.dinnerGuestCount > 0) parts.push(`D: ${row.dinnerGuestCount}`);
    return parts.join(', ');
  };

  // Client-side filtering & sorting
  const filteredRows = useMemo(() => {
    if (!data || !data.rows) return [];
    let list = [...data.rows];

    // Filter by gender
    if (genderFilter !== 'All') {
      list = list.filter(r => r.gender?.toLowerCase() === genderFilter.toLowerCase());
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => 
        r.name?.toLowerCase().includes(q) ||
        r.studentId?.toLowerCase().includes(q) ||
        r.hallId?.toLowerCase().includes(q) ||
        r.room?.toLowerCase().includes(q)
      );
    }

    // Sort
    list.sort((a, b) => {
      let valA = a[sortField] ?? '';
      let valB = b[sortField] ?? '';

      // Numeric room sort
      if (sortField === 'room') {
        const numA = parseInt(valA, 10);
        const numB = parseInt(valB, 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return sortAsc ? numA - numB : numB - numA;
        }
      }

      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      return sortAsc ? (valA > valB ? 1 : -1) : (valA < valB ? 1 : -1);
    });

    return list;
  }, [data, genderFilter, searchQuery, sortField, sortAsc]);

  // Pagination
  const paginatedRows = useMemo(() => {
    const start = (page - 1) * rowsPerPage;
    return filteredRows.slice(start, start + rowsPerPage);
  }, [filteredRows, page, rowsPerPage]);

  const totalPages = Math.ceil(filteredRows.length / rowsPerPage);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  // Export & Print functions
  const flatRows = () => filteredRows.map((row) => ({
    'Hall ID': row.hallId,
    'Student ID': row.studentId,
    'Student Name': row.name,
    'Room No': row.room,
    'Gender': row.gender,
    'Breakfast': row.breakfastOn ? `ON${row.breakfastOptionName ? ` (${row.breakfastOptionName})` : ''}` : 'OFF',
    'Lunch': row.lunchOn ? `ON${row.lunchOptionName ? ` (${row.lunchOptionName})` : ''}` : 'OFF',
    'Dinner': row.dinnerOn ? `ON${row.dinnerOptionName ? ` (${row.dinnerOptionName})` : ''}` : 'OFF',
    'Guest Meal': formatGuestMeal(row) || 'None'
  }));

  const exportExcel = () => {
    const book = utils.book_new();
    utils.book_append_sheet(book, utils.json_to_sheet(flatRows()), 'Meal Sheet');
    writeFile(book, `meal-sheet-${date}.xlsx`);
  };

  const exportCsv = () => {
    const headers = ['Hall ID', 'Student ID', 'Student Name', 'Room No', 'Gender', 'Breakfast', 'Lunch', 'Dinner', 'Guest Meal'];
    const rowsList = filteredRows.map((row) => [
      row.hallId,
      row.studentId,
      row.name,
      row.room,
      row.gender,
      row.breakfastOn ? `ON${row.breakfastOptionName ? ` (${row.breakfastOptionName})` : ''}` : 'OFF',
      row.lunchOn ? `ON${row.lunchOptionName ? ` (${row.lunchOptionName})` : ''}` : 'OFF',
      row.dinnerOn ? `ON${row.dinnerOptionName ? ` (${row.dinnerOptionName})` : ''}` : 'OFF',
      formatGuestMeal(row) || 'None'
    ]);
    const csvContent = [headers, ...rowsList]
      .map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `meal-sheet-${date}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    
    // Title of the report
    doc.setFontSize(16);
    doc.setTextColor(20, 26, 122); // Cohesive brand blue
    doc.text(`Meal Sheet Report`, 14, 15);
    
    // Sub-header info
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Date: ${date}  |  Total Students: ${filteredRows.length}`, 14, 21);

    const headers = [['Hall ID', 'Student ID', 'Student Name', 'Room No', 'Gender', 'Meals (B/L/D)', 'Guest Meals']];
    
    const body = filteredRows.map((row) => {
      // Format Meals nicely
      const mealParts = [];
      if (row.breakfastOn) {
        mealParts.push(`Breakfast: ${row.breakfastOptionName || 'Standard'}`);
      }
      if (row.lunchOn) {
        mealParts.push(`Lunch: ${row.lunchOptionName || 'Standard'}`);
      }
      if (row.dinnerOn) {
        mealParts.push(`Dinner: ${row.dinnerOptionName || 'Standard'}`);
      }
      const mealsFormatted = mealParts.length > 0 ? mealParts.join('\n') : 'No meals';

      // Format Guest Meals nicely
      const guestParts = [];
      if (row.breakfastGuestCount > 0) {
        guestParts.push(`B: ${row.breakfastGuestCount} guest${row.breakfastGuestCount === 1 ? '' : 's'}`);
      }
      if (row.lunchGuestCount > 0) {
        guestParts.push(`L: ${row.lunchGuestCount} guest${row.lunchGuestCount === 1 ? '' : 's'}`);
      }
      if (row.dinnerGuestCount > 0) {
        guestParts.push(`D: ${row.dinnerGuestCount} guest${row.dinnerGuestCount === 1 ? '' : 's'}`);
      }
      const guestsFormatted = guestParts.length > 0 ? guestParts.join('\n') : 'None';

      return [
        row.hallId,
        row.studentId,
        row.name,
        row.room || '-',
        row.gender || '-',
        mealsFormatted,
        guestsFormatted
      ];
    });

    autoTable(doc, {
      startY: 26,
      head: headers,
      body: body,
      theme: 'striped',
      styles: {
        fontSize: 8.5,
        cellPadding: 4,
        valign: 'middle',
        overflow: 'linebreak'
      },
      headStyles: {
        fillColor: [32, 42, 122], // Cohesive brand blue #202a7a
        textColor: [255, 255, 255],
        fontStyle: 'bold'
      },
      columnStyles: {
        0: { cellWidth: 16 }, // Hall ID
        1: { cellWidth: 24 }, // Student ID
        2: { cellWidth: 40 }, // Student Name
        3: { cellWidth: 16 }, // Room No
        4: { cellWidth: 16 }, // Gender
        5: { cellWidth: 42 }, // Meals (B/L/D)
        6: { cellWidth: 28 }  // Guest Meals
      }
    });

    doc.save(`meal-sheet-${date}.pdf`);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    
    const tableHtml = `
      <html>
        <head>
          <title>Meal Sheet Report - ${date}</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #333; }
            h1 { font-size: 1.5rem; margin-bottom: 5px; }
            p { font-size: 0.9rem; color: #666; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 10px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; font-size: 0.9rem; }
            th { background-color: #f2f2f2; font-weight: bold; }
            tr:nth-child(even) { background-color: #f9f9f9; }
            .badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-weight: bold; font-size: 0.75rem; }
            .badge-on { background-color: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
            .badge-off { background-color: #f1f5f9; color: #64748b; border: 1px solid #e2e8f0; }
          </style>
        </head>
        <body>
          <h1>Meal Sheet Report</h1>
          <p>Date: ${date}</p>
          <table>
            <thead>
              <tr>
                <th>Hall ID</th>
                <th>Student ID</th>
                <th>Student Name</th>
                <th>Room No</th>
                <th>Gender</th>
                <th>Breakfast</th>
                <th>Lunch</th>
                <th>Dinner</th>
                <th>Guest Meals</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.map(row => `
                <tr>
                  <td>${row.hallId}</td>
                  <td>${row.studentId}</td>
                  <td>${row.name}</td>
                  <td>${row.room}</td>
                  <td>${row.gender}</td>
                  <td><span class="badge ${row.breakfastOn ? 'badge-on' : 'badge-off'}">${row.breakfastOn ? `ON${row.breakfastOptionName ? ` (${row.breakfastOptionName})` : ''}` : 'OFF'}</span></td>
                  <td><span class="badge ${row.lunchOn ? 'badge-on' : 'badge-off'}">${row.lunchOn ? `ON${row.lunchOptionName ? ` (${row.lunchOptionName})` : ''}` : 'OFF'}</span></td>
                  <td><span class="badge ${row.dinnerOn ? 'badge-on' : 'badge-off'}">${row.dinnerOn ? `ON${row.dinnerOptionName ? ` (${row.dinnerOptionName})` : ''}` : 'OFF'}</span></td>
                  <td>${formatGuestMeal(row) || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <script>
            window.onload = function() {
              window.print();
              window.close();
            };
          </script>
        </body>
      </html>
    `;
    printWindow.document.write(tableHtml);
    printWindow.document.close();
  };

  return (
    <div className="financial-page">
      {/* Direct child of .financial-page, not wrapped in an extra flex row — that's what picks
          up the shared title styling and the page's automatic section spacing. */}
      <header>
        <h1 style={{ fontSize: '1.6rem', color: '#152f62' }}>Meal Sheet</h1>
        <p style={{ color: 'var(--muted)' }}>{data?.date || date}</p>
      </header>

      {/* Same .wing-filter-bar row Due Bill / Payment Verification already use for their
          controls — it stacks cleanly to one control per line under 700px, which the ad-hoc
          flex row this replaced did not do reliably. */}
      <div className="wing-filter-bar" style={{ flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Calendar size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--muted)' }} />
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: '0.5rem 0.75rem 0.5rem 2.2rem',
              borderRadius: '6px',
              border: '1px solid var(--border)',
              background: '#ffffff',
              color: 'var(--text)',
              fontSize: '0.9rem',
              outline: 'none',
              maxWidth: '100%',
            }}
          />
        </div>

        {/* Switches which sheet the date above is applied to. Hidden for a role without
            access to Additional Items, so the toggle itself never implies the feature. */}
        {canSeeAdditional ? (
          <div className="wing-switcher">
            <button
              type="button"
              className={view === 'sheet' ? 'is-active' : ''}
              onClick={() => setView('sheet')}
            >
              Meal Sheet
            </button>
            <button
              type="button"
              className={view === 'additional' ? 'is-active' : ''}
              onClick={() => setView('additional')}
            >
              <Coffee size={14} style={{ marginRight: '0.3rem', verticalAlign: '-2px' }} />
              Additional Items
            </button>
          </div>
        ) : null}
      </div>

      {error && <div className="student-message student-message-error">{error}</div>}

      {/* Stats and filters container — stays put across both views; only the roster beneath it,
          and the export/print buttons that act on it, swap with the view. */}
      <section
        className="financial-card"
        style={{
          marginBottom: '1rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.25rem',
          background: 'var(--surface-soft, #f8fafc)',
          padding: '0.85rem 1.25rem',
          borderRadius: '8px',
          border: '1px solid var(--border)'
        }}
      >
        {/* Aggregated totals */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ background: '#eef2ff', padding: '0.35rem 0.75rem', borderRadius: '20px', color: '#3730a3', fontSize: '0.85rem', fontWeight: 'bold' }}>
            B <span style={{ color: 'var(--text)', marginLeft: '0.2rem' }}>{data?.breakfastCount ?? 0}</span>
          </span>
          <span style={{ background: '#ecfdf5', padding: '0.35rem 0.75rem', borderRadius: '20px', color: '#065f46', fontSize: '0.85rem', fontWeight: 'bold' }}>
            L <span style={{ color: 'var(--text)', marginLeft: '0.2rem' }}>{data?.lunchCount ?? 0}</span>
          </span>
          <span style={{ background: '#fffbeb', padding: '0.35rem 0.75rem', borderRadius: '20px', color: '#92400e', fontSize: '0.85rem', fontWeight: 'bold' }}>
            D <span style={{ color: 'var(--text)', marginLeft: '0.2rem' }}>{data?.dinnerCount ?? 0}</span>
          </span>
          <span style={{ color: 'var(--muted)', fontSize: '0.85rem', fontWeight: '600', marginLeft: '0.5rem' }}>
            {data?.totalStudents ?? 0} students
          </span>
        </div>

        {/* Search & Gender filter — dropdown only for super_admin/admin */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
          {isWingAdmin ? (
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.4rem',
              background: user?.wing === 'Female' ? '#fce7f3' : '#dbeafe',
              color: user?.wing === 'Female' ? '#9d174d' : '#1e40af',
              border: `1px solid ${user?.wing === 'Female' ? '#f9a8d4' : '#93c5fd'}`,
              borderRadius: '6px',
              padding: '0.4rem 0.9rem',
              fontWeight: 600,
              fontSize: '0.85rem',
            }}>
              {user?.wing} Wing Only
            </span>
          ) : (
            <select
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: '#ffffff',
                color: 'var(--text)',
                fontSize: '0.9rem',
                outline: 'none',
                cursor: 'pointer'
              }}
            >
              <option value="All">All Gender</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
          )}

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={16} style={{ position: 'absolute', left: '0.75rem', color: 'var(--muted)' }} />
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              style={{
                padding: '0.5rem 0.75rem 0.5rem 2.2rem',
                borderRadius: '6px',
                border: '1px solid var(--border)',
                background: '#ffffff',
                color: 'var(--text)',
                fontSize: '0.9rem',
                outline: 'none',
                width: '200px',
                maxWidth: '100%',
              }}
            />
          </div>
        </div>
      </section>

      {/* The roster beneath the stats bar swaps between the two views. Keyed on `view` so React
          remounts this subtree on toggle, which is what drives the fade/slide-in animation below
          — no animation library needed for a two-state crossfade like this. */}
      <div key={view} className="meal-sheet-view-fade">
      {view === 'additional' && canSeeAdditional ? (
        <AdditionalItemsSheet date={date} wing={activeWing} />
      ) : (
      <>
      {/* Main Table section */}
      <section className="financial-card meal-sheet-table-card">
        {/* Scoped to this view's own filteredRows — switching to Additional Items swaps in that
            view's own export/print row instead, so these buttons never act on the wrong data. */}
        <div className="admin-meal-section-head" style={{ justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportExcel}
              disabled={filteredRows.length === 0}
              style={{ padding: '0.5rem 0.75rem' }}
              title="Export to Excel"
            >
              <FileSpreadsheet size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportCsv}
              disabled={filteredRows.length === 0}
              style={{ padding: '0.5rem 0.75rem' }}
              title="Export to CSV"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportPdf}
              disabled={filteredRows.length === 0}
              style={{ padding: '0.5rem 0.75rem' }}
              title="Export as PDF"
            >
              <FileText size={16} />
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handlePrint}
              disabled={filteredRows.length === 0}
              style={{ padding: '0.5rem 0.75rem' }}
              title="Print"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>
        {loading ? (
          <TableSkeleton rows={rowsPerPage} cols={6} />
        ) : (
          <div className="table-wrap sticky-page-table meal-sheet-table-scroll" role="region" aria-label="Meal sheet table" tabIndex={0}>
            <table className="data-table meal-sheet-table">
              <colgroup>
                <col className="meal-sheet-col-hall" />
                <col className="meal-sheet-col-student" />
                <col className="meal-sheet-col-name" />
                <col className="meal-sheet-col-room" />
                <col className="meal-sheet-col-meals" />
                <col className="meal-sheet-col-guest" />
              </colgroup>
              <thead>
                <tr>
                  <th onClick={() => toggleSort('hallId')} style={{ cursor: 'pointer' }}>
                    Hall ID <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                  </th>
                  <th onClick={() => toggleSort('studentId')} style={{ cursor: 'pointer' }}>
                    Student ID <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                  </th>
                  <th onClick={() => toggleSort('name')} style={{ cursor: 'pointer' }}>
                    Name <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                  </th>
                  <th onClick={() => toggleSort('room')} style={{ cursor: 'pointer' }}>
                    Room <ArrowUpDown size={12} style={{ marginLeft: '4px' }} />
                  </th>
                  <th style={{ textAlign: 'center' }}>Meal (B / L / D)</th>
                  <th>Guest Meal</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: 'var(--muted)', padding: '3rem 1.5rem' }}>
                      No records found matching criteria.
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => (
                    <tr key={`${row.studentId}-${row.hallId}`} style={{ height: '3.1rem' }}>
                      <td>{row.hallId}</td>
                      <td>{row.studentId}</td>
                      <td style={{ fontWeight: '600', color: 'var(--primary)' }}>{row.name}</td>
                      <td>{row.room || 'N/A'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'grid', justifyContent: 'center', gap: '0.32rem' }}>
                          <div style={{ display: 'inline-flex', justifyContent: 'center' }}>
                          <MealIndicator label="B" isOn={row.breakfastOn} />
                          <MealIndicator label="L" isOn={row.lunchOn} />
                          <MealIndicator label="D" isOn={row.dinnerOn} />
                          </div>
                          {(row.breakfastOptionName || row.lunchOptionName || row.dinnerOptionName) ? (
                            <div style={{ display: 'grid', gap: '0.18rem', textAlign: 'left' }}>
                              {row.breakfastOptionName ? <small style={{ color: '#2563eb', fontWeight: 600 }}>B: {row.breakfastOptionName}</small> : null}
                              {row.lunchOptionName ? <small style={{ color: '#16a34a', fontWeight: 600 }}>L: {row.lunchOptionName}</small> : null}
                              {row.dinnerOptionName ? <small style={{ color: '#d97706', fontWeight: 600 }}>D: {row.dinnerOptionName}</small> : null}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {formatGuestMeal(row) ? (
                          <span style={{
                            background: '#fef3c7',
                            color: '#d97706',
                            padding: '0.25rem 0.5rem',
                            borderRadius: '6px',
                            fontSize: '0.8rem',
                            fontWeight: '600',
                            border: '1px solid #fde68a'
                          }}>
                            {formatGuestMeal(row)}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Pagination controls */}
      {filteredRows.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '1.2rem',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          {/* Row selection dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: 'var(--muted)', flexWrap: 'wrap' }}>
            <span>Rows per page:</span>
            <select
              value={rowsPerPage}
              onChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(1);
              }}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                background: '#ffffff',
                fontSize: '0.85rem'
              }}
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
            <span style={{ marginLeft: '1rem', fontWeight: '600' }}>
              Showing {(page - 1) * rowsPerPage + 1} - {Math.min(page * rowsPerPage, filteredRows.length)} of {filteredRows.length} rows
            </span>
          </div>

          {/* Page buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              style={{ padding: '0.35rem 0.62rem' }}
            >
              <ChevronLeft size={16} />
            </button>
            
            {Array.from({ length: totalPages }).map((_, idx) => {
              const pNum = idx + 1;
              const isCurrent = pNum === page;
              // Only render standard pagination set if pages are a lot, or render all if <= 5
              if (totalPages > 5 && Math.abs(pNum - page) > 1 && pNum !== 1 && pNum !== totalPages) {
                if (pNum === 2 || pNum === totalPages - 1) {
                  return <span key={pNum} style={{ padding: '0 0.25rem', color: 'var(--muted)' }}>...</span>;
                }
                return null;
              }
              return (
                <button
                  key={pNum}
                  type="button"
                  onClick={() => setPage(pNum)}
                  className={`btn ${isCurrent ? 'btn-primary' : 'btn-secondary'}`}
                  style={{
                    padding: '0.35rem 0.72rem',
                    fontSize: '0.85rem',
                    minWidth: '2.1rem',
                    justifyContent: 'center',
                    border: isCurrent ? 'none' : '1px solid var(--border)'
                  }}
                >
                  {pNum}
                </button>
              );
            })}

            <button
              type="button"
              className="btn btn-secondary"
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              style={{ padding: '0.35rem 0.62rem' }}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
      </>
      )}
      </div>
    </div>
  );
}
