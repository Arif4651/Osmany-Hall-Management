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
  const [payload, setPayload] = useState({ hallValidityEndDate: '', expectedGraduationDate: '' });

  useEffect(() => {
    if (isOpen && student) {
      setPayload({
        hallValidityEndDate: student.hallValidityEndDate || '',
        expectedGraduationDate: student.expectedGraduationDate || '',
      });
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
          Reactivation will set status to active, restore login access, and update lifecycle dates.
        </p>
        <label className="field-control">
          <span>Hall Validity End Date</span>
          <input
            type="date"
            value={payload.hallValidityEndDate}
            onChange={(event) => setPayload((prev) => ({ ...prev, hallValidityEndDate: event.target.value }))}
          />
        </label>
        <label className="field-control">
          <span>Expected Graduation Date</span>
          <input
            type="date"
            value={payload.expectedGraduationDate}
            onChange={(event) => setPayload((prev) => ({ ...prev, expectedGraduationDate: event.target.value }))}
          />
        </label>
      </form>
    </Modal>
  );
}
