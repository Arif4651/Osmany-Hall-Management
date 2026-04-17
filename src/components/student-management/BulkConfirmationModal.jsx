import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function BulkConfirmationModal({
  isOpen,
  title,
  isSubmitting,
  summary,
  updateFields,
  isDestructive,
  typedValue,
  setTypedValue,
  onClose,
  onConfirm,
}) {
  const fieldEntries = Object.entries(updateFields || {});
  const destructiveLocked = isDestructive && typedValue !== 'DELETE';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      actions={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={isDestructive ? 'danger' : 'primary'} onClick={onConfirm} disabled={isSubmitting || destructiveLocked}>
            {isSubmitting ? 'Applying...' : 'Confirm'}
          </Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div className="student-summary-box">
          <p>Total matched students: {summary.totalMatched}</p>
          <p>Total selected students: {summary.totalSelected}</p>
          <p>Total excluded students: {summary.totalExcluded}</p>
        </div>

        {fieldEntries.length ? (
          <div>
            <strong>Update Preview</strong>
            <ul className="bullet-list" style={{ marginTop: '0.4rem' }}>
              {fieldEntries.map(([field, value]) => (
                <li key={field}>{field}: {String(value)}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {isDestructive ? (
          <label className="field-control">
            <span>Type DELETE to continue</span>
            <input value={typedValue} onChange={(event) => setTypedValue(event.target.value)} placeholder="DELETE" />
          </label>
        ) : null}
      </div>
    </Modal>
  );
}
