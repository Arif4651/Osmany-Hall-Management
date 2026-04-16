import clsx from 'clsx';

export default function Card({ className, children }) {
  return <section className={clsx('card', className)}>{children}</section>;
}