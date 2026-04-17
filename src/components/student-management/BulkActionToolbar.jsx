import Button from '../ui/Button';

export default function BulkActionToolbar({
  summary,
  hasSelection,
  onSelectAllFiltered,
  onClearSelection,
  onOpenBulkUpdate,
  onOpenBulkPromotion,
  onArchive,
  onReactivate,
  onOpenBulkDelete,
}) {
  return (
    <div className="student-bulk-toolbar">
      <div>
        <strong>
          Matched: {summary.totalMatched} | Selected: {summary.totalSelected} | Excluded: {summary.totalExcluded}
        </strong>
      </div>
      <div className="inline-actions">
        <Button variant="ghost" onClick={onSelectAllFiltered}>Select All Filtered</Button>
        <Button variant="ghost" onClick={onClearSelection}>Clear Selection</Button>
        <Button onClick={onOpenBulkUpdate} disabled={!hasSelection}>Bulk Update</Button>
        <Button onClick={onOpenBulkPromotion} disabled={!hasSelection}>Bulk Promote</Button>
        <Button variant="secondary" onClick={onReactivate} disabled={!hasSelection}>Reactivate</Button>
        <Button variant="secondary" onClick={onArchive} disabled={!hasSelection}>Archive</Button>
        <Button variant="danger" onClick={onOpenBulkDelete} disabled={!hasSelection}>Delete Permanently</Button>
      </div>
    </div>
  );
}
