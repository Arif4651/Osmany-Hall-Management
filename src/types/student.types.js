export const STUDENT_STATUSES = [
  'active',
  'pending_clearance',
  'inactive',
  'graduated',
  'archived',
];

export const STUDENT_LEVELS = ['Level-01', 'Level-02', 'Level-03', 'Level-04', "Master's"];

export const DEFAULT_STUDENT_FORM = {
  studentName: '',
  studentId: '',
  department: '',
  hallId: '',
  mobileNumber: '',
  level: 'Level-01',
  sessionYear: '',
  hallName: '',
  email: '',
  admissionDate: '',
  expectedGraduationDate: '',
  hallValidityEndDate: '',
  status: 'active',
  hasDue: false,
};

export const DEFAULT_STUDENT_FILTERS = {
  search: '',
  department: 'all',
  level: 'all',
  sessionYear: 'all',
  hallName: 'all',
  status: 'all',
};

export const BULK_UPDATABLE_FIELDS = [
  'level',
  'sessionYear',
  'hallName',
  'status',
  'hallValidityEndDate',
  'expectedGraduationDate',
];
