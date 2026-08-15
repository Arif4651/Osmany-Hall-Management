import Button from '../ui/Button';
import StudentStatusBadge from './StatusBadge';

function Field({ label, value }) {
  return (
    <div className="student-drawer-row">
      <span>{label}</span>
      <strong>{value || '-'}</strong>
    </div>
  );
}

export default function StudentDetailsDrawer({ student, onClose, onEdit, onReactivate }) {
  if (!student) return null;

  return (
    <aside className="student-drawer" aria-label="Student details">
      <div className="student-drawer-head">
        <h3>Student Details</h3>
        <button type="button" onClick={onClose} aria-label="Close student details drawer">&times;</button>
      </div>

      <div className="student-drawer-body">
        <Field label="Student Name" value={student.studentName} />
        <Field label="Student ID" value={student.studentId} />
        <Field label="Department" value={student.department} />
        <Field label="Hall ID" value={student.hallId} />
        <Field label="Mobile Number" value={student.mobileNumber} />
        <Field label="Level / Year" value={student.level} />
        <Field label="Hall Name" value={student.hallName} />
        <Field label="Room No" value={student.roomNo} />
        <Field label="Join Date" value={student.joinDate} />
        <div className="student-drawer-row">
          <span>Status</span>
          <StudentStatusBadge status={student.status} />
        </div>
      </div>

      <div className="student-drawer-actions">
        <Button variant="secondary" onClick={() => onEdit(student)}>Edit Student</Button>
        <Button onClick={() => onReactivate(student)}>Reactivate</Button>
      </div>
    </aside>
  );
}
