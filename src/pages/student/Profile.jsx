import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import KeyValueList from '../../components/common/KeyValueList';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { studentProfile } from '../../data/mock/studentData';
import { formatDate } from '../../utils/formatters';

export default function Profile() {
  useDocumentTitle('Profile');

  const profileFields = [
    { label: 'Name', value: studentProfile.name },
    { label: 'Student ID', value: studentProfile.studentId },
    { label: 'Program', value: studentProfile.program },
    { label: 'Room', value: studentProfile.roomNo },
    { label: 'Email', value: studentProfile.email },
    { label: 'Phone', value: studentProfile.phone },
    { label: 'Joined At', value: formatDate(studentProfile.joinedAt) },
    { label: 'Emergency Contact', value: studentProfile.emergencyContact },
  ];

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Manage personal details used for hall operations and billing communication."
      />

      <section className="two-col-grid">
        <PageSection title="Personal Information">
          <Card>
            <KeyValueList items={profileFields} />
          </Card>
        </PageSection>

        <PageSection title="Profile Actions">
          <Card className="action-card">
            <Button>Edit Profile</Button>
            <Button variant="secondary">Change Password</Button>
            <Button variant="ghost">Download Billing Statement</Button>
          </Card>
        </PageSection>
      </section>
    </div>
  );
}