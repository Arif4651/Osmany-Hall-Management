import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import { studentNotifications } from '../../data/mock/studentData';
import { formatDate } from '../../utils/formatters';

export default function Notifications() {
  useDocumentTitle('Notifications');

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Stay updated with billing reminders, approvals, and operational notices."
        actions={[{ label: 'Mark All As Read', variant: 'secondary', onClick: () => null }]}
      />

      <PageSection title="Inbox">
        <div className="stack-list">
          {studentNotifications.map((item) => (
            <Card key={item.id} className={`notification-card ${item.isRead ? 'is-read' : 'is-unread'}`}>
              <div className="notification-head">
                <h4>{item.title}</h4>
                <small>{formatDate(item.date)}</small>
              </div>
              <p>{item.description}</p>
              {!item.isRead ? <Button variant="ghost">Mark as Read</Button> : null}
            </Card>
          ))}
        </div>
      </PageSection>
    </div>
  );
}