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
    <div className="table-wrapper sticky-page-table" role="region" aria-label="Student management table">
      <table className="data-table student-data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ padding: '0.75rem', width: '30px', textAlign: 'center' }}>
              <input type="checkbox" checked={allPageSelected} onChange={() => onTogglePage(pageIds)} />
            </th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Student Name</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Student ID</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Roll</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Gender</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Department</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Hall ID</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Mobile Number</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Level / Year</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Hall Name</th>
            <th style={{ textAlign: 'left', padding: '0.75rem' }}>Room No</th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>Status</th>
            <th style={{ textAlign: 'center', padding: '0.75rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                Loading students...
              </td>
            </tr>
          ) : students.length ? (
            students.map((student) => (
              <tr key={student.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(student.id)}
                    onChange={() => onToggleStudent(student.id)}
                  />
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '600', color: 'var(--primary)' }}>
                  {student.studentName}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left', fontFamily: 'monospace', fontSize: '0.9rem', color: '#334155' }}>
                  {student.studentId}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left', fontWeight: '500' }}>
                  {student.rollNumber}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                  {student.gender}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)' }}>
                  {student.department}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)', fontSize: '0.9rem' }}>
                  {student.hallId}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)' }}>
                  {student.mobileNumber}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                  {student.level}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left', color: 'var(--muted)' }}>
                  {student.hallName}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'left' }}>
                  {student.roomNo || '-'}
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <StudentStatusBadge status={student.status} />
                </td>
                <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                  <StudentActionMenu student={student} onAction={onAction} />
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={13} style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                No students match the current search and filters.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
