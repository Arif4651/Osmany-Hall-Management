import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function DeleteStudentModal({
  student,
  isOpen,
  isSubmitting,
  onClose,
  onMarkInactive,
  onDeletePermanent,
}) {
  if (!student) return null;

  const handleClose = () => {
    onClose();
  };

  const handleMarkInactive = async () => {
    await onMarkInactive(student.id);
    handleClose();
  };

  const handleDeletePermanent = async () => {
    await onDeletePermanent();
    handleClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Remove / Delete Student"
      actions={(
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button variant="danger" onClick={handleDeletePermanent} disabled={isSubmitting}>
            Permanently Delete
          </Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <p>
          <strong>Warning:</strong> Permanent deletion will remove this student record completely. 
          This action cannot be undone.
        </p>

        <div className="inline-actions">
          <Button variant="secondary" onClick={handleMarkInactive} disabled={isSubmitting}>
            Mark Inactive (Safe)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
