import Button from '../ui/Button';

export default function PageHeader({ title, description, actions }) {
  return (
    <header className="page-header">
      <div>
        <h1>{title}</h1>
        {description ? <p>{description}</p> : null}
      </div>
      {actions?.length ? (
        <div className="page-header-actions">
          {actions.map((action) => (
            <Button key={action.label} variant={action.variant || 'secondary'} onClick={action.onClick}>
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </header>
  );
}