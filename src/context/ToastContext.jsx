import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Toast from '../components/ui/Toast';

const ToastContext = createContext(null);

/** Beyond this, older toasts retire early rather than filling the screen. */
const MAX_VISIBLE = 3;

/**
 * ToastProvider — one viewport for every transient action confirmation in the app.
 *
 * Action feedback used to be an inline banner at the top of each page, which pushed the page
 * content down, sat far from wherever the admin was actually working, and stayed on screen until
 * something else replaced it. A toast reports the same outcome without reflowing the page, and
 * retires itself.
 *
 * Errors that belong to a *field* still stay inline next to that field; toasts are for the result
 * of an action ("Item deleted", "Payment approved").
 *
 * @example
 *   const toast = useToast();
 *   toast.success('Item deleted', `${item.name} was removed from inventory.`);
 *   toast.error('Could not save item', err.message);
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((variant, title, description, options = {}) => {
    // A bare Error reaching this call should still read as a message rather than
    // "[object Object]" — callers pass `err.message` in the happy path, but not always.
    const resolvedTitle = typeof title === 'string' ? title : String(title?.message ?? title ?? '');
    const id = (nextId.current += 1);
    const { duration, ...rest } = options;
    setToasts((current) => [
      // A pinned toast is waiting on the reader, so it is never the one pushed out to make room.
      ...current.filter((toast) => toast.duration === 0).concat(
        current.filter((toast) => toast.duration !== 0).slice(-(MAX_VISIBLE - 1)),
      ),
      {
        id,
        variant,
        title: resolvedTitle,
        description: description || '',
        // Errors linger: the admin usually has to read and act on them, while a success only
        // needs to be noticed. `duration: 0` pins the toast until dismissed by hand.
        duration: duration ?? (variant === 'error' ? 8000 : 5000),
        ...rest,
      },
    ]);
    return id;
  }, []);

  const value = useMemo(() => ({
    show,
    dismiss,
    success: (title, description, options) => show('success', title, description, options),
    error: (title, description, options) => show('error', title, description, options),
    info: (title, description, options) => show('info', title, description, options),
  }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toasts.length > 0 && createPortal(
        <div className="toast-viewport">
          {toasts.map((toast) => (
            <Toast key={toast.id} {...toast} onClose={dismiss} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
