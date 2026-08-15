import { useState } from 'react';
import { Eye, EyeOff, LockKeyhole } from 'lucide-react';
import Modal from '../ui/Modal';
import Button from '../ui/Button';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export default function ChangePasswordModal({ isOpen, onClose }) {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // States to toggle visibility for each password input
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

    if (!form.currentPassword) {
      setError('Current password is required.');
      return;
    }

    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    setIsSubmitting(true);
    const result = await changePassword({
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    });
    setIsSubmitting(false);

    if (!result.ok) {
      setError(result.message || 'Failed to update password.');
      return;
    }

    // Close on success and confirm from the corner, rather than leaving a spent form on screen
    // with its submit button removed.
    handleClose();
    toast.success('Password updated', 'Use your new password the next time you sign in.');
  };

  const handleClose = () => {
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setError('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Change Password"
      actions={
        <>
          <Button variant="secondary" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </>
      }
    >
      {error && (
        <div className="student-modal-feedback is-error">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="auth-form" style={{ display: 'grid', gap: '0.85rem' }}>
        <label className="field-control">
          <span>Current Password</span>
          <div className="input-with-icon">
            <LockKeyhole size={16} style={{ color: 'var(--muted)' }} />
            <input
              type={showCurrent ? 'text' : 'password'}
              value={form.currentPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              required
              placeholder="Enter current password"
            />
            <button
              type="button"
              className="password-visibility-btn"
              onClick={() => setShowCurrent((prev) => !prev)}
              aria-label={showCurrent ? 'Hide password' : 'Show password'}
              aria-pressed={showCurrent}
            >
              {showCurrent ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="field-control">
          <span>New Password</span>
          <div className="input-with-icon">
            <LockKeyhole size={16} style={{ color: 'var(--muted)' }} />
            <input
              type={showNew ? 'text' : 'password'}
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              minLength={8}
              required
              placeholder="Enter at least 8 characters"
            />
            <button
              type="button"
              className="password-visibility-btn"
              onClick={() => setShowNew((prev) => !prev)}
              aria-label={showNew ? 'Hide password' : 'Show password'}
              aria-pressed={showNew}
            >
              {showNew ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>

        <label className="field-control">
          <span>Confirm New Password</span>
          <div className="input-with-icon">
            <LockKeyhole size={16} style={{ color: 'var(--muted)' }} />
            <input
              type={showConfirm ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              minLength={8}
              required
              placeholder="Re-enter new password"
            />
            <button
              type="button"
              className="password-visibility-btn"
              onClick={() => setShowConfirm((prev) => !prev)}
              aria-label={showConfirm ? 'Hide password' : 'Show password'}
              aria-pressed={showConfirm}
            >
              {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </label>
      </form>
    </Modal>
  );
}
