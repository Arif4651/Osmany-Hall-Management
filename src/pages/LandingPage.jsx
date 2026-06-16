import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import useDocumentTitle from '../hooks/useDocumentTitle';
import mistLogo from '../assets/images/mist-logo.png';
import { BRAND_COPY, BRANDING } from '../constants/branding';

export default function LandingPage() {
  useDocumentTitle('Home');

  return (
    <div className="landing-page">
      <section className="hero">
        <div>
          <p className="hero-kicker">{BRAND_COPY.heroKicker}</p>
          <h1>{BRAND_COPY.heroTitle}</h1>
          <p>{BRAND_COPY.heroDescription}</p>

          <div className="hero-actions">
            <Link to="/login">
              <Button>
                Student Login <ArrowRight size={16} />
              </Button>
            </Link>
          </div>
        </div>

        <aside className="hero-brand-panel">
          <img src={mistLogo} alt={`${BRANDING.universityShortName} logo`} className="hero-logo" />
          <h3>{BRANDING.universityFullName}</h3>
          <p>{BRANDING.hallName}</p>
          <small>{BRANDING.motto}</small>
        </aside>
      </section>
    </div>
  );
}
