import { mockStudents } from '../data/mockStudents';
import { generateInitialCredentials } from '../utils/credentialHelpers';
import {
  applyStudentFilters,
  normalizeStudentPayload,
  paginateRows,
  validateStudentPayload,
} from '../utils/studentHelpers';
import {
  canBePermanentlyDeleted,
  evaluateLifecycleTransition,
} from '../utils/studentLifecycleHelpers';

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const generateId = () => `stu-${Math.random().toString(36).slice(2, 10)}`;

let studentsDB = [...mockStudents];

function syncLifecycleState() {
  studentsDB = studentsDB.map((student) => evaluateLifecycleTransition(student));
}

function getFilteredRows(filters = {}) {
  syncLifecycleState();
  const rows = applyStudentFilters(studentsDB, filters);
  return rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
}

function getBulkTargets(selectedStudentIds = [], filters = {}) {
  const selectedSet = new Set(selectedStudentIds);
  const filteredIds = getFilteredRows(filters).map((student) => student.id);
  return filteredIds.filter((id) => selectedSet.has(id));
}

function applyStatusSideEffects(student, nextStatus) {
  if (nextStatus === 'active') {
    return {
      ...student,
      status: nextStatus,
      loginAccessEnabled: true,
      reactivationEligible: false,
      permanentDeleteEligible: false,
    };
  }

  const disableLoginStatuses = ['inactive', 'archived', 'graduated'];

  return {
    ...student,
    status: nextStatus,
    loginAccessEnabled: disableLoginStatuses.includes(nextStatus)
      ? false
      : student.loginAccessEnabled,
    reactivationEligible: ['inactive', 'archived', 'graduated', 'pending_clearance'].includes(nextStatus),
    permanentDeleteEligible: ['archived', 'inactive', 'graduated'].includes(nextStatus),
  };
}

