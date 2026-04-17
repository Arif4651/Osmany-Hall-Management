import { STUDENT_LEVELS, STUDENT_STATUSES } from '../types/student.types';

function sanitizeText(value) {
  return String(value || '').trim();
}

export function normalizeStudentPayload(payload = {}) {
  return {
    studentName: sanitizeText(payload.studentName),
    studentId: sanitizeText(payload.studentId),
    department: sanitizeText(payload.department),
    hallId: sanitizeText(payload.hallId),
    mobileNumber: sanitizeText(payload.mobileNumber),
    level: sanitizeText(payload.level),
    sessionYear: sanitizeText(payload.sessionYear),
    hallName: sanitizeText(payload.hallName),
    email: sanitizeText(payload.email).toLowerCase(),
    admissionDate: sanitizeText(payload.admissionDate),
    expectedGraduationDate: sanitizeText(payload.expectedGraduationDate),
    hallValidityEndDate: sanitizeText(payload.hallValidityEndDate),
    status: sanitizeText(payload.status || 'active'),
    hasDue: Boolean(payload.hasDue),
    dueAmount: Number(payload.dueAmount || 0),
  };
}

export function getNextLevel(level) {
  const index = STUDENT_LEVELS.indexOf(level);
  if (index < 0 || index === STUDENT_LEVELS.length - 1) return level;
  return STUDENT_LEVELS[index + 1];
}

export function validateStudentPayload(payload, existingStudents = [], currentStudentId = null) {
  const errors = {};
  const normalized = normalizeStudentPayload(payload);

  if (!normalized.studentName) errors.studentName = 'Student name is required.';
  if (!normalized.studentId) errors.studentId = 'Student ID is required.';
  if (!/^[-A-Za-z0-9]{4,20}$/.test(normalized.studentId)) {
    errors.studentId = 'Student ID must be 4-20 characters (letters, numbers, dash).';
  }
  if (!normalized.department) errors.department = 'Department is required.';
  if (!normalized.hallId) errors.hallId = 'Hall ID is required.';
  if (!/^\+?\d{10,15}$/.test(normalized.mobileNumber.replace(/\s+/g, ''))) {
    errors.mobileNumber = 'Enter a valid mobile number (10-15 digits).';
  }
  if (!STUDENT_LEVELS.includes(normalized.level)) {
    errors.level = 'Select a valid level.';
  }
  if (!/^\d{4}(-\d{2})?$/.test(normalized.sessionYear)) {
    errors.sessionYear = 'Session format must be YYYY or YYYY-YY.';
  }
  if (!normalized.hallName) errors.hallName = 'Hall name is required.';
  if (!/^\S+@\S+\.\S+$/.test(normalized.email)) {
    errors.email = 'Enter a valid email address.';
  }
  if (!normalized.admissionDate) errors.admissionDate = 'Admission date is required.';
  if (!normalized.expectedGraduationDate) {
    errors.expectedGraduationDate = 'Expected graduation date is required.';
  }
  if (!normalized.hallValidityEndDate) {
    errors.hallValidityEndDate = 'Hall validity end date is required.';
  }
  if (!STUDENT_STATUSES.includes(normalized.status)) {
    errors.status = 'Select a valid status.';
  }

  const studentIdConflict = existingStudents.find((student) => {
    if (currentStudentId && student.id === currentStudentId) return false;
    return student.studentId.toLowerCase() === normalized.studentId.toLowerCase();
  });

  if (studentIdConflict) {
    errors.studentId = 'This student ID already exists.';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
    normalized,
  };
}

export function applyStudentFilters(students, filters) {
  const search = String(filters.search || '').toLowerCase().trim();

  return students.filter((student) => {
    const matchesSearch =
      !search ||
      student.studentName.toLowerCase().includes(search) ||
      student.studentId.toLowerCase().includes(search) ||
      student.hallId.toLowerCase().includes(search) ||
      student.mobileNumber.toLowerCase().includes(search);

    const matchesDepartment = filters.department === 'all' || student.department === filters.department;
    const matchesLevel = filters.level === 'all' || student.level === filters.level;
    const matchesSession = filters.sessionYear === 'all' || student.sessionYear === filters.sessionYear;
    const matchesHall = filters.hallName === 'all' || student.hallName === filters.hallName;
    const matchesStatus = filters.status === 'all' || student.status === filters.status;

    return (
      matchesSearch &&
      matchesDepartment &&
      matchesLevel &&
      matchesSession &&
      matchesHall &&
      matchesStatus
    );
  });
}

export function paginateRows(rows, page = 1, pageSize = 10) {
  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: rows.slice(start, start + pageSize),
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}
