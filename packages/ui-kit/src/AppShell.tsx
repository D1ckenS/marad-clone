import { useState } from 'react';
import type { ReactNode } from 'react';

export interface NavItem {
  label: string;
  href: string;
  code: string;
}

interface VesselOption {
  id: string;
  name: string;
}

interface AppShellProps {
  nav: NavItem[];
  currentPath: string;
  onNavClick: (href: string) => void;
  userEmail?: string | undefined;
  userDisplayName?: string | undefined; // shown instead of email prefix; falls back to email
  onLogout?: () => void | undefined;
  children: ReactNode;
  // vessel / company context
  companyName?: string | undefined;
  vessels?: VesselOption[] | undefined;
  selectedVesselId?: string | null | undefined;
  onVesselChange?: ((id: string | null) => void) | undefined;
  isVesselLocked?: boolean | undefined;
}

function BearingMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: 'block', flexShrink: 0 }}>
      <circle cx="12" cy="12" r="10.25" fill="none" stroke="#0A1F33" strokeWidth="1.5" />
      <circle cx="12" cy="8.5" r="2" fill="#0A1F33" />
      <line
        x1="12"
        y1="1"
        x2="12"
        y2="3.25"
        stroke="#0A1F33"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ModBadge({
  code,
  active,
  anyActive,
}: {
  code: string;
  active: boolean;
  anyActive: boolean;
}) {
  const bg = active ? '#0A1F33' : anyActive ? 'transparent' : '#F4F2EC';
  const color = active ? '#fff' : anyActive ? '#8893A0' : '#41546A';
  const border = active || anyActive ? 'none' : '1px solid #EEEBE2';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 22,
        height: 22,
        borderRadius: 5,
        flexShrink: 0,
        background: bg,
        color,
        border,
        fontFamily: '"Geist Mono", monospace',
        fontSize: 9.5,
        fontWeight: 600,
        letterSpacing: '0.04em',
      }}
    >
      {code}
    </span>
  );
}

function Initials({ email }: { email: string }) {
  const name = email.split('@')[0] ?? '';
  const parts = name.split(/[._-]/);
  const letters =
    parts.length >= 2 && parts[0] && parts[1]
      ? (parts[0][0] ?? '') + (parts[1][0] ?? '')
      : name.slice(0, 2);
  return (
    <div
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        flexShrink: 0,
        background: '#0A1F33',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        style={{
          color: '#F4F2EC',
          fontSize: 10,
          fontWeight: 600,
          fontFamily: '"Geist Mono", monospace',
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
        }}
      >
        {letters.toUpperCase()}
      </span>
    </div>
  );
}

function VesselBlock({
  companyName,
  vessels,
  selectedVesselId,
  onVesselChange,
  isVesselLocked,
}: {
  companyName?: string | undefined;
  vessels?: VesselOption[] | undefined;
  selectedVesselId?: string | null | undefined;
  onVesselChange?: ((id: string | null) => void) | undefined;
  isVesselLocked?: boolean | undefined;
}) {
  const [open, setOpen] = useState(false);

  const selectedVessel = vessels?.find((v) => v.id === selectedVesselId) ?? null;
  const canSwitch = !isVesselLocked && vessels && vessels.length > 0 && onVesselChange;

  const vesselLabel = selectedVessel?.name ?? (vessels && vessels.length > 0 ? 'All vessels' : '—');

  return (
    <div
      style={{
        padding: '10px 12px 8px',
        borderBottom: '1px solid #EEEBE2',
      }}
    >
      {companyName && (
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 600,
            color: '#8893A0',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            marginBottom: 5,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {companyName}
        </div>
      )}

      {/* Vessel selector */}
      {canSwitch ? (
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setOpen((p) => !p)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '5px 8px',
              borderRadius: 6,
              border: '1px solid #E5E3DA',
              background: open ? '#F4F2EC' : '#FFFFFF',
              cursor: 'pointer',
              fontFamily: 'inherit',
              textAlign: 'left',
            }}
          >
            <span
              style={{
                flex: 1,
                fontSize: 12.5,
                fontWeight: 600,
                color: '#0A1F33',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {vesselLabel}
            </span>
            <svg
              width="12"
              height="12"
              viewBox="0 0 12 12"
              style={{
                flexShrink: 0,
                color: '#8893A0',
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
                background: '#FFFFFF',
                border: '1px solid #E5E3DA',
                borderRadius: 8,
                boxShadow: '0 4px 16px rgba(10,31,51,.10)',
                zIndex: 100,
                overflow: 'hidden',
              }}
            >
              {/* All vessels option */}
              <button
                onClick={() => {
                  onVesselChange(null);
                  setOpen(false);
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '8px 10px',
                  border: 'none',
                  background: selectedVesselId === null ? '#F4F2EC' : '#FFFFFF',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  borderBottom: '1px solid #EEEBE2',
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: selectedVesselId === null ? '#0A1F33' : '#EEEBE2',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontSize: 12.5,
                    color: '#0A1F33',
                    fontWeight: selectedVesselId === null ? 600 : 400,
                  }}
                >
                  All vessels
                </span>
              </button>
              {vessels.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    onVesselChange(v.id);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '8px 10px',
                    border: 'none',
                    background: selectedVesselId === v.id ? '#F4F2EC' : '#FFFFFF',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    borderTop: '1px solid #EEEBE2',
                  }}
                >
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: '50%',
                      background: selectedVesselId === v.id ? '#0A1F33' : '#EEEBE2',
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12.5,
                      color: '#0A1F33',
                      fontWeight: selectedVesselId === v.id ? 600 : 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      flex: 1,
                    }}
                  >
                    {v.name}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Locked or no vessels — just show name, no button */
        <div
          style={{
            padding: '5px 8px',
            borderRadius: 6,
            border: '1px solid #EEEBE2',
            background: '#FAFAF7',
          }}
        >
          <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0A1F33' }}>{vesselLabel}</span>
        </div>
      )}
    </div>
  );
}

