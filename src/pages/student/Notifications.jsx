import PageHeader from '../../components/common/PageHeader';
import PageSection from '../../components/layout/PageSection';
import Card from '../../components/ui/Card';
import useDocumentTitle from '../../hooks/useDocumentTitle';
import useStudentPortalData from '../../hooks/useStudentPortalData';
import { formatDate } from '../../utils/formatters';

export default function Notifications() {
  useDocumentTitle('Notifications');
  const { isLoading, errorMessage, notifications } = useStudentPortalData();

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Stay updated with billing reminders, approvals, and operational notices."
      />

      <PageSection title="Inbox">
        {errorMessage ? <div className="student-message student-message-error">{errorMessage}</div> : null}
        {isLoading ? <p className="muted-text">Loading notifications...</p> : null}
        <div className="stack-list">
          {notifications.length ? notifications.map((item) => (
            <Card key={item.id} className={`notification-card ${item.isRead ? 'is-read' : 'is-unread'}`}>
              <div className="notification-head">
                <h4>{item.title}</h4>
                <small>{formatDate(item.date)}</small>
              </div>
              <p>{item.description}</p>
            </Card>
          )) : <p className="muted-text">No notifications found.</p>}
        </div>
      </PageSection>
    </div>
  );
}