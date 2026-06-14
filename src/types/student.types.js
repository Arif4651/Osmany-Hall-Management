export const STUDENT_STATUSES = [
  'active',
  'pending_clearance',
  'inactive',
  'graduated',
  'archived',
];

export const STUDENT_LEVELS = ['Level-01', 'Level-02', 'Level-03', 'Level-04'];

export const HALL_NAMES = ['Osmany Hall-Male', 'Osmany Hall-Female', 'Extension-A', 'Extension-B'];
export const DEPARTMENTS = ['CSE', 'EECE', 'CE', 'ME', 'IPE', 'ARCH', 'URP','EWCE','PME','AE','NAME','BME','NSE','MATH','CHEM','SC&H'];
export const DEFAULT_STUDENT_FORM = {
  studentName: '',
  studentId: '',
  gender: 'Male',
  department: '',
  hallId: '',
  mobileNumber: '',
  level: 'Level-01',
  hallName: '',
  roomNo: '',
  status: 'active',
};

export const DEFAULT_STUDENT_FILTERS = {
  search: '',
  department: 'all',
  level: 'all',
  hallName: 'all',
  status: 'all',
  gender: 'all',
};

export const BULK_UPDATABLE_FIELDS = [
  'level',
  'hallName',
  'roomNo',
  'status',
];
