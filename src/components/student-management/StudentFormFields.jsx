import { STUDENT_LEVELS, STUDENT_STATUSES } from '../../types/student.types';

export default function StudentFormFields({ formData, errors = {}, onChange, includeStatus = true }) {
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
        <input
          value={formData.department}
          onChange={(event) => onChange('department', event.target.value)}
          placeholder="e.g. CSE"
        />
        {errors.department ? <small className="form-error">{errors.department}</small> : null}
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
        <span>Session Year</span>
        <input
          value={formData.sessionYear}
          onChange={(event) => onChange('sessionYear', event.target.value)}
          placeholder="2022-23"
        />
        {errors.sessionYear ? <small className="form-error">{errors.sessionYear}</small> : null}
      </label>

      <label className="field-control">
        <span>Hall Name</span>
        <input
          value={formData.hallName}
          onChange={(event) => onChange('hallName', event.target.value)}
          placeholder="Main / Extension A / Extension B"
        />
        {errors.hallName ? <small className="form-error">{errors.hallName}</small> : null}
      </label>

      <label className="field-control">
        <span>Email</span>
        <input
          type="email"
          value={formData.email}
          onChange={(event) => onChange('email', event.target.value)}
          placeholder="student@example.com"
        />
        {errors.email ? <small className="form-error">{errors.email}</small> : null}
      </label>

      <label className="field-control">
        <span>Admission Date</span>
        <input
          type="date"
          value={formData.admissionDate}
          onChange={(event) => onChange('admissionDate', event.target.value)}
        />
        {errors.admissionDate ? <small className="form-error">{errors.admissionDate}</small> : null}
      </label>

      <label className="field-control">
        <span>Expected Graduation Date</span>
        <input
          type="date"
          value={formData.expectedGraduationDate}
          onChange={(event) => onChange('expectedGraduationDate', event.target.value)}
        />
        {errors.expectedGraduationDate ? <small className="form-error">{errors.expectedGraduationDate}</small> : null}
      </label>

      <label className="field-control">
        <span>Hall Validity End Date</span>
        <input
          type="date"
          value={formData.hallValidityEndDate}
          onChange={(event) => onChange('hallValidityEndDate', event.target.value)}
        />
        {errors.hallValidityEndDate ? <small className="form-error">{errors.hallValidityEndDate}</small> : null}
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
