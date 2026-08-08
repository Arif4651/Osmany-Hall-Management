import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { MoreVertical } from 'lucide-react';

const MENU_ITEMS = [
  { key: 'view', label: 'View Details' },
  { key: 'edit', label: 'Edit Student' },
  { key: 'resetPassword', label: 'Reset Password' },
  { key: 'reactivate', label: 'Reactivate Student' },
  { key: 'markInactive', label: 'Mark Inactive' },
  { key: 'archive', label: 'Archive Student' },
  { key: 'remove', label: 'Remove Student' },
  { key: 'deletePermanent', label: 'Delete Permanently', danger: true },
];

const MENU_WIDTH = 220;
const VIEWPORT_GAP = 8;

// The row lives inside a scrollable table wrapper, so an absolutely positioned
// dropdown would be clipped by it. Fixed positioning escapes that clip; the
// coordinates are measured from the trigger each time the menu opens.
export default function StudentActionMenu({ student, onAction }) {
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const [coords, setCoords] = useState(null);
  const isOpen = coords !== null;

  const close = useCallback(() => setCoords(null), []);

  const open = () => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({
      top: rect.bottom + 6,
      left: Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - VIEWPORT_GAP),
      anchorTop: rect.top,
    });
  };

  // Flip above the trigger when the menu would run past the bottom edge.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const menu = menuRef.current;
    if (!menu) return;

    const height = menu.offsetHeight;
    const overflowsBottom = coords.top + height > window.innerHeight - VIEWPORT_GAP;
    const nextTop = overflowsBottom
      ? Math.max(VIEWPORT_GAP, coords.anchorTop - height - 6)
      : coords.top;
    const nextLeft = Math.max(VIEWPORT_GAP, coords.left);

    if (nextTop !== coords.top || nextLeft !== coords.left) {
      setCoords((current) => (current ? { ...current, top: nextTop, left: nextLeft } : current));
    }
  }, [isOpen, coords]);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handlePointerDown = (event) => {
      if (menuRef.current?.contains(event.target)) return;
      if (triggerRef.current?.contains(event.target)) return;
      close();
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') close();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    // Any scroll (page or table wrapper) invalidates the measured position.
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [isOpen, close]);

  return (
    <div className="student-action-menu">
      <button
        ref={triggerRef}
        type="button"
        className="student-action-menu-trigger"
        aria-label="Student row actions"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => (isOpen ? close() : open())}
      >
        <MoreVertical size={16} />
      </button>

      {isOpen ? (
        <div
          ref={menuRef}
          className="student-action-menu-dropdown"
          role="menu"
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
        >
          {MENU_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              className={item.danger ? 'is-danger' : ''}
              onClick={() => {
                close();
                onAction(item.key, student);
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
