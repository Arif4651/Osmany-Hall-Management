/**
 * Summarises a bulk selection against the current filter.
 *
 * `selectedIds` only ever grows from explicit user actions (a checkbox, "select all filtered")
 * and is reset on every reload (see useAdminStudentModule's loadStudents), so it's always a
 * subset of what's currently matched — nothing here needs the full matched id set just to count
 * against it.
 */
export function summarizeBulkSelection(totalMatched = 0, selectedIds = []) {
  const totalSelected = selectedIds.length;
  return {
    totalMatched,
    totalSelected,
    totalExcluded: Math.max(0, totalMatched - totalSelected),
  };
}
