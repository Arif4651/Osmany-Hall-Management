import { MoreVertical } from 'lucide-react';

export default function StudentActionMenu({ student, onAction }) {
  const menuItems = [
    { key: 'view', label: 'View Details' },
    { key: 'edit', label: 'Edit Student' },
    { key: 'resetPassword', label: 'Reset Password' },
    { key: 'reactivate', label: 'Reactivate Student' },
    { key: 'markInactive', label: 'Mark Inactive' },
    { key: 'archive', label: 'Archive Student' },
    { key: 'remove', label: 'Remove Student' },
    { key: 'deletePermanent', label: 'Delete Permanently', danger: true },
  ];

  return (
    <details className="student-action-menu">
      <summary aria-label="Student row actions">
        <MoreVertical size={16} />
      </summary>
      <div className="student-action-menu-dropdown" role="menu">
        {menuItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={item.danger ? 'is-danger' : ''}
            onClick={() => onAction(item.key, student)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </details>
  );
}
