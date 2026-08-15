import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function BulkConfirmationModal({
  isOpen,
  title,
  isSubmitting,
  summary,
  updateFields,
  isDestructive,
  destructiveNote,
  onClose,
  onConfirm,
}) {
  const fieldEntries = Object.entries(updateFields || {});

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      actions={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={isDestructive ? 'danger' : 'primary'} onClick={onConfirm} disabled={isSubmitting}>
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

        {fieldEntries.length > 0 ? (
          <div className="student-summary-box">
            {fieldEntries.map(([key, value]) => (
              <p key={key}>
                <strong>{key}:</strong> {value}
              </p>
            ))}
          </div>
        ) : null}

        {isDestructive ? (
          <div style={{
            marginTop: '0.5rem',
            padding: '0.75rem',
            background: '#fee',
            border: '1px solid #fcc',
            borderRadius: '4px',
            color: '#c00'
          }}>
            {destructiveNote || 'Please review the affected records before confirming.'}
          </div>
        ) : null}
      </div>
    </Modal>
  );
}