export const studentService = {
  getStudents: async ({ filters = {}, page = 1, pageSize = 10 } = {}) => {
    await delay(250);
    const filteredRows = getFilteredRows(filters);
    const paged = paginateRows(filteredRows, page, pageSize);

    return {
      ...paged,
      filteredIds: filteredRows.map((student) => student.id),
      items: paged.items,
    };
  },

  getStudentsForExport: async ({ filters = {} } = {}) => {
    await delay(220);
    const filteredRows = getFilteredRows(filters);
    return filteredRows;
  },

  getStudentById: async (id) => {
    await delay(120);
    const student = studentsDB.find((entry) => entry.id === id);
    if (!student) {
      throw new Error('Student not found.');
    }
    return evaluateLifecycleTransition(student);
  },

  getFilterOptions: async () => {
    await delay(100);
    syncLifecycleState();

    const departments = new Set();
    const levels = new Set();
    const sessions = new Set();
    const halls = new Set();

    studentsDB.forEach((student) => {
      departments.add(student.department);
      levels.add(student.level);
      sessions.add(student.sessionYear);
      halls.add(student.hallName);
    });

    return {
      departments: Array.from(departments).sort(),
      levels: Array.from(levels).sort(),
      sessions: Array.from(sessions).sort(),
      halls: Array.from(halls).sort(),
    };
  },

  createStudent: async (payload) => {
    await delay(260);
    const validation = validateStudentPayload(payload, studentsDB);
    if (!validation.isValid) {
      const error = new Error('Validation failed for student creation.');
      error.validationErrors = validation.errors;
      throw error;
    }

    const normalized = validation.normalized;
    const credentials = generateInitialCredentials(normalized.studentId);

    const newStudent = evaluateLifecycleTransition({
      id: generateId(),
      ...normalized,
      credentials,
      loginAccessEnabled: true,
      reactivationEligible: false,
      permanentDeleteEligible: false,
    });

    studentsDB = [newStudent, ...studentsDB];
    return newStudent;
  },

  updateStudent: async (id, payload) => {
    await delay(220);
    const index = studentsDB.findIndex((student) => student.id === id);
    if (index < 0) {
      throw new Error('Student not found.');
    }

    const merged = { ...studentsDB[index], ...normalizeStudentPayload(payload) };
    const validation = validateStudentPayload(merged, studentsDB, id);

    if (!validation.isValid) {
      const error = new Error('Validation failed for student update.');
      error.validationErrors = validation.errors;
      throw error;
    }

    const next = evaluateLifecycleTransition({
      ...studentsDB[index],
      ...validation.normalized,
    });

    studentsDB[index] = next;
    return next;
  },

  deleteStudent: async (id) => {
    await delay(160);
    const index = studentsDB.findIndex((student) => student.id === id);
    if (index < 0) {
      throw new Error('Student not found.');
    }

    studentsDB[index] = applyStatusSideEffects(studentsDB[index], 'inactive');
    return studentsDB[index];
  },

  evaluateStudentLifecycle: async (id) => {
    await delay(140);
    const index = studentsDB.findIndex((student) => student.id === id);
    if (index < 0) {
      throw new Error('Student not found.');
    }

    studentsDB[index] = evaluateLifecycleTransition(studentsDB[index]);
    return studentsDB[index];
  },

  evaluateAllStudentLifecycles: async () => {
    await delay(200);
    syncLifecycleState();
    return studentsDB;
  },

  bulkUpdateStudents: async ({
    filters = {},
    selectedStudentIds = [],
    updateFields = {},
  } = {}) => {
    await delay(320);
    const targetIds = getBulkTargets(selectedStudentIds, filters);
    const allowedFields = [
      'level',
      'sessionYear',
      'hallName',
      'status',
      'hallValidityEndDate',
      'expectedGraduationDate',
    ];

    const updates = Object.fromEntries(
      Object.entries(updateFields).filter(([key, value]) => allowedFields.includes(key) && value),
    );

    if (!Object.keys(updates).length) {
      throw new Error('No valid update fields were provided for bulk update.');
    }

    studentsDB = studentsDB.map((student) => {
      if (!targetIds.includes(student.id)) return student;
      const merged = { ...student, ...updates };
      if (updates.status) {
        return evaluateLifecycleTransition(applyStatusSideEffects(merged, updates.status));
      }
      return evaluateLifecycleTransition(merged);
    });

    return {
      updatedCount: targetIds.length,
      updatedFields: updates,
      targetIds,
    };
  },

  bulkUpdateStudentStatus: async ({ filters = {}, selectedStudentIds = [], status }) => {
    return studentService.bulkUpdateStudents({
      filters,
      selectedStudentIds,
      updateFields: { status },
    });
  },

  bulkReactivateStudents: async ({
    filters = {},
    selectedStudentIds = [],
    hallValidityEndDate,
    expectedGraduationDate,
  } = {}) => {
    await delay(280);
    const targetIds = getBulkTargets(selectedStudentIds, filters);

    studentsDB = studentsDB.map((student) => {
      if (!targetIds.includes(student.id)) return student;

      const next = {
        ...student,
        status: 'active',
        loginAccessEnabled: true,
        reactivationEligible: false,
        permanentDeleteEligible: false,
      };

      if (hallValidityEndDate) next.hallValidityEndDate = hallValidityEndDate;
      if (expectedGraduationDate) next.expectedGraduationDate = expectedGraduationDate;

      return evaluateLifecycleTransition(next);
    });

    return { updatedCount: targetIds.length, targetIds };
  },

  bulkArchiveStudents: async ({ filters = {}, selectedStudentIds = [] } = {}) => {
    await delay(220);
    const targetIds = getBulkTargets(selectedStudentIds, filters);

    studentsDB = studentsDB.map((student) => {
      if (!targetIds.includes(student.id)) return student;
      return evaluateLifecycleTransition(applyStatusSideEffects(student, 'archived'));
    });

    return { updatedCount: targetIds.length, targetIds };
  },

  bulkPermanentDeleteStudents: async ({
    filters = {},
    selectedStudentIds = [],
    force = false,
  } = {}) => {
    await delay(360);
    const targetIds = getBulkTargets(selectedStudentIds, filters);

    const eligibleIds = targetIds.filter((id) => {
      const student = studentsDB.find((row) => row.id === id);
      if (!student) return false;
      return force || canBePermanentlyDeleted(student);
    });

    const skippedIds = targetIds.filter((id) => !eligibleIds.includes(id));
    studentsDB = studentsDB.filter((student) => !eligibleIds.includes(student.id));

    return {
      deletedCount: eligibleIds.length,
      deletedIds: eligibleIds,
      skippedIds,
    };
  },

  deleteStudentPermanently: async (id, force = false) => {
    await delay(160);
    const student = studentsDB.find((entry) => entry.id === id);
    if (!student) {
      throw new Error('Student not found.');
    }

    if (!force && !canBePermanentlyDeleted(student)) {
      throw new Error('Student is not eligible for permanent deletion. Archive or inactivate first.');
    }

    studentsDB = studentsDB.filter((entry) => entry.id !== id);
    return { deletedCount: 1, deletedIds: [id], skippedIds: [] };
  },

  generateInitialCredentials: async (studentId) => {
    await delay(80);
    return generateInitialCredentials(studentId);
  },

  resetStudentPassword: async (id) => {
    await delay(100);
    const student = studentsDB.find((row) => row.id === id);
    if (!student) {
      throw new Error('Student not found.');
    }

    const credentials = generateInitialCredentials(student.studentId);
    student.credentials = credentials;
    return credentials;
  },
};
