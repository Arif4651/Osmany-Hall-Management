export function summarizeBulkSelection(filteredIds = [], selectedIds = []) {
  const filteredSet = new Set(filteredIds);
  const selectedInFilter = selectedIds.filter((id) => filteredSet.has(id));

  return {
    totalMatched: filteredIds.length,
    totalSelected: selectedInFilter.length,
    totalExcluded: Math.max(0, filteredIds.length - selectedInFilter.length),
    excludedIds: filteredIds.filter((id) => !selectedInFilter.includes(id)),
  };
}
