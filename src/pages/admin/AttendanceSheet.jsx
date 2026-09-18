import { useCallback, useEffect, useMemo, useState } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { CalendarClock, Download, FileText, MapPin, Plus, Printer, RefreshCw, Save, Search } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { attendanceService } from '../../services/attendanceService';
import { todayLocal } from '../../utils/formatters';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import TableSkeleton from '../../components/ui/TableSkeleton';
import { DEPARTMENTS, STUDENT_LEVELS } from '../../types/student.types';

const SESSION_FORM_DEFAULT = {
  hallId: '',
  hallName: '',
  startTime: '22:00',
  endTime: '22:30',
  isActive: true,
};

const LOCATION_FORM_DEFAULT = {
  id: '',
  hallId: '',
  hallName: '',
  coordinateText: '',
  latitude: '',
  latitudeHemisphere: 'N',
  longitude: '',
  longitudeHemisphere: 'E',
  radiusMeters: 100,
  maxAccuracyMeters: 150,
  isActive: true,
};

function formatTime(time) {
  if (!time) return '-';
  const [hourText, minuteText] = String(time).split(':');
  const date = new Date();
  date.setHours(Number(hourText), Number(minuteText), 0, 0);
  return new Intl.DateTimeFormat('en-BD', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function formatMarkedAt(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-BD', { timeStyle: 'short' }).format(new Date(value));
}

function getHemisphere(value, positive, negative) {
  return Number(value) < 0 ? negative : positive;
}

function getAbsoluteCoordinate(value) {
  if (value === null || value === undefined || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.abs(numeric).toFixed(7) : '';
}

function toSignedCoordinate(value, hemisphere) {
  const numeric = Math.abs(Number(value));
  if (!Number.isFinite(numeric)) return Number.NaN;
  return hemisphere === 'S' || hemisphere === 'W' ? -numeric : numeric;
}

function formatCoordinate(value, positive, negative) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return '-';
  return `${Math.abs(numeric).toFixed(6)}° ${getHemisphere(numeric, positive, negative)}`;
}

function parseDirectionalCoordinate(text, positive, negative) {
  const patterns = [
    new RegExp(`([+-]?\\d+(?:\\.\\d+)?)\\s*°?\\s*([${positive}${negative}])`, 'i'),
    new RegExp(`([${positive}${negative}])\\s*([+-]?\\d+(?:\\.\\d+)?)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(/[NSWE]/i.test(match[1]) ? match[2] : match[1]);
      const direction = (/[NSWE]/i.test(match[1]) ? match[1] : match[2]).toUpperCase();
      return direction === negative ? -Math.abs(value) : Math.abs(value);
    }
  }

  return null;
}

function parseCoordinateInput(rawText) {
  const text = decodeURIComponent(String(rawText || '')).replace(/%2C/gi, ',');
  const urlPatterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of urlPatterns) {
    const match = text.match(pattern);
    if (match) return { latitude: Number(match[1]), longitude: Number(match[2]) };
  }

  const latDirectional = parseDirectionalCoordinate(text, 'N', 'S');
  const lonDirectional = parseDirectionalCoordinate(text, 'E', 'W');
  if (latDirectional !== null && lonDirectional !== null) {
    return { latitude: latDirectional, longitude: lonDirectional };
  }

  const numbers = text.match(/-?\d+(?:\.\d+)?/g)?.map(Number).filter(Number.isFinite) || [];
  for (let index = 0; index < numbers.length - 1; index += 1) {
    const latitude = numbers[index];
    const longitude = numbers[index + 1];
    if (Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) return { latitude, longitude };
  }

  return null;
}

function exportRows(rows) {
  return rows.map((row) => ({
    'Student ID': row.studentId,
    Name: row.studentName,
    Hall: row.hallName,
    Room: row.roomNo,
    Department: row.department,
    Level: row.level,
    Status: row.status,
    'Marked At': row.markedAtUtc ? formatMarkedAt(row.markedAtUtc) : '',
    'Accuracy (m)': row.accuracyMeters ?? '',
    'Distance (m)': row.distanceFromHallMeters ?? '',
  }));
}

export default function AttendanceSheet() {
  useDocumentTitle('Attendance Sheet');
  const toast = useToast();
  const { role, user } = useAuth();
  const isWingAdmin = role === 'male_wing_admin' || role === 'female_wing_admin';

  const [view, setView] = useState('sheet');
  const [date, setDate] = useState(todayLocal());
  const [sessions, setSessions] = useState([]);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [sessionForm, setSessionForm] = useState(SESSION_FORM_DEFAULT);
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false);
  const [editingSession, setEditingSession] = useState(null);

  const [filters, setFilters] = useState({
    gender: isWingAdmin ? (user?.wing || 'Male') : 'All',
   // hallName: 'All',
    department: 'All',
    level: 'All',
    status: 'All',
    search: '',
  });
  const [sheet, setSheet] = useState(null);
  const [isSheetLoading, setIsSheetLoading] = useState(false);

  const [hallOptions, setHallOptions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [locationForm, setLocationForm] = useState(LOCATION_FORM_DEFAULT);
  const [isLocationSaving, setIsLocationSaving] = useState(false);
  const [isLocationLoading, setIsLocationLoading] = useState(false);

  const loadSessions = useCallback(async () => {
    try {
      const result = await attendanceService.getSessions();
      setSessions(result || []);
      setSelectedSessionId((current) => current && result.some((item) => item.id === current)
        ? current
        : result[0]?.id || '');
    } catch (error) {
      toast.error('Could not load sessions', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [toast]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const loadHallOptions = useCallback(async () => {
    try {
      const options = await attendanceService.getHallOptions();
      setHallOptions(options || []);
    } catch (error) {
      toast.error('Could not load halls', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [toast]);

  useEffect(() => {
    loadHallOptions();
  }, [loadHallOptions]);

  const loadSheet = useCallback(async () => {
    setIsSheetLoading(true);
    try {
      const result = await attendanceService.getSheet({
        sessionId: selectedSessionId || undefined,
        date,
        ...filters,
      });
      setSheet(result);
    } catch (error) {
      toast.error('Could not load attendance sheet', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsSheetLoading(false);
    }
  }, [date, filters, selectedSessionId, toast]);

  useEffect(() => {
    loadSheet();
  }, [loadSheet]);

  const loadLocations = useCallback(async () => {
    setIsLocationLoading(true);
    try {
      const [options, configured] = await Promise.all([
        attendanceService.getHallOptions(),
        attendanceService.getHallLocations(),
      ]);
      setHallOptions(options || []);
      setLocations(configured || []);
    } catch (error) {
      toast.error('Could not load hall locations', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsLocationLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (view === 'locations') loadLocations();
  }, [loadLocations, view]);

  const sessionOptions = useMemo(() => sessions.map((session) => ({
    value: session.id,
    label: `${session.hallName || session.hallId} - ${formatTime(session.startTime)} to ${formatTime(session.endTime)}${session.isActive ? '' : ' (Inactive)'}`,
  })), [sessions]);

  const filterOptions = useMemo(() => ({
    halls: hallOptions.map((hall) => hall.hallName),
    departments: DEPARTMENTS,
    levels: STUDENT_LEVELS,
  }), [hallOptions]);

  const updateFilter = (key, value) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const openCreateSession = () => {
    const defaultHall = hallOptions[0];
    setEditingSession(null);
    setSessionForm({
      ...SESSION_FORM_DEFAULT,
      hallId: defaultHall?.hallId || '',
      hallName: defaultHall?.hallName || '',
    });
    setIsSessionModalOpen(true);
  };

  const openEditSession = () => {
    const session = sessions.find((item) => item.id === selectedSessionId);
    if (!session) return;
    setEditingSession(session);
    setSessionForm({
      hallId: session.hallId,
      hallName: session.hallName,
      startTime: String(session.startTime).slice(0, 5),
      endTime: String(session.endTime).slice(0, 5),
      isActive: session.isActive,
    });
    setIsSessionModalOpen(true);
  };

  const saveSession = async (event) => {
    event.preventDefault();
    try {
      const payload = {
        ...sessionForm,
        startTime: `${sessionForm.startTime}:00`,
        endTime: `${sessionForm.endTime}:00`,
      };
      const saved = editingSession
        ? await attendanceService.updateSession(editingSession.id, payload)
        : await attendanceService.createSession(payload);
      toast.success('Session saved', `${saved.hallName || saved.hallId} attendance session is ready.`);
      setSelectedSessionId(saved.id);
      setIsSessionModalOpen(false);
      await loadSessions();
      await loadSheet();
    } catch (error) {
      toast.error('Could not save session', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const selectHallForSession = (hallId) => {
    const option = hallOptions.find((item) => item.hallId === hallId);
    setSessionForm((current) => ({
      ...current,
      hallId,
      hallName: option?.hallName || '',
    }));
  };

  const selectHallForLocation = (hallId) => {
    const option = hallOptions.find((item) => item.hallId === hallId);
    setLocationForm((current) => ({
      ...current,
      hallId,
      hallName: option?.hallName || '',
    }));
  };

  const editLocation = (location) => {
    setLocationForm({
      id: location.id,
      hallId: location.hallId,
      hallName: location.hallName,
      coordinateText: '',
      latitude: getAbsoluteCoordinate(location.latitude),
      latitudeHemisphere: getHemisphere(location.latitude, 'N', 'S'),
      longitude: getAbsoluteCoordinate(location.longitude),
      longitudeHemisphere: getHemisphere(location.longitude, 'E', 'W'),
      radiusMeters: location.radiusMeters,
      maxAccuracyMeters: location.maxAccuracyMeters,
      isActive: location.isActive,
    });
  };

  const applyCoordinateText = () => {
    const parsed = parseCoordinateInput(locationForm.coordinateText);
    if (!parsed) {
      toast.error('Coordinates not found', 'Paste a map link or coordinates like 23.842768, 90.385999.');
      return;
    }

    setLocationForm((current) => ({
      ...current,
      latitude: getAbsoluteCoordinate(parsed.latitude),
      latitudeHemisphere: getHemisphere(parsed.latitude, 'N', 'S'),
      longitude: getAbsoluteCoordinate(parsed.longitude),
      longitudeHemisphere: getHemisphere(parsed.longitude, 'E', 'W'),
    }));
  };

  const useCurrentLocationForHall = () => {
    if (!navigator.geolocation) {
      toast.error('Location unavailable', 'This browser does not support location access.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocationForm((current) => ({
          ...current,
          latitude: getAbsoluteCoordinate(position.coords.latitude),
          latitudeHemisphere: getHemisphere(position.coords.latitude, 'N', 'S'),
          longitude: getAbsoluteCoordinate(position.coords.longitude),
          longitudeHemisphere: getHemisphere(position.coords.longitude, 'E', 'W'),
        }));
      },
      () => toast.error('Location unavailable', 'Please allow location access and try again.'),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  };

  const saveLocation = async (event) => {
    event.preventDefault();
    setIsLocationSaving(true);
    try {
      const latitude = toSignedCoordinate(locationForm.latitude, locationForm.latitudeHemisphere);
      const longitude = toSignedCoordinate(locationForm.longitude, locationForm.longitudeHemisphere);
      const payload = {
        hallId: locationForm.hallId,
        hallName: locationForm.hallName,
        latitude,
        longitude,
        radiusMeters: Number(locationForm.radiusMeters),
        maxAccuracyMeters: Number(locationForm.maxAccuracyMeters),
        isActive: Boolean(locationForm.isActive),
      };
      await (locationForm.id
        ? attendanceService.updateHallLocation(locationForm.id, payload)
        : attendanceService.createHallLocation(payload));
      toast.success('Hall location saved', `${payload.hallName || payload.hallId} is configured for attendance.`);
      setLocationForm(LOCATION_FORM_DEFAULT);
      await loadLocations();
    } catch (error) {
      toast.error('Could not save hall location', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setIsLocationSaving(false);
    }
  };

  const toggleLocation = async (location) => {
    try {
      await attendanceService.setHallLocationActive(location.id, !location.isActive);
      await loadLocations();
    } catch (error) {
      toast.error('Could not update location', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const rows = sheet?.rows || [];

  const exportCsv = () => {
    const flat = exportRows(rows);
    const headers = Object.keys(flat[0] || {});
    const csv = [headers, ...flat.map((row) => headers.map((key) => row[key]))]
      .map((line) => line.map((value) => `"${String(value ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance-sheet-${date}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text('Attendance Sheet', 14, 15);
    doc.setFontSize(9);
    doc.text(`Date: ${date} | Rows: ${rows.length}`, 14, 21);
    autoTable(doc, {
      startY: 27,
      head: [['Student ID', 'Name', 'Hall', 'Room', 'Status', 'Marked At']],
      body: rows.map((row) => [
        row.studentId,
        row.studentName,
        row.hallName,
        row.roomNo,
        row.status,
        row.markedAtUtc ? formatMarkedAt(row.markedAtUtc) : '',
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 58, 138] },
    });
    doc.save(`attendance-sheet-${date}.pdf`);
  };

  const handlePrint = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html><head><title>Attendance Sheet</title>
      <style>body{font-family:Arial,sans-serif;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #dbe4f1;padding:8px;text-align:left}th{background:#eef4ff}</style>
      </head><body>
      <h1>Attendance Sheet</h1><p>${date}</p>
      <table><thead><tr><th>Student ID</th><th>Name</th><th>Hall</th><th>Room</th><th>Status</th><th>Marked At</th></tr></thead>
      <tbody>${rows.map((row) => `<tr><td>${row.studentId}</td><td>${row.studentName}</td><td>${row.hallName}</td><td>${row.roomNo}</td><td>${row.status}</td><td>${row.markedAtUtc ? formatMarkedAt(row.markedAtUtc) : ''}</td></tr>`).join('')}</tbody></table>
      </body></html>`);
    printWindow.document.close();
    printWindow.print();
  };

  return (
    <div className="financial-page attendance-admin-page">
      <header className="attendance-admin-header">
        <div>
          <h1>Attendance Sheet</h1>
          <p>Manage hall attendance sessions, reports, and GPS hall locations.</p>
        </div>
        <div className="attendance-segmented">
          <button type="button" className={view === 'sheet' ? 'is-active' : ''} onClick={() => setView('sheet')}>Sheet</button>
          <button type="button" className={view === 'locations' ? 'is-active' : ''} onClick={() => setView('locations')}>Hall Locations</button>
        </div>
      </header>

      {view === 'sheet' ? (
        <>
          <section className="attendance-summary-grid">
            <article><span>Total Students</span><strong>{sheet?.summary?.totalStudents ?? 0}</strong></article>
            <article><span>Present</span><strong>{sheet?.summary?.present ?? 0}</strong></article>
            <article><span>Absent</span><strong>{sheet?.summary?.absent ?? 0}</strong></article>
            <article><span>Attendance</span><strong>{sheet?.summary?.attendancePercentage ?? 0}%</strong></article>
          </section>

          <section className="financial-card attendance-controls">
            <label>
              <span>Date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>
            <label>
              <span>Session</span>
              <select value={selectedSessionId} onChange={(event) => setSelectedSessionId(event.target.value)}>
                {sessionOptions.length === 0 ? <option value="">No session</option> : null}
                {sessionOptions.map((session) => <option key={session.value} value={session.value}>{session.label}</option>)}
              </select>
            </label>
            <Button onClick={openCreateSession}><Plus size={16} /> Create Session</Button>
            <Button variant="secondary" onClick={openEditSession} disabled={!selectedSessionId}>Edit Session</Button>
            <Button variant="secondary" onClick={loadSheet}><RefreshCw size={16} /> Refresh</Button>
          </section>

          <section className="financial-card attendance-controls">
            {!isWingAdmin ? (
              <label>
                <span>Wing</span>
                <select value={filters.gender} onChange={(event) => updateFilter('gender', event.target.value)}>
                  <option>All</option>
                  <option>Male</option>
                  <option>Female</option>
                </select>
              </label>
            ) : null}
            <label>
              <span>Hall</span>
              <select value={filters.hallName} onChange={(event) => updateFilter('hallName', event.target.value)}>
                <option>All</option>
                {filterOptions.halls.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Department</span>
              <select value={filters.department} onChange={(event) => updateFilter('department', event.target.value)}>
                <option>All</option>
                {filterOptions.departments.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Level</span>
              <select value={filters.level} onChange={(event) => updateFilter('level', event.target.value)}>
                <option>All</option>
                {filterOptions.levels.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select value={filters.status} onChange={(event) => updateFilter('status', event.target.value)}>
                <option>All</option>
                <option>Present</option>
                <option>Absent</option>
              </select>
            </label>
            <label className="attendance-search">
              <span>Search</span>
              <div>
                <Search size={15} />
                <input value={filters.search} onChange={(event) => updateFilter('search', event.target.value)} placeholder="Name, ID, room" />
              </div>
            </label>
          </section>

          <section className="financial-card">
            <div className="attendance-table-actions">
              <Button variant="secondary" onClick={exportCsv} disabled={rows.length === 0}><Download size={16} /> CSV</Button>
              <Button variant="secondary" onClick={exportPdf} disabled={rows.length === 0}><FileText size={16} /> PDF</Button>
              <Button variant="secondary" onClick={handlePrint} disabled={rows.length === 0}><Printer size={16} /> Print</Button>
            </div>
            {isSheetLoading ? (
              <TableSkeleton rows={8} cols={7} />
            ) : (
              <div className="table-wrap sticky-page-table">
                <table className="data-table attendance-table">
                  <thead>
                    <tr>
                      <th>Student ID</th>
                      <th>Name</th>
                      <th>Hall</th>
                      <th>Room</th>
                      <th>Department</th>
                      <th>Status</th>
                      <th>Marked At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.length === 0 ? (
                      <tr><td colSpan={7} className="attendance-empty-cell">No attendance records found.</td></tr>
                    ) : rows.map((row) => (
                      <tr key={row.studentRecordId}>
                        <td>{row.studentId}</td>
                        <td>{row.studentName}</td>
                        <td>{row.hallName}</td>
                        <td>{row.roomNo}</td>
                        <td>{row.department}</td>
                        <td><span className={`attendance-status-badge ${row.status === 'Present' ? 'is-success' : 'is-muted'}`}>{row.status}</span></td>
                        <td>{row.markedAtUtc ? formatMarkedAt(row.markedAtUtc) : '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="attendance-pagination">
              <span>{rows.length} row{rows.length === 1 ? '' : 's'} loaded</span>
            </div>
          </section>
        </>
      ) : (
        <section className="attendance-location-layout">
          <form className="financial-card attendance-location-form" onSubmit={saveLocation}>
            <h2>{locationForm.id ? 'Edit Hall Location' : 'Configure Hall Location'}</h2>
            <label>
              <span>Hall</span>
              <select value={locationForm.hallId} onChange={(event) => selectHallForLocation(event.target.value)} required>
                <option value="">Select hall</option>
                {hallOptions.map((option) => (
                  <option key={`${option.hallId}-${option.hallName}`} value={option.hallId}>
                    {option.hallName}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Map Link or Coordinates</span>
              <div className="attendance-coordinate-paste">
                <input
                  type="text"
                  value={locationForm.coordinateText}
                  onChange={(event) => setLocationForm((current) => ({ ...current, coordinateText: event.target.value }))}
                  placeholder="23.842768, 90.385999 or Google Maps link"
                />
                <Button type="button" variant="secondary" onClick={applyCoordinateText}>Apply</Button>
              </div>
            </label>
            <label>
              <span>Latitude</span>
              <div className="attendance-coordinate-field">
                <input type="number" step="0.0000001" min="0" max="90" value={locationForm.latitude} onChange={(event) => setLocationForm((current) => ({ ...current, latitude: event.target.value }))} required />
                <select value={locationForm.latitudeHemisphere} onChange={(event) => setLocationForm((current) => ({ ...current, latitudeHemisphere: event.target.value }))}>
                  <option value="N">N</option>
                  <option value="S">S</option>
                </select>
              </div>
            </label>
            <label>
              <span>Longitude</span>
              <div className="attendance-coordinate-field">
                <input type="number" step="0.0000001" min="0" max="180" value={locationForm.longitude} onChange={(event) => setLocationForm((current) => ({ ...current, longitude: event.target.value }))} required />
                <select value={locationForm.longitudeHemisphere} onChange={(event) => setLocationForm((current) => ({ ...current, longitudeHemisphere: event.target.value }))}>
                  <option value="E">E</option>
                  <option value="W">W</option>
                </select>
              </div>
            </label>
            <label>
              <span>Allowed Radius (m)</span>
              <input type="number" min="20" max="500" value={locationForm.radiusMeters} onChange={(event) => setLocationForm((current) => ({ ...current, radiusMeters: event.target.value }))} required />
            </label>
            <label>
              <span>Max GPS Accuracy (m)</span>
              <input type="number" min="5" max="250" value={locationForm.maxAccuracyMeters} onChange={(event) => setLocationForm((current) => ({ ...current, maxAccuracyMeters: event.target.value }))} required />
            </label>
            <label className="attendance-checkbox">
              <input type="checkbox" checked={locationForm.isActive} onChange={(event) => setLocationForm((current) => ({ ...current, isActive: event.target.checked }))} />
              <span>Active</span>
            </label>
            <div className="attendance-form-actions">
              <Button type="button" variant="secondary" onClick={useCurrentLocationForHall}><MapPin size={16} /> Use Current Location</Button>
              <Button type="submit" disabled={isLocationSaving}><Save size={16} /> {isLocationSaving ? 'Saving...' : 'Save Location'}</Button>
              {locationForm.id ? <Button type="button" variant="ghost" onClick={() => setLocationForm(LOCATION_FORM_DEFAULT)}>Cancel</Button> : null}
            </div>
          </form>

          <section className="financial-card">
            <div className="attendance-section-head">
              <div>
                <h2>Hall Locations</h2>
                <p>Students are matched to these locations from their assigned student hall.</p>
              </div>
              <Button variant="secondary" onClick={loadLocations}><RefreshCw size={16} /> Refresh</Button>
            </div>
            {isLocationLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Hall</th>
                      <th>Coordinates</th>
                      <th>Radius</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {locations.length === 0 ? (
                      <tr><td colSpan={5} className="attendance-empty-cell">No hall locations configured.</td></tr>
                    ) : locations.map((location) => (
                      <tr key={location.id}>
                        <td><strong>{location.hallName}</strong></td>
                        <td>
                          {formatCoordinate(location.latitude, 'N', 'S')}
                          <br />
                          {formatCoordinate(location.longitude, 'E', 'W')}
                        </td>
                        <td>{location.radiusMeters}m</td>
                        <td><span className={`attendance-status-badge ${location.isActive ? 'is-success' : 'is-muted'}`}>{location.isActive ? 'Active' : 'Inactive'}</span></td>
                        <td>
                          <div className="attendance-row-actions">
                            <Button variant="secondary" onClick={() => editLocation(location)}>Edit</Button>
                            <Button variant="ghost" onClick={() => toggleLocation(location)}>{location.isActive ? 'Deactivate' : 'Activate'}</Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </section>
      )}

      <Modal
        isOpen={isSessionModalOpen}
        onClose={() => setIsSessionModalOpen(false)}
        title={editingSession ? 'Edit Attendance Session' : 'Create Attendance Session'}
      >
        <form className="attendance-modal-form" onSubmit={saveSession}>
          <label>
            <span>Hall</span>
            <select value={sessionForm.hallId} onChange={(event) => selectHallForSession(event.target.value)} required>
              <option value="">Select hall</option>
              {hallOptions.map((option) => (
                <option key={`${option.hallId}-${option.hallName}`} value={option.hallId}>
                  {option.hallName}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Start Time</span>
            <input type="time" value={sessionForm.startTime} onChange={(event) => setSessionForm((current) => ({ ...current, startTime: event.target.value }))} required />
          </label>
          <label>
            <span>End Time</span>
            <input type="time" value={sessionForm.endTime} onChange={(event) => setSessionForm((current) => ({ ...current, endTime: event.target.value }))} required />
          </label>
          <label className="attendance-checkbox">
            <input type="checkbox" checked={sessionForm.isActive} onChange={(event) => setSessionForm((current) => ({ ...current, isActive: event.target.checked }))} />
            <span>Active</span>
          </label>
          <div className="attendance-form-actions">
            <Button type="button" variant="secondary" onClick={() => setIsSessionModalOpen(false)}>Cancel</Button>
            <Button type="submit"><CalendarClock size={16} /> Save Session</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
