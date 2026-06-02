import { useEffect, useMemo, useState } from 'react';
import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import KeyValueList from '../../components/common/KeyValueList';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { profileService } from '../../services/profileService';
import { ROUTE_PATHS } from '../../constants/routePaths';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  useDocumentTitle('Profile');
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setErrorMessage('');

      try {
        const response = await profileService.getProfile();
        if (isMounted) setProfile(response);
      } catch (error) {
        if (isMounted) {
          setErrorMessage(error instanceof Error ? error.message : 'Failed to load profile.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadProfile();
    return () => {
      isMounted = false;
    };
  }, []);

  const profileFields = useMemo(
    () => [
      { label: 'Name', value: profile?.studentName },
      { label: 'Student ID', value: profile?.studentId },
      { label: 'Hall ID', value: profile?.hallId },
      { label: 'Hall Name', value: profile?.hallName },
      { label: 'Department', value: profile?.department },
      { label: 'Level / Year', value: profile?.level },
      { label: 'Room', value: profile?.roomNo },
      { label: 'Phone', value: profile?.mobileNumber },
      { label: 'Status', value: profile?.status },
    ],
    [profile],
  );

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Manage personal details used for hall operations and billing communication."
      />

      <section className="two-col-grid">
        <PageSection title="Personal Information">
          <Card>
            {isLoading ? <p className="muted-text">Loading profile...</p> : null}
            {errorMessage ? <p className="auth-error">{errorMessage}</p> : null}
            {!isLoading && !errorMessage ? <KeyValueList items={profileFields} /> : null}
          </Card>
        </PageSection>

        <PageSection title="Profile Actions">
          <Card className="action-card">
           
            <Button variant="secondary" onClick={() => navigate(ROUTE_PATHS.changePassword)}>Change Password</Button>
            <Button variant="ghost">Download Billing Statement</Button>
          </Card>
        </PageSection>
      </section>
    </div>
  );
}
