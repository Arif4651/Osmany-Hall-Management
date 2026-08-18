import { useEffect, useRef, useState } from 'react';
import StudentStatusBadge from './StatusBadge';
import StudentActionMenu from './StudentActionMenu';

// One entry per data column, so the header and the cell it labels stay in
// step. Selection, status and actions are laid out by hand around these.
const COLUMNS = [
  { key: 'studentName', label: 'Student Name', cellClass: 'cell-name' },
  { key: 'studentId', label: 'Student ID', cellClass: 'cell-mono' },
 // { key: 'rollNumber', label: 'Roll', cellClass: 'cell-strong' },
  { key: 'gender', label: 'Gender' },
  { key: 'department', label: 'Department', cellClass: 'cell-muted' },
  { key: 'hallId', label: 'Hall ID', cellClass: 'cell-muted cell-small' },
  { key: 'mobileNumber', label: 'Mobile Number', cellClass: 'cell-muted' },
  { key: 'level', label: 'Level / Year' },
  { key: 'hallName', label: 'Hall Name', cellClass: 'cell-muted' },
  { key: 'roomNo', label: 'Room No', render: (student) => student.roomNo || '-' },
];

const COLUMN_COUNT = COLUMNS.length + 3;

export default function StudentTable({
  students,
  isLoading,
  selectedSet,
  onToggleStudent,
  onTogglePage,
  onAction,
}) {
  const pageIds = students.map((student) => student.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedSet.has(id));

  // The 13-column roster (~1380px) is wider than the content column below a certain window
  // size, so the wrapper normally has to clip it with `overflow-x: auto`. But a sticky
  // header can only stick to the *page* (matching Bill Management's `.billing-table-scroll`)
  // while that wrapper stays `overflow: visible` — an `overflow-x: auto` container is also
  // forced to compute `overflow-y: auto`, which makes the wrapper itself (not the page) the
  // sticky containing block, and since it never scrolls vertically the header just renders
  // permanently offset instead of tracking scroll. A fixed CSS breakpoint can't reliably
  // predict when the table needs to clip (OS display scaling, browser zoom, and sidebar
  // collapse all shift the real available width), so this measures it directly: only switch
  // to the visible/sticky mode once the table genuinely fits without horizontal overflow.
  const wrapperRef = useRef(null);
  const [tableFits, setTableFits] = useState(false);

  useEffect(() => {
    const wrapperEl = wrapperRef.current;
    if (!wrapperEl) return undefined;

    const measure = () => {
      setTableFits(wrapperEl.scrollWidth - wrapperEl.clientWidth <= 1);
    };

    measure();

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(wrapperEl);
    window.addEventListener('resize', measure);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
    // Column count never changes at runtime, but row count and viewport width do — both can
    // flip whether the table overflows horizontally.
  }, [students.length]);

  return (
    <div
      className={`table-wrapper sticky-page-table student-table-scroll${tableFits ? ' student-table-fits' : ''}`}
      role="region"
      aria-label="Student management table"
      tabIndex={0}
      ref={wrapperRef}
    >
      <table className="data-table student-data-table">
        <thead>
          <tr>
            <th className="cell-select">
              <input
                type="checkbox"
                checked={allPageSelected}
                onChange={() => onTogglePage(pageIds)}
                aria-label="Select every student on this page"
              />
            </th>
            {COLUMNS.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
            <th className="cell-center">Status</th>
            <th className="cell-center">Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr className="student-row-message">
              <td colSpan={COLUMN_COUNT}>Loading students...</td>
            </tr>
          ) : students.length ? (
            students.map((student) => (
              <tr key={student.id}>
                <td className="cell-select">
                  <input
                    type="checkbox"
                    checked={selectedSet.has(student.id)}
                    onChange={() => onToggleStudent(student.id)}
                    aria-label={`Select ${student.studentName}`}
                  />
                </td>
                {COLUMNS.map((column) => (
                  <td key={column.key} className={column.cellClass}>
                    {column.render ? column.render(student) : student[column.key]}
                  </td>
                ))}
                <td className="cell-center">
                  <StudentStatusBadge status={student.status} />
                </td>
                <td className="cell-center">
                  <StudentActionMenu student={student} onAction={onAction} />
                </td>
              </tr>
            ))
          ) : (
            <tr className="student-row-message">
              <td colSpan={COLUMN_COUNT}>No students match the current search and filters.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
