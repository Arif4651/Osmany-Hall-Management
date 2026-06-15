import { useState } from 'react';
import { Award, BookOpen, Facebook, Globe, Heart, Linkedin, Mail, MapPin, Sparkles } from 'lucide-react';
import devImage from '../../assets/images/developer-profile.jpg';
import useDocumentTitle from '../../hooks/useDocumentTitle';

export default function DeveloperProfile() {
  useDocumentTitle('Developer Profile');
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);

  return (
    <div className="dev-profile-container">
      {/* Hero Header Section */}
      <header className="dev-profile-hero">
        <div className="dev-profile-hero__overlay" />
        <div className="dev-profile-hero__content">
          <div className="dev-profile-avatar-wrap" onClick={() => setIsLightboxOpen(true)}>
            <img src={devImage} alt="Arif Abdullah" className="dev-profile-avatar clickable" />
            <span className="dev-profile-status-badge">
              <Sparkles size={14} /> Creator
            </span>
            <div className="dev-profile-avatar-hover-hint">
              <span>Click to view</span>
            </div>
          </div>
          <h1 className="dev-profile-name">Arif Abdullah</h1>
          <p className="dev-profile-title">Software Engineer & CSE Graduate, MIST</p>
          <div className="dev-profile-meta">
            <span>
              <MapPin size={15} /> Dhaka, Bangladesh
            </span>
            <span>
              <BookOpen size={15} /> MIST CSE 22
            </span>
          </div>
        </div>
      </header>

      {/* Main Grid Content */}
      <div className="dev-profile-grid">
        {/* Left column: About & Connect */}
        <div className="dev-profile-sidebar-card">
          <section className="dev-card-section">
            <h3>About Me</h3>
            <p>
              I am a passionate software developer, problem solver, and CSE graduate from the Military Institute of Science and Technology (MIST), having completed my undergraduate studies on 10 June 2026.
            </p>
            <p>
              I love building technology-driven solutions that address real-world challenges, enhance user experience, and drive organizational efficiency.
            </p>
          </section>

          <section className="dev-card-section dev-social-links">
            <h3>Connect with Me</h3>
            <a href="https://www.linkedin.com/in/arif-abdullah11/" target="_blank" rel="noopener noreferrer" className="dev-social-btn linkedin">
              <Linkedin size={18} />
              <span>LinkedIn Profile</span>
            </a>
            <a href="https://www.facebook.com/arif1066" target="_blank" rel="noopener noreferrer" className="dev-social-btn facebook">
              <Facebook size={18} />
              <span>Facebook Profile</span>
            </a>
            <a href="https://mail.google.com/mail/?view=cm&fs=1&to=arif465109@gmail.com" target="_blank" rel="noopener noreferrer" className="dev-social-btn email">
              <Mail size={18} />
              <span>Send an Email</span>
            </a>
          </section>
        </div>

        {/* Right column: Experience & Contributions */}
        <div className="dev-profile-main-card">
          <section className="dev-card-section">
            <h3>Key Role & Project</h3>
            <div className="dev-project-highlight">
              <div className="dev-project-icon">
                <Award size={24} />
              </div>
              <div className="dev-project-details">
                <h4>Mess Captain, Osmany Hall (2025 - 2026)</h4>
                <p>
                  While in Level-4, I had the privilege of serving as the Mess Captain of Osmany Hall. This role allowed me to closely observe the daily challenges of hall administration, manual dining logs, and billing complexity.
                </p>
              </div>
            </div>

            <div className="dev-project-highlight">
              <div className="dev-project-icon primary">
                <Globe size={24} />
              </div>
              <div className="dev-project-details">
                <h4>Osmany Hall Management System</h4>
                <p>
                  To tackle dining management inefficiencies, I proposed and developed the **Osmany Hall Management System** under the consultation of the **Directorate of Student Welfare (DSW)**. The system digitalizes daily meal counts, preferences, billing histories, and verification workflows, easing the administrative load and providing instant visibility to students.
                </p>
              </div>
            </div>

            <div className="dev-project-highlight">
              <div className="dev-project-icon secondary">
                <Sparkles size={24} />
              </div>
              <div className="dev-project-details">
                <h4>MIST Website Development Team</h4>
                <p>
                  Contributed as a key developer in designing and building the **New MIST Website**, upgrading the online presence and performance for the university.
                </p>
              </div>
            </div>
          </section>

          <footer className="dev-profile-footer">
            <Heart size={16} className="heart-icon" />
            <span>Thank you for visiting my profile. Please keep me in your prayers and best wishes as I continue my journey.</span>
          </footer>
        </div>
      </div>

      {/* Lightbox / Modal for profile image */}
      {isLightboxOpen && (
        <div className="dev-lightbox" onClick={() => setIsLightboxOpen(false)}>
          <button className="dev-lightbox__close" onClick={() => setIsLightboxOpen(false)}>&times;</button>
          <div className="dev-lightbox__content" onClick={(e) => e.stopPropagation()}>
            <img src={devImage} alt="Arif Abdullah" className="dev-lightbox__img" />
          </div>
        </div>
      )}
    </div>
  );
}
