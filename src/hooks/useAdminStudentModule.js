import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_STUDENT_FILTERS } from '../types/student.types';
import { summarizeBulkSelection } from '../utils/bulkSelectionHelpers';
import { getNextLevel } from '../utils/studentHelpers';
import { studentService } from '../services/studentService';
import { queryCache } from '../services/queryCache';
import { useToast } from '../context/ToastContext';

// No pagination on this page by design — the roster always loads as one page. 2000 comfortably
// covers a hall's real population; it also matches the backend's page-size ceiling
// (StudentsController.GetStudents).
const SHOW_ALL_PAGE_SIZE = 2000;

export default function useAdminStudentModule() {
  const toast = useToast();
  const [students, setStudents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  // Load failures only. An action that fails reports through a toast instead, so a stale banner
  // never outlives the operation that produced it.
  const [errorMessage, setErrorMessage] = useState('');

  const [filters, setFilters] = useState(DEFAULT_STUDENT_FILTERS);
  const [total, setTotal] = useState(0);
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
    // Selection is deliberately reset on every load — initial mount, a filter/search/sort
    // change, a manual refresh, or a reload after an action all funnel through here. This list
    // has no real pagination (the whole roster loads at once every time), so there is no
    // legitimate case for carrying a selection across a reload; a previous version tried to by
    // sending the current selection to the server and trusting whatever it echoed back, which is
    // exactly what caused the selection to silently snap back to "everything selected" after
    // actions. Selection should only ever change from an explicit user action (a checkbox click,
    // "select all filtered", or an explicit clear) — never as a side effect of fetching data.
    setSelectedIds([]);

    try {
      // page is always 1 here: this list never paginates.
      const response = await studentService.getStudents({ filters, page: 1, pageSize: SHOW_ALL_PAGE_SIZE });
      setStudents(response.items);
      setTotal(response.total);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load students.');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    loadFilterOptions().catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : 'Failed to load student filters.');
    });
  }, [loadFilterOptions]);

  const selectionSummary = useMemo(
    () => summarizeBulkSelection(total, selectedIds),
    [total, selectedIds],
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const updateFilter = useCallback((key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_STUDENT_FILTERS);
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

  // Fetched only on demand — the id list for every matching student, unbounded by page size.
  // Previously this was already sitting in state because the paged list endpoint downloaded it
  // on every page turn; now it costs a request only when the admin actually asks for it.
  const selectAllFiltered = useCallback(async () => {
    try {
      const ids = await studentService.getFilteredIds(filters);
      setSelectedIds(ids);
    } catch (error) {
      toast.error('Could not select all', error instanceof Error ? error.message : 'Please try again.');
    }
  }, [filters, toast]);

  const clearSelection = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const withSubmitState = useCallback(async (fn, failureTitle = 'Action failed') => {
    setIsSubmitting(true);
    setErrorMessage('');

    try {
      await fn();
      // loadStudents resets the selection itself on every reload (see its comment) — every
      // action that reaches here, single-row or bulk, has just done the one thing the admin
      // asked for, so there's nothing to carry forward.
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
      // The credentials come from what the server actually generated and assigned, never
      // derived here — the password is random and returned exactly once.
      return {
        ok: true,
        student: created,
        credentials: created.credentials,
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
      // Selection is cleared centrally by loadStudents (called via withSubmitState) after every
      // successful action.
    }, 'Bulk update failed');
  }, [withSubmitState, selectedIds, filters, toast]);

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
    }, 'Bulk archive failed');
  }, [withSubmitState, selectedIds, filters, toast]);

  const bulkReactivateStudents = useCallback((payload) => {
    return withSubmitState(async () => {
      if (!selectedIds.length) throw new Error('Select students first.');
      const result = await studentService.bulkReactivateStudents({
        filters,
        selectedStudentIds: selectedIds,
        ...payload,
      });
      toast.success('Bulk reactivation completed', `${result.updatedCount} students reactivated.`);
    }, 'Bulk reactivation failed');
  }, [withSubmitState, selectedIds, filters, toast]);

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
    }, 'Permanent deletion failed');
  }, [withSubmitState, selectedIds, filters, toast]);

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

    total,
    filterOptions,

    selectedIds,
    selectedSet,
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
