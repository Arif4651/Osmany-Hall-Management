import StudentStatusBadge from './StatusBadge';
import StudentActionMenu from './StudentActionMenu';

// One entry per data column, so the header and the cell it labels stay in
// step. Selection, status and actions are laid out by hand around these.
const COLUMNS = [
  { key: 'studentName', label: 'Student Name', cellClass: 'cell-name' },
  { key: 'studentId', label: 'Student ID', cellClass: 'cell-mono' },
  { key: 'rollNumber', label: 'Roll', cellClass: 'cell-strong' },
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

  return (
    <div
      className="table-wrapper sticky-page-table student-table-scroll"
      role="region"
      aria-label="Student management table"
      tabIndex={0}
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
