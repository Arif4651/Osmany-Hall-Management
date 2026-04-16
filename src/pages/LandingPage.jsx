import { Link } from 'react-router-dom';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';
import Card from '../components/ui/Card';
import Button from '../components/ui/Button';
import useDocumentTitle from '../hooks/useDocumentTitle';
import { quickActions, dashboardHighlights, homeAnnouncements } from '../data/mock/commonData';
import mistLogo from '../assets/images/mist-logo.png';
import { BRAND_COPY, BRANDING } from '../constants/branding';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
  useDocumentTitle('Home');

  const { isAuthenticated, role } = useAuth();
  const dashboardPath = role === 'admin' ? '/admin/dashboard' : '/student/dashboard';

  return (
    <div className="landing-page">
      <section className="hero">
        <div>
          <p className="hero-kicker">{BRAND_COPY.heroKicker}</p>
          <h1>{BRAND_COPY.heroTitle}</h1>
          <p>{BRAND_COPY.heroDescription}</p>

          <div className="hero-actions">
            {isAuthenticated ? (
              <Link to={dashboardPath}>
                <Button>
                  Continue to Dashboard <ArrowRight size={16} />
                </Button>
              </Link>
            ) : (
              <Link to="/login">
                <Button>
                  Student Login <ArrowRight size={16} />
                </Button>
              </Link>
            )}
          </div>
        </div>

        <aside className="hero-brand-panel">
          <img src={mistLogo} alt={`${BRANDING.universityShortName} logo`} className="hero-logo" />
          <h3>{BRANDING.universityFullName}</h3>
          <p>{BRANDING.hallName}</p>
          <small>{BRANDING.motto}</small>
        </aside>
      </section>

      <section className="landing-grid">
        {quickActions.map((action) => (
          <Card key={action.title}>
            <div className="landing-card-head">
              <ShieldCheck size={18} />
              <h3>{action.title}</h3>
            </div>
            <p>{action.description}</p>
            <Link className="text-link" to={action.link}>
              Access Portal <ArrowRight size={14} />
            </Link>
          </Card>
        ))}
      </section>

      <section className="landing-grid">
        {dashboardHighlights.map((item) => (
          <Card key={item.title}>
            <div className="landing-card-head">
              <Sparkles size={18} />
              <h3>{item.title}</h3>
            </div>
            <p>{item.description}</p>
          </Card>
        ))}
      </section>

      <section className="landing-grid">
        <Card className="announcements-card">
          <h3>Operational Announcements</h3>
          <ul className="bullet-list">
            {homeAnnouncements.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Card>
      </section>
    </div>
  );
}
