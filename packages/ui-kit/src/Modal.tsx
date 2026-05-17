import { useEffect, useRef } from 'react';
import { Button } from './Button.js';

interface ModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
}

const maxWidths = { sm: 440, md: 560, lg: 780 };

export function Modal({ open, title, onClose, children, footer, size = 'md' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (open) el.showModal();
    else el.close();
  }, [open]);

  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    const handler = (e: Event) => {
      if (e.target === el) onClose();
    };
    el.addEventListener('click', handler);
    return () => el.removeEventListener('click', handler);
  }, [onClose]);

  if (!open) return null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      style={{
        width: '100%',
        maxWidth: maxWidths[size],
        border: '1px solid #E5E3DA',
        borderRadius: 10,
        padding: 0,
        boxShadow: '0 8px 32px rgba(10,31,51,.12), 0 1px 0 rgba(10,31,51,.04)',
        fontFamily: '"Geist", system-ui, sans-serif',
        color: '#0A1F33',
      }}
    >
      <style>{`::backdrop { background: rgba(10,31,51,.35); backdrop-filter: blur(2px); }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: '1px solid #EEEBE2',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 14, fontWeight: 600, letterSpacing: '-0.005em' }}>
            {title}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 28, height: 28, padding: 0, color: '#8893A0' }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 3 L13 13 M13 3 L3 13"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </Button>
        </div>
        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 18px' }}>{children}</div>
        {/* Footer */}
        {footer && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: 8,
              padding: '12px 18px',
              borderTop: '1px solid #EEEBE2',
              background: '#FAFAF7',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </dialog>
  );
}
