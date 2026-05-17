export type BadgeColor = 'green' | 'amber' | 'red' | 'blue' | 'slate' | 'purple';

const colors: Record<BadgeColor, { bg: string; fg: string }> = {
  green: { bg: '#E2EEE6', fg: '#2F7D4F' },
  amber: { bg: '#F4E7D0', fg: '#B5731E' },
  red: { bg: '#F2DDD8', fg: '#AB382E' },
  purple: { bg: '#E7E0F1', fg: '#5E479F' },
  blue: { bg: '#DDE7F3', fg: '#1F5B9D' },
  slate: { bg: '#F4F2EC', fg: '#41546A' },
};

interface BadgeProps {
  color?: BadgeColor;
  children: React.ReactNode;
}

export function Badge({ color = 'slate', children }: BadgeProps) {
  const { bg, fg } = colors[color];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: bg,
        color: fg,
        padding: '2px 7px',
        borderRadius: 4,
        fontSize: 11,
        fontWeight: 500,
        letterSpacing: '0.005em',
        whiteSpace: 'nowrap',
        fontFamily: 'inherit',
      }}
    >
      {children}
    </span>
  );
}
