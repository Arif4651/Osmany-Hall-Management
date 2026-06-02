import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_PATHS } from '../../constants/routePaths';

export default function ChangePasswordPage() {
  useDocumentTitle('Change Password');
  const navigate = useNavigate();
  const { isAuthenticated, role, changePassword } = useAuth();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isAuthenticated) {
    return <Navigate to={ROUTE_PATHS.login} replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');

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
      setError(result.message);
      return;
    }

    navigate(role === 'admin' ? ROUTE_PATHS.adminDashboard : ROUTE_PATHS.studentDashboard, { replace: true });
  };

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <h2>Change Password</h2>
        <p>Create a new password before continuing to the portal.</p>

        <form onSubmit={handleSubmit} className="auth-form">
          <label className="field-control">
            <span>Current Password</span>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, currentPassword: event.target.value }))}
              required
            />
          </label>

          <label className="field-control">
            <span>New Password</span>
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, newPassword: event.target.value }))}
              minLength={8}
              required
            />
          </label>

          <label className="field-control">
            <span>Confirm Password</span>
            <input
              type="password"
              value={form.confirmPassword}
              onChange={(event) => setForm((prev) => ({ ...prev, confirmPassword: event.target.value }))}
              minLength={8}
              required
            />
          </label>

          {error ? <p className="auth-error">{error}</p> : null}

          <Button type="submit" className="auth-submit" disabled={isSubmitting}>
            {isSubmitting ? 'Updating...' : 'Update Password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
