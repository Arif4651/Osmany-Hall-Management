import { toStatusLabel } from '../../utils/studentLifecycleHelpers';

const STATUS_STYLE = {
  active: { background: '#dcfce7', color: '#166534' },
  pending_clearance: { background: '#fff3d3', color: '#9a620e' },
  inactive: { background: '#e2e8f0', color: '#334155' },
  graduated: { background: '#dbeafe', color: '#1c4cc0' },
  archived: { background: '#f1f5f9', color: '#475569' },
};

export default function StudentStatusBadge({ status }) {
  const style = STATUS_STYLE[status] || STATUS_STYLE.archived;

  return (
    <span
      style={{
        borderRadius: '999px',
        fontSize: '0.75rem',
        fontWeight: 700,
        letterSpacing: '0.04em',
        padding: '0.24rem 0.56rem',
        display: 'inline-flex',
        alignItems: 'center',
        textTransform: 'capitalize',
        background: style.background,
        color: style.color,
      }}
    >
      {toStatusLabel(status)}
    </span>
  );
}
