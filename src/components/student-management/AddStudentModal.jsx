import { useEffect, useMemo, useState } from 'react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { DEFAULT_STUDENT_FORM } from '../../types/student.types';
import StudentFormFields from './StudentFormFields';
import { useAuth } from '../../context/AuthContext';

export default function AddStudentModal({ isOpen, isSubmitting, onClose, onCreate }) {
  const { user, role } = useAuth();
  const isWingAdmin = role === 'male_wing_admin' || role === 'female_wing_admin';
  // Determine the locked gender for wing admins (e.g. 'Male' or 'Female')
  const lockedGender = isWingAdmin && user?.wing ? user.wing : null;

  const [formData, setFormData] = useState({ ...DEFAULT_STUDENT_FORM });
  const [errors, setErrors] = useState({});
  const [feedback, setFeedback] = useState(null);

  // When the modal opens (or the wing resolves), ensure the gender is correctly seeded
  useEffect(() => {
    if (isOpen && lockedGender) {
      setFormData((prev) => ({ ...prev, gender: lockedGender }));
    }
  }, [isOpen, lockedGender]);

  const canSubmit = useMemo(() => !isSubmitting, [isSubmitting]);

  const handleChange = (key, value) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: '' }));
    setFeedback(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    // Build the payload — always override gender with the locked wing gender for wing admins
    const payload = {
      ...formData,
      status: 'active',
      ...(lockedGender ? { gender: lockedGender } : {}),
    };

    const result = await onCreate(payload);

    if (!result.ok) {
      setErrors(result.validationErrors || {});
      setFeedback({
        type: 'error',
        title: 'Could not add student',
        lines: [result.message || 'Request failed.'],
      });
      return;
    }

    setFormData({ ...DEFAULT_STUDENT_FORM, ...(lockedGender ? { gender: lockedGender } : {}) });
    setErrors({});
    setFeedback({
      type: 'success',
      title: result.notice?.title || 'Student created successfully',
      lines: result.notice?.lines || ['Student account has been created.'],
    });
  };

  const handleClose = () => {
    setFormData({ ...DEFAULT_STUDENT_FORM, ...(lockedGender ? { gender: lockedGender } : {}) });
    setErrors({});
    setFeedback(null);
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
      {feedback ? (
        <div className={`student-modal-feedback ${feedback.type === 'error' ? 'is-error' : 'is-success'}`}>
          <strong>{feedback.title}</strong>
          {feedback.lines?.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      ) : null}
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
