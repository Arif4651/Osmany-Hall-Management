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
          {actions.map(({ label, variant = 'secondary', onClick, ...actionProps }) => (
            <Button key={label} variant={variant} onClick={onClick} {...actionProps}>
              {label}
            </Button>
          ))}
        </div>
      ) : null}
    </header>
  );
}