import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_STUDENT_FILTERS } from '../types/student.types';
import { summarizeBulkSelection } from '../utils/bulkSelectionHelpers';
import { generateInitialCredentials } from '../utils/credentialHelpers';
import { getNextLevel } from '../utils/studentHelpers';
import { studentService } from '../services/studentService';
import { queryCache } from '../services/queryCache';
import { useToast } from '../context/ToastContext';

const DEFAULT_PAGE_SIZE = 10;

export default function useAdminStudentModule() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Load failures only. An action that fails reports through a toast instead, so a stale banner
  // never outlives the operation that produced it.
  const [errorMessage, setErrorMessage] = useState('');

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

  const withSubmitState = useCallback(async (fn, failureTitle = 'Action failed') => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await fn();
      await loadStudents();
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Operation failed.';
      toast.error(failureTitle, message);
      return {
        ok: false,
        message,
        validationErrors: error?.validationErrors || {},
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [loadStudents, toast]);

  const createStudent = useCallback(async (payload) => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      const created = await studentService.createStudent(payload);
      await Promise.all([loadStudents(), loadFilterOptions()]);
      // The credentials come from the id the server actually assigned, never from the submitted
      // form — those can differ, and handing over a password that does not work is worse than
      // handing over none.
      return {
        ok: true,
        student: created,
        credentials: generateInitialCredentials(created.studentId),
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

  // Every mutation names the student it touched: these actions fire from a row menu, so a bare
  // "saved" leaves the admin unsure which row the confirmation belongs to.
  const nameOf = useCallback(
    (id) => students.find((student) => student.id === id)?.studentName || 'Student',
    [students],
  );

  const updateStudent = useCallback((id, payload) => {
    return withSubmitState(async () => {
      const name = nameOf(id);
      await studentService.updateStudent(id, payload);
      toast.success('Student updated', `${name}'s information has been saved.`);
    }, 'Could not update student');
  }, [withSubmitState, toast, nameOf]);

  const markStudentInactive = useCallback((id) => {
    return withSubmitState(async () => {
      const name = nameOf(id);
      await studentService.deleteStudent(id);
      toast.success('Student moved to inactive', `${name} remains in records for audit and reactivation.`);
    }, 'Could not deactivate student');
  }, [withSubmitState, toast, nameOf]);

  const deleteStudentPermanently = useCallback((id, force = false) => {
    return withSubmitState(async () => {
      const name = nameOf(id);
      await studentService.deleteStudentPermanently(id, force);
      toast.success('Record permanently deleted', `${name}'s data was removed from the active store.`);
    }, 'Could not delete student');
  }, [withSubmitState, toast, nameOf]);

  const resetStudentPassword = useCallback((id) => {
    return withSubmitState(async () => {
      const name = nameOf(id);
      const credentials = await studentService.resetStudentPassword(id);
      // Pinned (duration 0) rather than timed: these credentials have to be passed on to the
      // student, and one that vanished on a timer would be gone for good — the reset would have
      // to be run again to see it. Dismissed by hand, with the details one click from the
      // clipboard.
      toast.success(
        `Password reset for ${name}`,
        `Username: ${credentials.defaultLoginId} · Password: ${credentials.defaultPassword} — the student must change it after logging in.`,
        {
          duration: 0,
          copyText: `Username: ${credentials.defaultLoginId}\nPassword: ${credentials.defaultPassword}`,
        },
      );
    }, 'Could not reset password');
  }, [withSubmitState, nameOf, toast]);

  const reactivateStudent = useCallback((id, payload) => {
    return withSubmitState(async () => {
      const name = nameOf(id);
      await studentService.bulkReactivateStudents({
        filters,
        selectedStudentIds: [id],
        ...payload,
      });
      toast.success('Student reactivated', `${name}'s login access was restored and validity updated.`);
    }, 'Could not reactivate student');
  }, [withSubmitState, filters, toast, nameOf]);

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

      toast.success('Bulk update completed', `${result.updatedCount} students updated.`);
      clearSelection();
    }, 'Bulk update failed');
  }, [withSubmitState, selectedIds, filters, clearSelection, toast]);

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
      toast.success('Archive completed', `${result.updatedCount} students archived.`);
      clearSelection();
    }, 'Bulk archive failed');
  }, [withSubmitState, selectedIds, filters, clearSelection, toast]);

  const bulkReactivateStudents = useCallback((payload) => {
    return withSubmitState(async () => {
      if (!selectedIds.length) throw new Error('Select students first.');
      const result = await studentService.bulkReactivateStudents({
        filters,
        selectedStudentIds: selectedIds,
        ...payload,
      });
      toast.success('Bulk reactivation completed', `${result.updatedCount} students reactivated.`);
      clearSelection();
    }, 'Bulk reactivation failed');
  }, [withSubmitState, selectedIds, filters, clearSelection, toast]);

  const bulkPermanentDeleteStudents = useCallback((force = false) => {
    return withSubmitState(async () => {
      if (!selectedIds.length) throw new Error('Select students first.');
      const result = await studentService.bulkPermanentDeleteStudents({
        filters,
        selectedStudentIds: selectedIds,
        force,
      });
      toast.success(
        'Permanent deletion completed',
        `${result.deletedCount} records permanently deleted. `
        + (result.skippedIds.length ? `${result.skippedIds.length} skipped (not eligible).` : 'No records were skipped.'),
      );
      clearSelection();
    }, 'Permanent deletion failed');
  }, [withSubmitState, selectedIds, filters, clearSelection, toast]);

  const evaluateAllLifecycles = useCallback(() => {
    return withSubmitState(async () => {
      await studentService.evaluateAllStudentLifecycles();
      toast.success('Lifecycle evaluation completed', 'Validity and due-based statuses were recalculated.');
    }, 'Lifecycle evaluation failed');
  }, [withSubmitState, toast]);

  const getFilteredStudentsForExport = useCallback(async () => {
    return studentService.getStudentsForExport({ filters });
  }, [filters]);

  return {
    students,
    isLoading,
    isSubmitting,
    errorMessage,
    setErrorMessage,

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
