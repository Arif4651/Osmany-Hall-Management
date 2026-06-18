import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_STUDENT_FILTERS } from '../types/student.types';
import { summarizeBulkSelection } from '../utils/bulkSelectionHelpers';
import { getCredentialNotice } from '../utils/credentialHelpers';
import { getNextLevel } from '../utils/studentHelpers';
import { studentService } from '../services/studentService';
import { queryCache } from '../services/queryCache';

const DEFAULT_PAGE_SIZE = 10;

export default function useAdminStudentModule() {
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successNotice, setSuccessNotice] = useState(null);

  const [filters, setFilters] = useState(DEFAULT_STUDENT_FILTERS);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filteredIds, setFilteredIds] = useState([]);
  const [filterOptions, setFilterOptions] = useState({
    departments: [],
    levels: [],
    sessions: [],
    halls: [],
  });

  const [selectedIds, setSelectedIds] = useState([]);

  const loadFilterOptions = useCallback(async () => {
    // Cache for 10 minutes — departments/levels/halls rarely change
    const cached = queryCache.get('student-filter-options');
    if (cached) {
      setFilterOptions(cached);
      return;
    }
    const options = await studentService.getFilterOptions();
    queryCache.set('student-filter-options', options, 10 * 60_000);
    setFilterOptions(options);
  }, []);

  const loadStudents = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const response = await studentService.getStudents({ filters, page, pageSize });
      setStudents(response.items);
      setTotal(response.total);
      setTotalPages(response.totalPages);
      setFilteredIds(response.filteredIds);
      setPage(response.page);

      setSelectedIds((prev) => prev.filter((id) => response.filteredIds.includes(id)));
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load students.');
    } finally {
      setIsLoading(false);
    }
  }, [filters, page, pageSize]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadFilterOptions().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load student filters.');
    });
  }, [loadFilterOptions]);

  const selectionSummary = useMemo(
    () => summarizeBulkSelection(filteredIds, selectedIds),
    [filteredIds, selectedIds],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_STUDENT_FILTERS);
    setPage(1);
  }, []);

  const toggleStudentSelection = useCallback((id) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((entry) => entry !== id) : [...prev, id]));
  }, []);

  const togglePageSelection = useCallback((pageIds) => {
    const allPageSelected = pageIds.every((id) => selectedSet.has(id));

    if (allPageSelected) {
      setSelectedIds((prev) => prev.filter((id) => !pageIds.includes(id)));
      return;
    }

    setSelectedIds((prev) => {
      const merged = new Set(prev);
      pageIds.forEach((id) => merged.add(id));
      return Array.from(merged);
    });
  }, [selectedSet]);

  const selectAllFiltered = useCallback(() => {
    setSelectedIds(filteredIds);
  }, [filteredIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const withSubmitState = useCallback(async (fn) => {
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessNotice(null);

    try {
      await fn();
      await loadStudents();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operation failed.';
      setErrorMessage(message);
      return {
        ok: false,
        message,
        validationErrors: error?.validationErrors || {},
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [loadStudents]);

  const createStudent = useCallback(async (payload) => {
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessNotice(null);

    try {
      const created = await studentService.createStudent(payload);
      await Promise.all([loadStudents(), loadFilterOptions()]);
      return {
        ok: true,
        notice: getCredentialNotice(created.studentId),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operation failed.';
      return {
        ok: false,
        message,
        validationErrors: error?.validationErrors || {},
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [loadStudents, loadFilterOptions]);

  const updateStudent = useCallback((id, payload) => {
    return withSubmitState(async () => {
      await studentService.updateStudent(id, payload);
      setSuccessNotice({ title: 'Student updated successfully', lines: ['Student information has been saved.'] });
    });
  }, [withSubmitState]);

  const markStudentInactive = useCallback((id) => {
    return withSubmitState(async () => {
      await studentService.deleteStudent(id);
      setSuccessNotice({ title: 'Student moved to inactive', lines: ['The student remains in records for audit and reactivation.'] });
    });
  }, [withSubmitState]);

  const deleteStudentPermanently = useCallback((id, force = false) => {
    return withSubmitState(async () => {
      await studentService.deleteStudentPermanently(id, force);
      setSuccessNotice({ title: 'Record permanently deleted', lines: ['The student data has been removed from the active store.'] });
    });
  }, [withSubmitState]);

  const resetStudentPassword = useCallback((id) => {
    return withSubmitState(async () => {
      const credentials = await studentService.resetStudentPassword(id);
      setSuccessNotice({
        title: 'Password reset completed',
        lines: [
          `Default username: ${credentials.defaultLoginId}`,
          `Default password: ${credentials.defaultPassword}`,
          'Student must change password after login.',
        ],
      });
    });
  }, [withSubmitState]);

  const reactivateStudent = useCallback((id, payload) => {
    return withSubmitState(async () => {
      await studentService.bulkReactivateStudents({
        filters,
        selectedStudentIds: [id],
        ...payload,
      });
      setSuccessNotice({ title: 'Student reactivated', lines: ['Login access restored and validity updated.'] });
    });
  }, [withSubmitState, filters]);

  const bulkUpdateStudents = useCallback((updateFields) => {
    return withSubmitState(async () => {
      if (!selectedIds.length) {
        throw new Error('Select at least one student first.');
      }

      const result = await studentService.bulkUpdateStudents({
        filters,
        selectedStudentIds: selectedIds,
        updateFields,
      });

      setSuccessNotice({
        title: 'Bulk update completed',
        lines: [`${result.updatedCount} students updated.`],
      });
      clearSelection();
    });
  }, [withSubmitState, selectedIds, filters, clearSelection]);

  const bulkPromoteStudents = useCallback((targetLevel) => {
    return bulkUpdateStudents({ level: targetLevel });
  }, [bulkUpdateStudents]);

  const bulkPromoteToNextLevel = useCallback(() => {
    if (!selectedIds.length) {
      return Promise.resolve({ ok: false, message: 'Select students for promotion.' });
    }

    const selectedStudents = students.filter((student) => selectedIds.includes(student.id));
    const nextLevel = getNextLevel(selectedStudents[0]?.level || 'Level-01');
    return bulkPromoteStudents(nextLevel);
  }, [selectedIds, students, bulkPromoteStudents]);

  const bulkArchiveStudents = useCallback(() => {
    return withSubmitState(async () => {
      if (!selectedIds.length) throw new Error('Select students first.');
      const result = await studentService.bulkArchiveStudents({
        filters,
        selectedStudentIds: selectedIds,
      });
      setSuccessNotice({ title: 'Archive completed', lines: [`${result.updatedCount} students archived.`] });
      clearSelection();
    });
  }, [withSubmitState, selectedIds, filters, clearSelection]);

  const bulkReactivateStudents = useCallback((payload) => {
    return withSubmitState(async () => {
      if (!selectedIds.length) throw new Error('Select students first.');
      const result = await studentService.bulkReactivateStudents({
        filters,
        selectedStudentIds: selectedIds,
        ...payload,
      });
      setSuccessNotice({ title: 'Bulk reactivation completed', lines: [`${result.updatedCount} students reactivated.`] });
      clearSelection();
    });
  }, [withSubmitState, selectedIds, filters, clearSelection]);

  const bulkPermanentDeleteStudents = useCallback((force = false) => {
    return withSubmitState(async () => {
      if (!selectedIds.length) throw new Error('Select students first.');
      const result = await studentService.bulkPermanentDeleteStudents({
        filters,
        selectedStudentIds: selectedIds,
        force,
      });
      setSuccessNotice({
        title: 'Permanent deletion completed',
        lines: [
          `${result.deletedCount} records permanently deleted.`,
          result.skippedIds.length ? `${result.skippedIds.length} skipped (not eligible).` : 'No records were skipped.',
        ],
      });
      clearSelection();
    });
  }, [withSubmitState, selectedIds, filters, clearSelection]);

  const evaluateAllLifecycles = useCallback(() => {
    return withSubmitState(async () => {
      await studentService.evaluateAllStudentLifecycles();
      setSuccessNotice({
        title: 'Lifecycle evaluation completed',
        lines: ['Validity and due-based statuses were recalculated.'],
      });
    });
  }, [withSubmitState]);

  const getFilteredStudentsForExport = useCallback(async () => {
    return studentService.getStudentsForExport({ filters });
  }, [filters]);

  return {
    students,
    isLoading,
    isSubmitting,
    errorMessage,
    setErrorMessage,
    successNotice,
    setSuccessNotice,

    filters,
    updateFilter,
    resetFilters,

    page,
    pageSize,
    setPage,
    setPageSize,
    total,
    totalPages,
    filterOptions,

    selectedIds,
    selectedSet,
    filteredIds,
    selectionSummary,
    toggleStudentSelection,
    togglePageSelection,
    selectAllFiltered,
    clearSelection,

    createStudent,
    updateStudent,
    markStudentInactive,
    deleteStudentPermanently,
    resetStudentPassword,
    reactivateStudent,

    bulkUpdateStudents,
    bulkPromoteStudents,
    bulkPromoteToNextLevel,
    bulkArchiveStudents,
    bulkReactivateStudents,
    bulkPermanentDeleteStudents,

    evaluateAllLifecycles,
    getFilteredStudentsForExport,
    refresh: loadStudents,
  };
}
