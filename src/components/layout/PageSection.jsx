import clsx from 'clsx';

export default function PageSection({ title, subtitle, children, className }) {
  return (
    <section className={clsx('page-section', className)}>
      {(title || subtitle) && (
        <header className="section-header">
          {title ? <h3>{title}</h3> : null}
          {subtitle ? <p>{subtitle}</p> : null}
        </header>
      )}
      {children}
    </section>
  );
}