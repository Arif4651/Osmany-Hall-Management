import Card from '../ui/Card';

export default function EmptyState({ title, description }) {
  return (
    <Card className="empty-state">
      <h3>{title}</h3>
      <p>{description}</p>
    </Card>
  );
}