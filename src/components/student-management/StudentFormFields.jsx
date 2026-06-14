import {
  DEPARTMENTS,
  HALL_NAMES,
  STUDENT_LEVELS,
  STUDENT_STATUSES,
} from '../../types/student.types';
import { useAuth } from '../../context/AuthContext';

export default function StudentFormFields({ formData, errors = {}, onChange, includeStatus = true }) {
  const { user, role } = useAuth();
  const isWingAdmin = role === 'male_wing_admin' || role === 'female_wing_admin';

  return (
    <div className="form-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))' }}>
      <label className="field-control">
        <span>Student Name</span>
        <input
          value={formData.studentName}
          onChange={(event) => onChange('studentName', event.target.value)}
          placeholder="Full name"
        />
        {errors.studentName ? <small className="form-error">{errors.studentName}</small> : null}
      </label>

      <label className="field-control">
        <span>Student ID</span>
        <input
          value={formData.studentId}
          onChange={(event) => onChange('studentId', event.target.value)}
          placeholder="e.g. 202312345"
        />
        {errors.studentId ? <small className="form-error">{errors.studentId}</small> : null}
      </label>

      <label className="field-control">
        <span>Department</span>
        <select
          value={formData.department}
          onChange={(event) => onChange('department', event.target.value)}
        >
          <option value="">Select Department</option>
          {DEPARTMENTS.map((department) => (
            <option key={department} value={department}>
              {department}
            </option>
          ))}
        </select>
        {errors.department ? <small className="form-error">{errors.department}</small> : null}
      </label>

      <label className="field-control">
        <span>
          Gender
          {isWingAdmin && (
            <small
              style={{
                marginLeft: '0.4rem',
                background: 'var(--color-accent, #4f6bed)',
                color: '#fff',
                borderRadius: '4px',
                padding: '1px 6px',
                fontSize: '0.7rem',
                fontWeight: 600,
                letterSpacing: '0.03em',
              }}
            >
              {user?.wing} Wing
            </small>
          )}
        </span>
        <select
          value={formData.gender}
          onChange={(event) => onChange('gender', event.target.value)}
          // Wing admins can only create/edit students of their own gender — lock it
          disabled={isWingAdmin}
          title={isWingAdmin ? `Locked to ${user?.wing} — your admin wing` : undefined}
        >
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        {errors.gender ? <small className="form-error">{errors.gender}</small> : null}
      </label>

      <label className="field-control">
        <span>Hall ID</span>
        <input
          value={formData.hallId}
          onChange={(event) => onChange('hallId', event.target.value)}
          placeholder="e.g. OH-210"
        />
        {errors.hallId ? <small className="form-error">{errors.hallId}</small> : null}
      </label>

      <label className="field-control">
        <span>Mobile Number</span>
        <input
          value={formData.mobileNumber}
          onChange={(event) => onChange('mobileNumber', event.target.value)}
          placeholder="01XXXXXXXXX"
        />
        {errors.mobileNumber ? <small className="form-error">{errors.mobileNumber}</small> : null}
      </label>

      <label className="field-control">
        <span>Level / Year</span>
        <select value={formData.level} onChange={(event) => onChange('level', event.target.value)}>
          {STUDENT_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
        {errors.level ? <small className="form-error">{errors.level}</small> : null}
      </label>

      <label className="field-control">
        <span>Hall Name</span>
        <select
          value={formData.hallName}
          onChange={(event) => onChange('hallName', event.target.value)}
        >
          <option value="">Select Hall Name</option>
          {HALL_NAMES.map((hallName) => (
            <option key={hallName} value={hallName}>
              {hallName}
            </option>
          ))}
        </select>
        {errors.hallName ? <small className="form-error">{errors.hallName}</small> : null}
      </label>

      <label className="field-control">
        <span>Room No</span>
        <input
          value={formData.roomNo}
          onChange={(event) => onChange('roomNo', event.target.value)}
          placeholder="e.g. 210"
        />
        {errors.roomNo ? <small className="form-error">{errors.roomNo}</small> : null}
      </label>

      {includeStatus ? (
        <label className="field-control">
          <span>Status</span>
          <select value={formData.status} onChange={(event) => onChange('status', event.target.value)}>
            {STUDENT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
          {errors.status ? <small className="form-error">{errors.status}</small> : null}
        </label>
      ) : null}
    </div>
  );
}
