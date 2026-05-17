import type { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md';

const STYLES: Record<Variant, { bg: string; fg: string; border: string; hoverBg: string }> = {
  primary: { bg: '#0A1F33', fg: '#fff', border: '#0A1F33', hoverBg: '#14304B' },
  secondary: { bg: '#fff', fg: '#0A1F33', border: '#E5E3DA', hoverBg: '#F4F2EC' },
  danger: { bg: '#fff', fg: '#AB382E', border: '#E5E3DA', hoverBg: '#F2DDD8' },
  ghost: { bg: 'transparent', fg: '#41546A', border: 'transparent', hoverBg: '#F4F2EC' },
};
const HEIGHTS: Record<Size, number> = { sm: 28, md: 32 };
const FONT_SIZES: Record<Size, number> = { sm: 12.5, md: 13 };
const PADDINGS: Record<Size, string> = { sm: '0 10px', md: '0 12px' };

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const s = STYLES[variant];
  const isDisabled = disabled ?? loading;
  return (
    <button
      {...rest}
      disabled={isDisabled}
      style={{
        height: HEIGHTS[size],
        padding: PADDINGS[size],
        fontSize: FONT_SIZES[size],
        background: s.bg,
        color: s.fg,
        border: `1px solid ${s.border}`,
        borderRadius: 6,
        fontFamily: 'inherit',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.45 : 1,
        whiteSpace: 'nowrap',
        transition: 'background .12s, border-color .12s',
        ...style,
      }}
      onMouseEnter={(e) => {
        if (!isDisabled) e.currentTarget.style.background = s.hoverBg;
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) e.currentTarget.style.background = s.bg;
      }}
    >
      {loading && (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          style={{ animation: 'spin 1s linear infinite' }}
        >
          <style>{'@keyframes spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}'}</style>
          <circle
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="3"
            strokeOpacity=".25"
          />
          <path
            d="M12 2a10 10 0 0 1 10 10"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
