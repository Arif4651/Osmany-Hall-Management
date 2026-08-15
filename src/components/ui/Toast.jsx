import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, Copy, Check, X } from 'lucide-react';

const ICONS = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

/**
 * A single toast card. Rendered only by ToastProvider — pages raise toasts through
 * `useToast()` rather than mounting this directly.
 *
 * `duration: 0` pins the toast until it is dismissed by hand. Use it for anything the reader has
 * to act on before it can go, such as credentials — paired with `copyText` so they never have to
 * retype what is on screen.
 */
export default function Toast({
  id,
  variant = 'success',
  title,
  description,
  duration = 6000,
  copyText,
  onClose,
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!duration) return undefined;
    const timer = setTimeout(() => onClose?.(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const Icon = ICONS[variant] ?? CheckCircle2;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
    } catch {
      // Clipboard access can be refused (insecure origin, denied permission). The text is still
      // on screen to read, so a failed copy is not worth an error of its own.
      setCopied(false);
    }
  };

  return (
    <div className={`toast toast-${variant}${duration ? '' : ' is-pinned'}`} role="status" aria-live="polite">
      <Icon className="toast-icon" size={20} aria-hidden="true" />
      <div className="toast-body">
        <strong className="toast-title">{title}</strong>
        {description && <span className="toast-description">{description}</span>}
        {copyText && (
          <button type="button" className="toast-action" onClick={copy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy details'}
          </button>
        )}
      </div>
      <button
        type="button"
        className="toast-close"
        onClick={() => onClose?.(id)}
        aria-label="Dismiss notification"
      >
        <X size={15} />
      </button>
      {duration ? (
        <span className="toast-progress" style={{ animationDuration: `${duration}ms` }} />
      ) : null}
    </div>
  );
}
