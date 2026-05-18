import { useEffect, useRef, useState } from 'react';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  /** Shown (muted) when value is empty string. */
  placeholder?: string;
  disabled?: boolean;
  /** sm = compact inline use; md = standard form height (default). */
  size?: 'sm' | 'md';
}

const HEIGHT = { sm: 28, md: 36 };
const FONT = { sm: 12, md: 13 };
const PAD = { sm: '0 8px', md: '0 10px' };

export function Select({
  options,
  value,
  onChange,
  placeholder,
  disabled,
  size = 'md',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value) ?? null;
  const label = selected?.label ?? placeholder ?? 'Select…';
  const isEmpty = !selected;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((p) => !p)}
        style={{
          width: '100%',
          height: HEIGHT[size],
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: PAD[size],
          borderRadius: 6,
          border: '1px solid var(--border)',
          background: open ? 'var(--surface-2)' : 'var(--surface)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          textAlign: 'left',
          opacity: disabled ? 0.5 : 1,
          transition: 'background .1s',
        }}
      >
        <span
          style={{
            flex: 1,
            fontSize: FONT[size],
            fontWeight: isEmpty ? 400 : 500,
            color: isEmpty ? 'var(--ink-3)' : 'var(--ink)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          style={{
            flexShrink: 0,
            color: 'var(--ink-3)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform .15s',
          }}
        >
          <path
            d="M2 4l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            boxShadow: '0 4px 16px rgba(10,31,51,.10)',
            zIndex: 200,
            overflow: 'hidden',
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {options.map((o, i) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                background: value === o.value ? 'var(--surface-sunk)' : 'var(--surface)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
                fontSize: 13,
                fontWeight: value === o.value ? 600 : 400,
                color: 'var(--ink)',
                display: 'block',
              }}
              onMouseEnter={(e) => {
                if (value !== o.value)
                  (e.currentTarget as HTMLButtonElement).style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  value === o.value ? 'var(--surface-sunk)' : 'var(--surface)';
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
