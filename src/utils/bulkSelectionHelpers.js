/**
 * Summarises a bulk selection against the current filter.
 *
 * `selectedIds` is assumed already pruned to ids that match the current filter — the student
 * list response only ever returns ids from `selectedIds` that still match (see
 * useAdminStudentModule's loadStudents), so nothing here needs the full matched id set just to
 * count against it.
 */
export function summarizeBulkSelection(totalMatched = 0, selectedIds = []) {
  const totalSelected = selectedIds.length;
  return {
    totalMatched,
    totalSelected,
    totalExcluded: Math.max(0, totalMatched - totalSelected),
  };
}
