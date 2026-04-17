import { useMemo, useState } from 'react';
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
  const [typed, setTyped] = useState('');

  const canDelete = useMemo(() => typed === 'DELETE', [typed]);

  if (!student) return null;

  const handleClose = () => {
    setTyped('');
    onClose();
  };

  const handleMarkInactive = async () => {
    await onMarkInactive(student.id);
    handleClose();
  };

  const handleDeletePermanent = async () => {
    if (!canDelete) return;
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
          <Button variant="danger" disabled={!canDelete || isSubmitting} onClick={handleDeletePermanent}>
            Permanently Delete
          </Button>
        </>
      )}
    >
      <div style={{ display: 'grid', gap: '0.9rem' }}>
        <p>
          For regular offboarding, use safe removal. Permanent delete is only for duplicates, invalid records,
          or archived data after final review.
        </p>

        <div className="inline-actions">
          <Button variant="secondary" onClick={handleMarkInactive} disabled={isSubmitting}>
            Mark Inactive (Safe)
          </Button>
        </div>

        <label className="field-control">
          <span>Type DELETE to permanently remove this student record</span>
          <input value={typed} onChange={(event) => setTyped(event.target.value)} placeholder="DELETE" />
        </label>
      </div>
    </Modal>
  );
}
