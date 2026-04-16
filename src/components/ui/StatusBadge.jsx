import clsx from 'clsx';
import { STATUS_TONE } from '../../constants/status';

const TONE_CLASS = {
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'badge-neutral',
};

export default function StatusBadge({ value }) {
  const normalized = String(value || '').toLowerCase();
  const tone = STATUS_TONE[normalized] || 'neutral';

  return <span className={clsx('badge', TONE_CLASS[tone])}>{value}</span>;
}