interface Props {
  module: string;
  phase: string;
}

export function ComingSoonPage({ module, phase }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '60vh',
        gap: 12,
        color: '#8893A0',
      }}
    >
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: 12,
          background: '#F4F2EC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
        }}
      >
        🔒
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: '#41546A', margin: '0 0 4px' }}>
          {module}
        </p>
        <p style={{ fontSize: 12.5, margin: 0 }}>Coming in {phase} — schema and API are ready.</p>
      </div>
    </div>
  );
}
