import { useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { DEFAULT_STUDENT_FORM } from '../../types/student.types';
import StudentFormFields from './StudentFormFields';

export default function AddStudentModal({ isOpen, isSubmitting, onClose, onCreate }) {
  const [formData, setFormData] = useState({ ...DEFAULT_STUDENT_FORM });
  const [errors, setErrors] = useState({});

  const canSubmit = useMemo(
    () => !isSubmitting,
    [isSubmitting],
  );

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await onCreate({ ...formData, status: 'active' });

    if (!result.ok) {
      setErrors(result.validationErrors || {});
      return;
    }

    setFormData({ ...DEFAULT_STUDENT_FORM });
    setErrors({});
    onClose();
  };

  const handleClose = () => {
    setFormData({ ...DEFAULT_STUDENT_FORM });
    setErrors({});
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Add New Student"
      actions={(
        <>
          <Button variant="secondary" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? 'Creating...' : 'Create Student'}
          </Button>
        </>
      )}
    >
      <form onSubmit={handleSubmit}>
        <StudentFormFields
          formData={formData}
          errors={errors}
          onChange={handleChange}
          includeStatus={false}
        />
      </form>
      <div className="student-helper-note">
        Initial credentials are generated automatically using Student ID.
      </div>
    </Modal>
  );
}
