import { apiRequest, toQueryString } from './apiClient';

function normalizeFilters(filters = {}) {
  return {
    search: filters.search,
    department: filters.department,
    level: filters.level,
    hallName: filters.hallName,
    status: filters.status,
    gender: filters.gender,
  };
}

function normalizeUpdateFields(updateFields = {}) {
  return Object.fromEntries(
    Object.entries(updateFields)
      .filter(([, value]) => value !== undefined && value !== null && value !== '')
      .map(([key, value]) => [key, String(value)]),
  );
}

function initialCredentials(studentId) {
  return {
    defaultLoginId: studentId,
    defaultPassword: studentId,
  };
}

function withLegacyRollNumber(payload = {}) {
  const studentId = String(payload.studentId || '').trim();
  return {
    ...payload,
    rollNumber: String(payload.rollNumber || studentId).trim(),
  };
}

export const studentService = {
  getStudents: async ({ filters = {}, page = 1, pageSize = 10 } = {}) => {
    return apiRequest(`/students${toQueryString({ ...normalizeFilters(filters), page, pageSize })}`);
  },

  getStudentsForExport: async ({ filters = {} } = {}) => {
    return apiRequest(`/students/export${toQueryString(normalizeFilters(filters))}`);
  },

  getStudentById: async (id) => {
    return apiRequest(`/students/${id}`);
  },

  getFilterOptions: async () => {
    return apiRequest('/students/filter-options');
  },

  createStudent: async (payload) => {
    const created = await apiRequest('/students', {
      method: 'POST',
      body: JSON.stringify(withLegacyRollNumber(payload)),
    });

    return {
      ...created,
      credentials: initialCredentials(created.studentId),
    };
  },

  updateStudent: async (id, payload) => {
    return apiRequest(`/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(withLegacyRollNumber(payload)),
    });
  },

  deleteStudent: async (id) => {
    return apiRequest(`/students/${id}`, { method: 'DELETE' });
  },

  evaluateStudentLifecycle: async (id) => {
    return apiRequest(`/students/${id}`);
  },

  evaluateAllStudentLifecycles: async () => {
    return apiRequest('/students/export');
  },

  bulkUpdateStudents: async ({
    selectedStudentIds = [],
    updateFields = {},
  } = {}) => {
    return apiRequest('/students/bulk', {
      method: 'POST',
      body: JSON.stringify({
        selectedStudentIds,
        updateFields: normalizeUpdateFields(updateFields),
      }),
    });
  },

  bulkUpdateStudentStatus: async ({ selectedStudentIds = [], status }) => {
    return studentService.bulkUpdateStudents({
      selectedStudentIds,
      updateFields: { status },
    });
  },

  bulkReactivateStudents: async ({ selectedStudentIds = [], ...payload } = {}) => {
    return apiRequest('/students/bulk/reactivate', {
      method: 'POST',
      body: JSON.stringify({
        selectedStudentIds,
        updateFields: normalizeUpdateFields({ ...payload, status: 'active' }),
      }),
    });
  },

  bulkArchiveStudents: async ({ selectedStudentIds = [] } = {}) => {
    return apiRequest('/students/bulk/archive', {
      method: 'POST',
      body: JSON.stringify({
        selectedStudentIds,
        updateFields: {},
      }),
    });
  },

  bulkPermanentDeleteStudents: async ({ selectedStudentIds = [], force = false } = {}) => {
    return apiRequest('/students/bulk/permanent-delete', {
      method: 'POST',
      body: JSON.stringify({
        selectedStudentIds,
        updateFields: {},
        force,
      }),
    });
  },

  deleteStudentPermanently: async (id, force = false) => {
    return apiRequest(`/students/${id}/permanent${toQueryString({ force })}`, { method: 'DELETE' });
  },

  generateInitialCredentials: async (studentId) => {
    return initialCredentials(studentId);
  },

  resetStudentPassword: async (id) => {
    const result = await apiRequest(`/students/${id}/reset-password`, { method: 'POST' });
    return initialCredentials(result.studentId);
  },
};
