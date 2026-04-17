import { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import StudentFormFields from './StudentFormFields';

function toFormData(student) {
  if (!student) return null;
  return {
    studentName: student.studentName || '',
    studentId: student.studentId || '',
    department: student.department || '',
    hallId: student.hallId || '',
    mobileNumber: student.mobileNumber || '',
    level: student.level || 'Level-01',
    sessionYear: student.sessionYear || '',
    hallName: student.hallName || '',
    email: student.email || '',
    admissionDate: student.admissionDate || '',
    expectedGraduationDate: student.expectedGraduationDate || '',
    hallValidityEndDate: student.hallValidityEndDate || '',
    status: student.status || 'active',
  };
}

export default function EditStudentModal({
  student,
  isOpen,
  isSubmitting,
  onClose,
  onUpdate,
}) {
  const [formData, setFormData] = useState(null);
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && student) {
      setFormData(toFormData(student));
      setErrors({});
    }
  }, [isOpen, student]);

  if (!student || !formData) return null;

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const result = await onUpdate(student.id, formData);

    if (!result.ok) {
      setErrors(result.validationErrors || {});
      return;
    }

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Student"
      actions={(
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : 'Save Changes'}
          </Button>
        </>
      )}
    >
      <form onSubmit={handleSubmit}>
        <StudentFormFields
          formData={formData}
          errors={errors}
          onChange={handleChange}
          includeStatus
        />
      </form>
    </Modal>
  );
}
