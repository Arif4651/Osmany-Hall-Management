import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Clock, LocateFixed, MapPin, TriangleAlert } from 'lucide-react';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import PageHeader from '../../components/common/PageHeader';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import { attendanceService } from '../../services/attendanceService';
import { formatDate } from '../../utils/formatters';

function formatTime(time) {
  if (!time) return '-';
  const [hourText, minuteText] = String(time).split(':');
  const date = new Date();
  date.setHours(Number(hourText), Number(minuteText), 0, 0);
  return new Intl.DateTimeFormat('en-BD', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function formatMarkedAt(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-BD', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function getCurrentMonthValue() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function parseMonthValue(value) {
  const [year, month] = String(value).split('-').map(Number);
  return { year, month };
}

function formatMonthDay(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('en-BD', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(`${value}T00:00:00`));
}

const GPS_OPTIONS = {
  enableHighAccuracy: true,
  maximumAge: 0,
  timeout: 2500,
};

function getLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Location is not supported by this browser.'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          reject(new Error('Location permission is required to mark attendance. Please allow location access in your browser settings and try again.'));
          return;
        }
        reject(new Error('Unable to get your location. Please try again.'));
      },
      GPS_OPTIONS,
    );
  });
}
export default function Attendance() {
  useDocumentTitle('Attendance');
  const currentMonthValue = useMemo(() => getCurrentMonthValue(), []);
  const [current, setCurrent] = useState(null);
  const [monthValue, setMonthValue] = useState(currentMonthValue);
  const [monthDetails, setMonthDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const { year, month } = parseMonthValue(monthValue);
      const [currentResult, monthResult] = await Promise.all([
        attendanceService.getCurrent(),
        attendanceService.getMonth({ year, month }),
      ]);
      setCurrent(currentResult);
      setMonthDetails(monthResult);
    } catch (error) {
      setMessage({
        type: 'error',
        title: 'Attendance unavailable',
        text: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  }, [monthValue]);

  useEffect(() => {
    load();
  }, [load]);

  const statusConfig = useMemo(() => {
    const status = current?.status;
    if (status === 'present') {
      return { label: 'Present', className: 'is-success', icon: CheckCircle2 };
    }
    if (status === 'not_marked') {
      return { label: 'Not Marked', className: 'is-warning', icon: Clock };
    }
    if (status === 'not_started') {
      return { label: 'Not Started', className: 'is-muted', icon: Clock };
    }
    if (status === 'closed') {
      return { label: 'Closed', className: 'is-danger', icon: TriangleAlert };
    }
    return { label: 'Unavailable', className: 'is-muted', icon: TriangleAlert };
  }, [current?.status]);

  const canSubmit = current?.status === 'not_marked' && current?.session && !isSubmitting;
  const StatusIcon = statusConfig.icon;

  const handleMark = useCallback(async () => {
    setIsSubmitting(true);
    setMessage({
      type: 'info',
      title: 'Getting your location...',
      text: 'Please approve the browser location request and wait a few seconds.',
    });
    try {
      const position = await getLocation();
      setMessage({
        type: 'info',
        title: 'Verifying attendance',
        text: 'Your location is being checked against your assigned hall.',
      });
      const result = await attendanceService.mark({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracyMeters: position.coords.accuracy,
      });
      setMessage({
        type: 'success',
        title: 'Attendance marked',
        text: result.message,
      });
      await load();
    } catch (error) {
      setMessage({
        type: 'error',
        title: 'Could not mark attendance',
        text: error instanceof Error ? error.message : 'Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [load]);

  return (
    <div className="financial-page attendance-page">
      <PageHeader
        title="Attendance"
        description="Mark hall attendance during the active session using your device location."
      />

      {message ? (
        <div className={`student-message student-message-${message.type === 'error' ? 'error' : 'success'}`}>
          <strong>{message.title}</strong>
          <span>{message.text}</span>
        </div>
      ) : null}

      <section className="attendance-session-section">
        <Card className="attendance-primary-card">
          <div className="attendance-card-head">
            <span className={`attendance-status-badge ${statusConfig.className}`}>
              <StatusIcon size={17} />
              {statusConfig.label}
            </span>
            <CalendarClock size={24} />
          </div>

          {isLoading ? (
            <p className="attendance-muted">Loading attendance session...</p>
          ) : current?.session ? (
            <div className="attendance-detail-grid">
              <div>
                <span>Date</span>
                <strong>{formatDate(current.attendanceDate)}</strong>
              </div>
              <div>
                <span>Time</span>
                <strong>{formatTime(current.session.startTime)} - {formatTime(current.session.endTime)}</strong>
              </div>
              <div>
                <span>Assigned Hall</span>
                <strong>{current.assignedHallName || current.assignedHallId || '-'}</strong>
              </div>
              <div>
                <span>Marked At</span>
                <strong>{formatMarkedAt(current.markedAtUtc)}</strong>
              </div>
            </div>
          ) : (
            <div className="attendance-empty-state">
              <MapPin size={28} />
              <p>{current?.message || 'No attendance session is currently active.'}</p>
            </div>
          )}

          <div className="attendance-action-row">
            <Button onClick={handleMark} disabled={!canSubmit}>
              <LocateFixed size={17} />
              {isSubmitting ? 'Getting your location...' : 'Give Attendance'}
            </Button>
            <small>
              Your hall is selected from your student record. You cannot choose a different hall.
            </small>
          </div>
        </Card>
      </section>

      <section className="financial-card sticky-page-table attendance-month-table-card">
        <div className="attendance-month-toolbar">
          <div>
            <h2>Monthly Attendance</h2>
            <p>{monthDetails?.monthName || 'Select month'} attendance details</p>
          </div>
          <div className="attendance-month-summary">
            <article>
              <span>Total Days</span>
              <strong>{monthDetails?.totalDays ?? 0}</strong>
            </article>
            <article>
              <span>Present</span>
              <strong>{monthDetails?.presentDays ?? 0}</strong>
            </article>
            <article>
              <span>Absent</span>
              <strong>{monthDetails?.absentDays ?? 0}</strong>
            </article>
          </div>
          <label className="attendance-month-picker">
            <span>Month</span>
            <input
              type="month"
              value={monthValue}
              max={currentMonthValue}
              onChange={(event) => {
                if (event.target.value) setMonthValue(event.target.value);
              }}
            />
          </label>
        </div>

        <table className="student-snapshot-table attendance-month-table">
          <thead>
            <tr>
              <th>Date / Day</th>
              <th>Status</th>
              <th>Marked At</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={3} className="snapshot-empty-row">Loading monthly attendance...</td>
              </tr>
            ) : !monthDetails?.days?.length ? (
              <tr>
                <td colSpan={3} className="snapshot-empty-row">No attendance days found for this month.</td>
              </tr>
            ) : monthDetails.days.map((row) => {
              const isToday = row.date === current?.attendanceDate;
              return (
              <tr key={row.date} className={isToday ? 'attendance-today-row' : undefined}>
                <td>
                  <strong>{formatMonthDay(row.date)}</strong>
                  {isToday ? <span className="attendance-today-badge">Today</span> : null}
                  <span className="attendance-table-subtext">{row.dayName}</span>
                </td>
                <td>
                  <span className={`attendance-status-badge ${row.status === 'Present' ? 'is-success' : 'is-danger'}`}>
                    {row.status}
                  </span>
                </td>
                <td>{formatMarkedAt(row.markedAtUtc)}</td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </div>
  );
}
