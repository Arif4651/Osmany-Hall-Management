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

  // Matches the backend rule (StudentsController.PermanentDelete): only Inactive, Archived, or
  // Graduated students can be permanently deleted. Shown up front instead of letting the admin
  // hit Confirm and only find out from an error toast afterwards.
  const isEligible = student.permanentDeleteEligible;

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
          <Button
            variant="danger"
            onClick={handleDeletePermanent}
            disabled={isSubmitting || !isEligible}
            title={isEligible ? undefined : 'Mark this student Inactive, Archived, or Graduated first.'}
          >
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

        {!isEligible && (
          <div className="student-message student-message-error">
            {student.studentName} is currently <strong>{student.status}</strong>. Only students who
            are Inactive, Archived, or Graduated can be permanently deleted — mark them inactive
            below first.
          </div>
        )}

        <div className="inline-actions">
          <Button variant="secondary" onClick={handleMarkInactive} disabled={isSubmitting}>
            Mark Inactive (Safe)
          </Button>
        </div>
      </div>
    </Modal>
  );
}
