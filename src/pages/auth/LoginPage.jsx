import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LockKeyhole, Mail, ShieldAlert } from 'lucide-react';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import mistLogo from '../../assets/images/mist-logo.png';
import { BRANDING } from '../../constants/branding';
import { useAuth } from '../../context/AuthContext';
import { ROUTE_PATHS } from '../../constants/routePaths';

function getDefaultCredentials(mode) {
  if (mode === 'admin') {
    return { email: 'admin@mist.ac.bd', password: 'Admin@123' };
  }

  return { email: '2023001', password: '2023001' };
}

export default function LoginPage({ mode = 'student' }) {
  const isAdminMode = mode === 'admin';
  useDocumentTitle(isAdminMode ? 'Hall Admin Login' : 'Student Login');

  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, role: activeRole, loginStudent, loginAdmin } = useAuth();

  const [form, setForm] = useState(() => getDefaultCredentials(mode));
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  if (isAuthenticated) {
    return (
      <Navigate
        to={activeRole === 'admin' ? ROUTE_PATHS.adminDashboard : ROUTE_PATHS.studentDashboard}
        replace
      />
    );
  }

  const fromPath = location.state?.from?.pathname;

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);

    const authAction = isAdminMode ? loginAdmin : loginStudent;
    const result = await authAction(form);

    if (!result.ok) {
      setError(result.message);
      setIsSubmitting(false);
      return;
    }

    const roleHome = result.user.role === 'admin' ? ROUTE_PATHS.adminDashboard : ROUTE_PATHS.studentDashboard;
    navigate(fromPath || roleHome, { replace: true });
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="auth-brand">
          <div className="auth-brand-content">
            <img src={mistLogo} alt="MIST logo" className="auth-logo" />
            <p className="auth-brand-kicker">{isAdminMode ? 'Restricted Admin Access' : 'Official Residence Portal'}</p>
            <h1>{BRANDING.hallName}</h1>
            <p>{BRANDING.universityFullName}</p>
            <small>{BRANDING.motto}</small>
          </div>
        </section>

        <Card className="auth-card">
          <h2>{isAdminMode ? 'Hall Admin Login' : 'Student Login'}</h2>
          <p>
            {isAdminMode
              ? 'Authorized administrative personnel only.'
              : 'Sign in to continue to Osmany Hall student portal.'}
          </p>

          <form onSubmit={handleSubmit} className="auth-form">
            <label className="field-control" htmlFor="email">
              <span>{isAdminMode ? 'Email' : 'Student ID'}</span>
              <div className="input-with-icon">
                <Mail size={16} />
                <input
                  id="email"
                  type={isAdminMode ? 'email' : 'text'}
                  value={form.email}
                  onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))}
                  required
                />
              </div>
            </label>

            <label className="field-control" htmlFor="password">
              <span>Password</span>
              <div className="input-with-icon">
                <LockKeyhole size={16} />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={form.password}
                  onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))}
                  required
                />
                <button
                  type="button"
                  className="password-visibility-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>

            {error ? <p className="auth-error">{error}</p> : null}

            <Button type="submit" className="auth-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          <div className="auth-hint">
            <p>Demo credentials:</p>
            <small>{isAdminMode ? 'admin@mist.ac.bd / Admin@123' : '2023001 / 2023001'}</small>
            {isAdminMode ? (
              <small className="auth-warning">
                <ShieldAlert size={13} /> Admin route: <code>/halladmin</code>
              </small>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
