import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';

export default function ReactivateStudentModal({
  student,
  isOpen,
  isSubmitting,
  onClose,
  onReactivate,
}) {
  const [payload, setPayload] = useState({});

  useEffect(() => {
    if (isOpen && student) {
      setPayload({});
    }
  }, [isOpen, student]);

  if (!student) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await onReactivate(student.id, payload);
    if (result.ok) {
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Reactivate Student"
      actions={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Reactivating...' : 'Reactivate'}
          </Button>
        </>
      )}
    >
      <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.8rem' }}>
        <p>
          Reactivation will set status to active and restore login access.
        </p>
      </form>
    </Modal>
  );
}
