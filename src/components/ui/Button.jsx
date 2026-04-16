import clsx from 'clsx';

const VARIANT_CLASS = {
  primary: 'btn-primary',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

export default function Button({
  variant = 'primary',
  type = 'button',
  className,
  children,
  ...rest
}) {
  return (
    <button type={type} className={clsx('btn', VARIANT_CLASS[variant], className)} {...rest}>
      {children}
    </button>
  );
}