export function AppShell({
  nav,
  currentPath,
  onNavClick,
  userEmail,
  userDisplayName,
  onLogout,
  children,
  companyName,
  vessels,
  selectedVesselId,
  onVesselChange,
  isVesselLocked,
}: AppShellProps) {
  const anyActive = nav.some((item) =>
    item.href === '/' ? currentPath === '/' : currentPath.startsWith(item.href),
  );

  const showVesselBlock = Boolean(companyName || (vessels && vessels.length > 0));

  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: '#FAFAF7',
        fontFamily: '"Geist", system-ui, sans-serif',
      }}
    >
      {/* ── Sidebar ─────────────────────────────────────────────────── */}
      <aside
        style={{
          width: 220,
          flexShrink: 0,
          background: '#FFFFFF',
          borderRight: '1px solid #E5E3DA',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Wordmark */}
        <div
          style={{
            padding: '14px 14px 12px',
            borderBottom: '1px solid #EEEBE2',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <BearingMark size={20} />
          <span
            style={{
              fontFamily: '"Geist", system-ui',
              fontWeight: 600,
              fontSize: 14,
              letterSpacing: '-0.01em',
              color: '#0A1F33',
            }}
          >
            FleetOps
          </span>
        </div>

        {/* Company + vessel block */}
        {showVesselBlock && (
          <VesselBlock
            companyName={companyName}
            vessels={vessels}
            selectedVesselId={selectedVesselId}
            onVesselChange={onVesselChange}
            isVesselLocked={isVesselLocked}
          />
        )}

        {/* Nav */}
        <nav
          style={{
            flex: 1,
            padding: '10px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            overflowY: 'auto',
          }}
        >
          {nav.map((item) => {
            const active =
              item.href === '/' ? currentPath === '/' : currentPath.startsWith(item.href);
            return (
              <button
                key={item.href}
                onClick={() => onNavClick(item.href)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '6px 8px',
                  height: 32,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: active ? '#F4F2EC' : 'transparent',
                  color: active ? '#0A1F33' : anyActive ? '#8893A0' : '#41546A',
                  fontSize: 13,
                  fontWeight: active ? 600 : 500,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  transition: 'background .1s',
                }}
                onMouseEnter={(e) => {
                  if (!active) e.currentTarget.style.background = '#F4F2EC';
                }}
                onMouseLeave={(e) => {
                  if (!active) e.currentTarget.style.background = 'transparent';
                }}
              >
                <ModBadge code={item.code} active={active} anyActive={anyActive} />
                <span style={{ flex: 1 }}>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Account block */}
        {userEmail && (
          <div
            style={{
              padding: '10px 12px',
              borderTop: '1px solid #EEEBE2',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <Initials email={userEmail} />
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <p
                style={{
                  fontSize: 11.5,
                  color: '#41546A',
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  margin: 0,
                }}
              >
                {userDisplayName ?? userEmail?.split('@')[0]}
              </p>
              {onLogout && (
                <button
                  onClick={onLogout}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontSize: 11,
                    color: '#8893A0',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = '#AB382E';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '#8893A0';
                  }}
                >
                  Sign out
                </button>
              )}
            </div>
          </div>
        )}
      </aside>

      {/* ── Main ────────────────────────────────────────────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>{children}</div>
      </main>
    </div>
  );
}
