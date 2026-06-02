import StudentStatusBadge from './StatusBadge';
import StudentActionMenu from './StudentActionMenu';

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
    <div className="table-wrapper" role="region" aria-label="Student management table">
      <table className="data-table student-data-table">
        <thead>
          <tr>
            <th>
              <input type="checkbox" checked={allPageSelected} onChange={() => onTogglePage(pageIds)} />
            </th>
            <th>Student Name</th>
            <th>Student ID</th>
            <th>Department</th>
            <th>Hall ID</th>
            <th>Mobile Number</th>
            <th>Level / Year</th>
            <th>Hall Name</th>
            <th>Room No</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={11} style={{ textAlign: 'center', padding: '1.3rem', color: 'var(--muted)' }}>
                Loading students...
              </td>
            </tr>
          ) : students.length ? (
            students.map((student) => (
              <tr key={student.id}>
                <td>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(student.id)}
                    onChange={() => onToggleStudent(student.id)}
                  />
                </td>
                <td>{student.studentName}</td>
                <td>{student.studentId}</td>
                <td>{student.department}</td>
                <td>{student.hallId}</td>
                <td>{student.mobileNumber}</td>
                <td>{student.level}</td>
                <td>{student.hallName}</td>
                <td>{student.roomNo || '-'}</td>
                <td>
                  <StudentStatusBadge status={student.status} />
                </td>
                <td>
                  <StudentActionMenu student={student} onAction={onAction} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={11} style={{ textAlign: 'center', padding: '1.3rem', color: 'var(--muted)' }}>
                No students match the current search and filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
