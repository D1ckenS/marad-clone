import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, type BadgeColor, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

// ─── Types (mirror Phase 2 crewing API) ─────────────────────────────────────

interface CrewMember {
  id: string;
  rank: string;
  name: string;
  nat: string;
  joined: string; // ISO date
  signOff: string; // ISO date
  wage: string | null;
  wageCcy: string | null;
  mlcStatus: 'compliant' | 'edge' | 'breach';
  certStatus: 'ok' | 'expiring_soon' | 'expired';
  dob: string | null;
  experience: string | null;
  passport: string | null;
}

interface CrewCert {
  id: string;
  crewMemberId: string;
  crewName?: string;
  crewRank?: string;
  kind: string;
  authority: string;
  expiresAt: string; // ISO date
  daysLeft: number;
  status: 'green' | 'amber' | 'red';
}

interface Drill {
  id: string;
  conductedAt: string; // ISO datetime
  type: string;
  location: string | null;
  attendancePresent: number | null;
  attendanceTotal: number | null;
  durationMinutes: number | null;
  findingsCount: number;
  status: 'green' | 'amber' | 'red';
}

interface RestHourEntry {
  date: string; // YYYY-MM-DD
  hour: number; // 0-23
  type: 'work' | 'rest';
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const deptOf = (rank: string): 'Deck' | 'Engine' | 'Galley' => {
  if (
    rank.includes('Engineer') ||
    rank === 'Oiler' ||
    rank === 'Wiper' ||
    rank === 'Cadet (Engine)'
  )
    return 'Engine';
  if (
    rank.includes('Officer') ||
    rank === 'Master' ||
    rank === 'Bosun' ||
    ['AB', 'OS', 'Cadet (Deck)'].includes(rank)
  )
    return 'Deck';
  return 'Galley';
};

const initials = (name: string): string =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

const fmtDate = (iso: string): string =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const DEPT_COLOR: Record<string, BadgeColor> = {
  Deck: 'blue',
  Engine: 'amber',
  Galley: 'purple',
};
const deptColor = (dept: string): BadgeColor => DEPT_COLOR[dept] ?? 'slate';

const MLC_COLOR: Record<string, BadgeColor> = {
  compliant: 'green',
  edge: 'amber',
  breach: 'red',
};
const mlcColor = (s: string): BadgeColor => MLC_COLOR[s] ?? 'slate';

const CERT_COLOR: Record<string, BadgeColor> = {
  ok: 'green',
  expiring_soon: 'amber',
  expired: 'red',
};
const certColor = (s: string): BadgeColor => CERT_COLOR[s] ?? 'slate';

const mlcLabel = (s: string) =>
  s === 'compliant' ? 'COMPLIANT' : s === 'edge' ? 'EDGE' : 'BREACH';
const certLabel = (s: string) => (s === 'ok' ? 'OK' : s === 'expiring_soon' ? '≤90 d' : '≤7 d');

// ─── MLC metrics from real rest-hour entries ─────────────────────────────────

function buildGridFromEntries(entries: RestHourEntry[]): {
  grid: number[][];
  dates: string[];
} {
  const today = new Date();
  const dates: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().split('T')[0] ?? '');
  }
  const lookup = new Set(
    entries.filter((e) => e.type === 'work').map((e) => `${e.date}|${e.hour}`),
  );
  const grid = dates.map((date) =>
    Array.from({ length: 24 }, (_, h) => (lookup.has(`${date}|${h}`) ? 1 : 0)),
  );
  return { grid, dates };
}

function mlcMetrics(grid: number[][]) {
  const dayRest = grid.map((row) => 24 - row.reduce((a, b) => a + b, 0));
  const breach24 = dayRest.map((r) => r < 10);
  const week: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    let s = 0;
    for (let j = Math.max(0, i - 6); j <= i; j++) s += dayRest[j] ?? 0;
    week.push(s);
  }
  return { dayRest, breach24, week, breach7: week.map((r) => r < 77) };
}

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <p className="text-xs text-center" style={{ color: 'var(--ink-3)' }}>
        {message}
      </p>
    </div>
  );
}

function CrewAvatar({
  name,
  size = 28,
  mlcStatus = 'compliant',
}: {
  name: string;
  size?: number;
  mlcStatus?: string;
}) {
  const bg =
    mlcStatus === 'breach'
      ? 'var(--sig-red)'
      : mlcStatus === 'edge'
        ? 'var(--sig-amber)'
        : 'var(--navy-2)';
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        background: bg,
        color: '#fff',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.36,
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        flexShrink: 0,
      }}
    >
      {initials(name)}
    </span>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={
        active
          ? { background: 'var(--ink)', color: '#fff' }
          : {
              background: 'var(--surface)',
              color: 'var(--ink-2)',
              border: '1px solid var(--border)',
            }
      }
      className="h-[22px] px-2 rounded-1 text-[11px] font-medium transition-colors whitespace-nowrap"
    >
      {children}
    </button>
  );
}

// ─── Crew tab ─────────────────────────────────────────────────────────────────

function CrewDetailPane({ c, onClose }: { c: CrewMember; onClose: () => void }) {
  const [certs, setCerts] = useState<CrewCert[]>([]);

  useEffect(() => {
    api
      .get<CrewCert[]>(`/crew-certificates?crewMemberId=${c.id}`)
      .then(setCerts)
      .catch(() => setCerts([]));
  }, [c.id]);

  const dept = deptOf(c.rank);
  const monoFields = ['Wage', 'Passport', 'Joined', 'Sign-off', 'Date of birth'];
  const rows: [string, string][] = [
    ...(c.nat ? [['Nationality', c.nat] as [string, string]] : []),
    ...(c.dob ? [['Date of birth', fmtDate(c.dob)] as [string, string]] : []),
    ...(c.experience ? [['Experience', c.experience] as [string, string]] : []),
    ...(c.passport ? [['Passport', c.passport] as [string, string]] : []),
    ['Joined', fmtDate(c.joined)],
    ['Sign-off', fmtDate(c.signOff)],
    ...(c.wage ? [[`Wage`, `${c.wageCcy ?? 'USD'} ${c.wage} / mo`] as [string, string]] : []),
  ];

  return (
    <aside
      style={{
        width: 340,
        flexShrink: 0,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <div className="flex items-center gap-3">
            <CrewAvatar name={c.name} size={48} mlcStatus={c.mlcStatus} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                  {c.id.slice(0, 8)}
                </span>
                <Badge color={deptColor(dept)}>{dept.toUpperCase()}</Badge>
              </div>
              <div
                className="text-[15px] font-semibold"
                style={{ color: 'var(--ink)', letterSpacing: '-0.005em' }}
              >
                {c.name}
              </div>
              <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                {c.rank}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-6 h-6 flex items-center justify-center text-sm rounded-1"
              style={{
                color: 'var(--ink-3)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Contract info */}
        <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', fontSize: 12 }}>
          {rows.map(([k, v]) => (
            <div key={k} style={{ display: 'contents' }}>
              <div
                className="px-4 py-1.5"
                style={{ color: 'var(--ink-3)', borderTop: '1px solid var(--hairline)' }}
              >
                {k}
              </div>
              <div
                className="px-4 py-1.5"
                style={{
                  color: 'var(--ink)',
                  borderTop: '1px solid var(--hairline)',
                  fontFamily: monoFields.includes(k) ? 'var(--font-mono)' : 'var(--font-ui)',
                }}
              >
                {v}
              </div>
            </div>
          ))}
        </div>

        {/* MLC rest summary */}
        <div className="px-4 py-3" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div
            className="text-[10.5px] font-semibold uppercase tracking-widest mb-2"
            style={{ color: 'var(--ink-3)' }}
          >
            MLC 2006 — Status
          </div>
          <div className="flex items-center gap-2">
            <Badge color={mlcColor(c.mlcStatus)}>{mlcLabel(c.mlcStatus)}</Badge>
            <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
              See Rest Hours tab for full 14-day log
            </span>
          </div>
        </div>

        {/* Certs */}
        <div className="px-4 pt-2 pb-1" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div
            className="text-[10.5px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-3)' }}
          >
            Certificates ({certs.length})
          </div>
        </div>
        {certs.length === 0 ? (
          <div className="px-4 pb-4 text-xs" style={{ color: 'var(--ink-3)' }}>
            No certificates recorded.
          </div>
        ) : (
          certs.map((cc) => (
            <div
              key={cc.id}
              className="px-4 py-2"
              style={{
                borderTop: '1px solid var(--hairline)',
                display: 'grid',
                gridTemplateColumns: '1fr auto',
                gap: 4,
              }}
            >
              <div>
                <div className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
                  {cc.kind}
                </div>
                <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                  {cc.authority}
                </div>
              </div>
              <div className="text-right">
                <Badge color={cc.status}>{cc.daysLeft < 30 ? `${cc.daysLeft} d` : 'OK'}</Badge>
                <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                  {fmtDate(cc.expiresAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div
        className="flex gap-2 p-3 flex-shrink-0"
        style={{ borderTop: '1px solid var(--hairline)', background: 'var(--surface-2)' }}
      >
        <button
          className="flex-1 py-1.5 rounded-2 text-xs font-medium border"
          style={{
            borderColor: 'var(--border)',
            color: 'var(--ink-2)',
            background: 'var(--surface)',
            cursor: 'pointer',
          }}
        >
          Roster
        </button>
        <button
          className="flex-1 py-1.5 rounded-2 text-xs font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          Open profile
        </button>
      </div>
    </aside>
  );
}

function CrewTab({ crew, loading }: { crew: CrewMember[]; loading: boolean }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [dept, setDept] = useState('All');

  const visible = dept === 'All' ? crew : crew.filter((c) => deptOf(c.rank) === dept);
  const sel = crew.find((c) => c.id === selected) ?? null;

  return (
    <div className="flex flex-1 min-h-0">
      <section className="flex flex-col flex-1 min-w-0">
        {/* Dept filter */}
        <div
          className="flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
        >
          <span
            className="text-[10.5px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-3)' }}
          >
            Department
          </span>
          <div className="flex gap-1.5">
            {['All', 'Deck', 'Engine', 'Galley'].map((d) => (
              <Chip key={d} active={dept === d} onClick={() => setDept(d)}>
                {d}
              </Chip>
            ))}
          </div>
          <div className="flex-1" />
          <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            {visible.length} of {crew.length} on board
          </span>
        </div>

        {/* Column headers */}
        <div
          className="grid gap-2 px-4 py-2 flex-shrink-0 text-[10.5px] font-semibold uppercase tracking-widest"
          style={{
            gridTemplateColumns: '36px 1fr 110px 44px 110px 90px 72px',
            background: 'var(--surface-sunk)',
            color: 'var(--ink-3)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span />
          <span>Crew / rank</span>
          <span>Dept</span>
          <span>Nat</span>
          <span>Sign-off</span>
          <span>MLC rest</span>
          <span>Certs</span>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface)' }}>
          {loading && (
            <div className="p-8 flex justify-center">
              <Spinner />
            </div>
          )}
          {!loading && crew.length === 0 && (
            <EmptyState message="No crew members on record. Sign-on records will appear here." />
          )}
          {!loading &&
            visible.map((c) => (
              <div
                key={c.id}
                className="grid gap-2 px-4 py-2.5 items-center cursor-pointer transition-colors"
                style={{
                  gridTemplateColumns: '36px 1fr 110px 44px 110px 90px 72px',
                  borderTop: '1px solid var(--hairline)',
                  background: selected === c.id ? 'var(--surface-sunk)' : 'var(--surface)',
                }}
                onMouseEnter={(e) => {
                  if (selected !== c.id)
                    (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background =
                    selected === c.id ? 'var(--surface-sunk)' : 'var(--surface)';
                }}
                onClick={() => setSelected(selected === c.id ? null : c.id)}
              >
                <CrewAvatar name={c.name} size={28} mlcStatus={c.mlcStatus} />
                <div className="min-w-0">
                  <div
                    className="text-[13px] font-semibold truncate"
                    style={{ color: 'var(--ink)' }}
                  >
                    {c.name}
                  </div>
                  <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                    {c.rank}
                  </div>
                </div>
                <Badge color={deptColor(deptOf(c.rank))}>{deptOf(c.rank).toUpperCase()}</Badge>
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {c.nat}
                </span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {fmtDate(c.signOff)}
                </span>
                <Badge color={mlcColor(c.mlcStatus)}>{mlcLabel(c.mlcStatus)}</Badge>
                <Badge color={certColor(c.certStatus)}>{certLabel(c.certStatus)}</Badge>
              </div>
            ))}
        </div>
      </section>

      {sel ? (
        <CrewDetailPane c={sel} onClose={() => setSelected(null)} />
      ) : (
        <aside
          style={{
            width: 340,
            flexShrink: 0,
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <p className="text-xs text-center" style={{ color: 'var(--ink-3)' }}>
            Select a crew member to view contract, MLC compliance, and certificates.
          </p>
        </aside>
      )}
    </div>
  );
}

// ─── Rotation tab ─────────────────────────────────────────────────────────────

function RotationTab({ crew, loading }: { crew: CrewMember[]; loading: boolean }) {
  const { months, totalDays, windowStart, todayOffset } = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 5, 0);
    const total = Math.ceil((end.getTime() - start.getTime()) / 86400000);
    const todayOff = Math.ceil((now.getTime() - start.getTime()) / 86400000);
    const ms: string[] = [];
    const cur = new Date(start);
    while (cur <= end) {
      ms.push(cur.toLocaleString('en-GB', { month: 'short' }));
      cur.setMonth(cur.getMonth() + 1);
    }
    return { months: ms, totalDays: total, windowStart: start, todayOffset: todayOff };
  }, []);

  const datePct = (iso: string) => {
    const d = new Date(iso);
    const diff = Math.ceil((d.getTime() - windowStart.getTime()) / 86400000);
    return Math.max(0, Math.min(100, (diff / totalDays) * 100));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4" style={{ background: 'var(--bg)' }}>
      <div
        className="overflow-hidden rounded-3"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3 flex-wrap"
          style={{ borderBottom: '1px solid var(--hairline)' }}
        >
          <span
            className="text-[10.5px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-3)' }}
          >
            Crew rotations — 8-month window
          </span>
          <div className="flex-1" />
          <button
            className="px-3 py-1 rounded-2 border text-[11px] font-medium"
            style={{ borderColor: 'var(--border)', color: 'var(--ink-2)', cursor: 'pointer' }}
          >
            Plan roster
          </button>
        </div>

        {/* Month header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 1fr',
            background: 'var(--surface-sunk)',
          }}
        >
          <div
            className="px-4 py-1.5 text-[10px] uppercase tracking-widest"
            style={{ color: 'var(--ink-3)' }}
          >
            Crew
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${months.length}, 1fr)` }}>
            {months.map((m, i) => (
              <div
                key={i}
                className="py-1.5 text-center font-mono text-[10.5px]"
                style={{
                  color: 'var(--ink-3)',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--hairline)',
                }}
              >
                {m}
              </div>
            ))}
          </div>
        </div>

        {loading && (
          <div className="p-6 flex justify-center">
            <Spinner />
          </div>
        )}
        {!loading && crew.length === 0 && (
          <div className="p-8 text-xs text-center" style={{ color: 'var(--ink-3)' }}>
            No crew contracts to display.
          </div>
        )}
        {!loading &&
          crew.map((c) => {
            const dept = deptOf(c.rank);
            const barColor =
              dept === 'Deck'
                ? 'var(--sig-blue)'
                : dept === 'Engine'
                  ? 'var(--sig-amber)'
                  : 'var(--sig-purple)';
            const leftPct = datePct(c.joined);
            const rightPct = datePct(c.signOff);
            const widthPct = Math.max(0, rightPct - leftPct);
            return (
              <div
                key={c.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '220px 1fr',
                  borderTop: '1px solid var(--hairline)',
                  alignItems: 'center',
                  minHeight: 36,
                }}
              >
                <div className="px-4 flex items-center gap-2">
                  <CrewAvatar name={c.name} size={22} mlcStatus={c.mlcStatus} />
                  <div className="min-w-0 flex-1">
                    <div
                      className="text-[12px] font-semibold truncate"
                      style={{ color: 'var(--ink)' }}
                    >
                      {c.name}
                    </div>
                    <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                      {c.rank}
                    </div>
                  </div>
                </div>
                <div style={{ position: 'relative', height: 36, background: 'var(--surface)' }}>
                  {months.map((_, i) => (
                    <div
                      key={i}
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: `${(i / months.length) * 100}%`,
                        width: 1,
                        background: 'var(--hairline)',
                      }}
                    />
                  ))}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      left: `${(todayOffset / totalDays) * 100}%`,
                      width: 1,
                      background: 'var(--ink)',
                      zIndex: 2,
                    }}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 7,
                      bottom: 7,
                      left: `calc(${leftPct}% + 2px)`,
                      width: `calc(${widthPct}% - 4px)`,
                      background: barColor,
                      borderRadius: 4,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '0 8px',
                      color: '#fff',
                      fontSize: 10.5,
                      fontWeight: 500,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                    }}
                  >
                    {fmtDate(c.joined).slice(0, 6)} → {fmtDate(c.signOff).slice(0, 6)}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Rest Hours tab ───────────────────────────────────────────────────────────

function RestHoursTab({ crew, loading: crewLoading }: { crew: CrewMember[]; loading: boolean }) {
  const [crewId, setCrewId] = useState<string | null>(null);
  const [entries, setEntries] = useState<RestHourEntry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(false);

  const sortedCrew = [...crew].sort((a, b) => {
    const t: Record<string, number> = { breach: 0, edge: 1, compliant: 2 };
    return (t[a.mlcStatus] ?? 2) - (t[b.mlcStatus] ?? 2);
  });

  const sel = crew.find((c) => c.id === crewId) ?? null;

  useEffect(() => {
    if (!crewId) return;
    setEntriesLoading(true);
    api
      .get<RestHourEntry[]>(`/rest-hour-entries?crewMemberId=${crewId}&days=14`)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setEntriesLoading(false));
  }, [crewId]);

  const { grid, dates } = useMemo(() => buildGridFromEntries(entries), [entries]);
  const metrics = useMemo(() => mlcMetrics(grid), [grid]);

  const restAvg =
    grid.length > 0
      ? (metrics.dayRest.reduce((a, b) => a + b, 0) / metrics.dayRest.length).toFixed(1)
      : '—';
  const breaches24 = metrics.breach24.filter(Boolean).length;
  const breaches7 = metrics.breach7.filter(Boolean).length;

  return (
    <div className="flex flex-1 min-h-0">
      {/* Left rail */}
      <aside
        className="flex flex-col flex-shrink-0"
        style={{ width: 260, background: 'var(--surface)', borderRight: '1px solid var(--border)' }}
      >
        <div
          className="px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest flex-shrink-0"
          style={{ borderBottom: '1px solid var(--hairline)', color: 'var(--ink-3)' }}
        >
          Crew · sorted by risk
        </div>
        <div className="flex-1 overflow-y-auto p-1.5">
          {crewLoading && (
            <div className="p-4 flex justify-center">
              <Spinner />
            </div>
          )}
          {!crewLoading && sortedCrew.length === 0 && (
            <p className="p-4 text-xs text-center" style={{ color: 'var(--ink-3)' }}>
              No crew on record.
            </p>
          )}
          {sortedCrew.map((c) => {
            const isActive = c.id === crewId;
            const dot =
              c.mlcStatus === 'breach'
                ? 'var(--sig-red)'
                : c.mlcStatus === 'edge'
                  ? 'var(--sig-amber)'
                  : 'var(--sig-green)';
            return (
              <button
                key={c.id}
                onClick={() => setCrewId(c.id)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded-2 text-left h-9"
                style={{
                  background: isActive ? 'var(--surface-2)' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                <CrewAvatar name={c.name} size={24} mlcStatus={c.mlcStatus} />
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12px] truncate"
                    style={{ fontWeight: isActive ? 600 : 500, color: 'var(--ink)' }}
                  >
                    {c.name}
                  </div>
                  <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                    {c.rank}
                  </div>
                </div>
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: dot,
                    flexShrink: 0,
                  }}
                />
              </button>
            );
          })}
        </div>
      </aside>

      {/* Detail */}
      <section className="flex-1 overflow-y-auto min-w-0" style={{ background: 'var(--bg)' }}>
        {!sel && (
          <EmptyState message="Select a crew member to view their 14-day work / rest log." />
        )}
        {sel && (
          <>
            {/* Header */}
            <div
              className="flex items-center gap-3 px-5 py-3 flex-shrink-0"
              style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            >
              <CrewAvatar name={sel.name} size={42} mlcStatus={sel.mlcStatus} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h2
                    className="text-[17px] font-semibold m-0"
                    style={{ color: 'var(--ink)', letterSpacing: '-0.005em' }}
                  >
                    {sel.name}
                  </h2>
                  <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                    · {sel.rank}
                  </span>
                </div>
                <div className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                  14-day work / rest log · MLC 2006
                </div>
              </div>
              <button
                className="px-3 py-1 rounded-2 border text-xs font-medium"
                style={{ borderColor: 'var(--border)', color: 'var(--ink-2)', cursor: 'pointer' }}
              >
                Export PDF
              </button>
            </div>

            {entriesLoading && (
              <div className="p-8 flex justify-center">
                <Spinner />
              </div>
            )}

            {!entriesLoading && entries.length === 0 && (
              <div className="p-8">
                <div
                  className="rounded-3 p-8 text-center"
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                >
                  <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
                    No rest hour entries recorded for this crew member.
                    <br />
                    Entries are logged automatically from the noon report feed.
                  </p>
                </div>
              </div>
            )}

            {!entriesLoading && entries.length > 0 && (
              <>
                {/* KPI tiles */}
                <div className="grid grid-cols-4 gap-2.5 p-4">
                  {[
                    {
                      label: 'Rest — daily avg',
                      value: `${restAvg} h`,
                      sub: 'of ≥10 h required',
                      bad: restAvg !== '—' && parseFloat(restAvg) < 10,
                    },
                    {
                      label: 'Breaches — 24 h rule',
                      value: String(breaches24),
                      sub: 'days < 10 h rest',
                      bad: breaches24 > 0,
                    },
                    {
                      label: 'Breaches — 7-day rule',
                      value: String(breaches7),
                      sub: 'rolling weeks < 77 h',
                      bad: breaches7 > 0,
                    },
                    {
                      label: 'Compliance',
                      value: `${Math.round(((14 - breaches24) / 14) * 100)}%`,
                      sub: 'last 14 days',
                      bad: sel.mlcStatus === 'breach',
                    },
                  ].map((kpi) => (
                    <div
                      key={kpi.label}
                      className="p-3 rounded-3"
                      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                    >
                      <div className="text-[10.5px] mb-1" style={{ color: 'var(--ink-3)' }}>
                        {kpi.label}
                      </div>
                      <div
                        className="font-mono text-[22px] font-semibold"
                        style={{ color: kpi.bad ? 'var(--sig-red)' : 'var(--ink)' }}
                      >
                        {kpi.value}
                      </div>
                      <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                        {kpi.sub}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Work/rest grid */}
                <div className="px-4 pb-4">
                  <div
                    className="rounded-3 overflow-hidden"
                    style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
                  >
                    <div
                      className="flex items-center px-4 py-2.5"
                      style={{ borderBottom: '1px solid var(--hairline)' }}
                    >
                      <span
                        className="text-[10.5px] font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        Work / rest log · hourly · 14 days
                      </span>
                      <div className="flex-1" />
                      <div
                        className="flex items-center gap-3 text-[10.5px]"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        <span className="flex items-center gap-1">
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              background: 'var(--navy)',
                              borderRadius: 1,
                              display: 'inline-block',
                            }}
                          />{' '}
                          work
                        </span>
                        <span className="flex items-center gap-1">
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              background: 'var(--surface-sunk)',
                              border: '1px solid var(--hairline)',
                              borderRadius: 1,
                              display: 'inline-block',
                            }}
                          />{' '}
                          rest
                        </span>
                        <span className="flex items-center gap-1">
                          <span
                            style={{
                              width: 9,
                              height: 9,
                              background: 'var(--sig-red-bg)',
                              border: '1px solid var(--sig-red)',
                              borderRadius: 1,
                              display: 'inline-block',
                            }}
                          />{' '}
                          breach
                        </span>
                      </div>
                    </div>
                    <div className="overflow-auto px-4 py-3">
                      <div
                        className="font-mono text-[9px] mb-1.5"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '80px repeat(24, 1fr) 60px 72px',
                          gap: 1,
                          color: 'var(--ink-3)',
                          minWidth: 760,
                        }}
                      >
                        <span />
                        {Array.from({ length: 24 }, (_, h) => (
                          <span
                            key={h}
                            style={{
                              textAlign: 'center',
                              visibility: h % 3 === 0 ? 'visible' : 'hidden',
                            }}
                          >
                            {String(h).padStart(2, '0')}
                          </span>
                        ))}
                        <span style={{ textAlign: 'right' }}>24 h</span>
                        <span style={{ textAlign: 'right' }}>7-day</span>
                      </div>
                      {grid.map((row, d) => {
                        const breach24 = metrics.breach24[d] ?? false;
                        const breach7 = metrics.breach7[d] ?? false;
                        const dateLabel = new Date(dates[d] ?? '').toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                        });
                        return (
                          <div
                            key={d}
                            className="mb-0.5"
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '80px repeat(24, 1fr) 60px 72px',
                              gap: 1,
                              minWidth: 760,
                              alignItems: 'center',
                            }}
                          >
                            <span
                              className="font-mono text-[10px]"
                              style={{
                                color: breach24 ? 'var(--sig-red)' : 'var(--ink-3)',
                                fontWeight: breach24 ? 600 : 400,
                              }}
                            >
                              {dateLabel}
                            </span>
                            {row.map((cell, h) => (
                              <div
                                key={h}
                                style={{
                                  height: 14,
                                  background: cell ? 'var(--navy)' : 'var(--surface-sunk)',
                                  border: breach24
                                    ? '1px solid rgba(171,56,46,0.35)'
                                    : `1px solid ${cell ? 'var(--navy)' : 'var(--hairline)'}`,
                                  borderRadius: 1,
                                }}
                              />
                            ))}
                            <span
                              className="font-mono text-[10.5px] text-right"
                              style={{
                                color: breach24 ? 'var(--sig-red)' : 'var(--ink-2)',
                                fontWeight: breach24 ? 600 : 500,
                              }}
                            >
                              {metrics.dayRest[d]}h{breach24 ? ' !' : ''}
                            </span>
                            <span
                              className="font-mono text-[10.5px] text-right"
                              style={{
                                color: breach7 ? 'var(--sig-red)' : 'var(--ink-2)',
                                fontWeight: breach7 ? 600 : 500,
                              }}
                            >
                              {metrics.week[d]}h{breach7 ? ' !' : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                    <div
                      className="flex items-center justify-between px-4 py-2.5 text-[11px]"
                      style={{
                        borderTop: '1px solid var(--hairline)',
                        background: 'var(--surface-2)',
                        color: 'var(--ink-3)',
                      }}
                    >
                      <span>
                        MLC 2006: rest must be ≥ 10 h in any 24 h window and ≥ 77 h in any 7-day
                        rolling window.
                      </span>
                      <span className="font-mono">Source: noon report · watchkeeping log</span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </section>
    </div>
  );
}

// ─── Certificates tab ─────────────────────────────────────────────────────────

function CertificatesTab() {
  const [certs, setCerts] = useState<CrewCert[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'soon'>('all');

  useEffect(() => {
    api
      .get<CrewCert[]>('/crew-certificates')
      .then(setCerts)
      .catch(() => setCerts([]))
      .finally(() => setLoading(false));
  }, []);

  const visible =
    filter === 'critical'
      ? certs.filter((c) => c.status === 'red')
      : filter === 'soon'
        ? certs.filter((c) => c.status !== 'green')
        : certs;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
      >
        <span
          className="text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--ink-3)' }}
        >
          Filter
        </span>
        <div className="flex gap-1.5">
          {[
            { id: 'all' as const, label: `All · ${certs.length}` },
            { id: 'critical' as const, label: 'Expiring ≤ 7 d' },
            { id: 'soon' as const, label: 'Expiring ≤ 90 d' },
          ].map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
        </div>
        <div className="flex-1" />
        <button
          className="px-3 py-1 rounded-2 border text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--ink-2)', cursor: 'pointer' }}
        >
          Notification thresholds
        </button>
        <button
          className="px-3 py-1 rounded-2 text-xs font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          + Upload cert
        </button>
      </div>

      {/* Column headers */}
      <div
        className="grid gap-2 px-4 py-2 flex-shrink-0 text-[10.5px] font-semibold uppercase tracking-widest"
        style={{
          gridTemplateColumns: '90px 170px 1fr 160px 110px 90px 80px',
          background: 'var(--surface-sunk)',
          color: 'var(--ink-3)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Cert</span>
        <span>Crew</span>
        <span>Type</span>
        <span>Issuing authority</span>
        <span>Expires</span>
        <span>Days left</span>
        <span />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface)' }}>
        {loading && (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {!loading && certs.length === 0 && <EmptyState message="No certificates on record." />}
        {!loading &&
          visible.map((cc) => (
            <div
              key={cc.id}
              className="grid gap-2 px-4 py-2.5 items-center"
              style={{
                gridTemplateColumns: '90px 170px 1fr 160px 110px 90px 80px',
                borderTop: '1px solid var(--hairline)',
              }}
            >
              <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                {cc.id.slice(0, 8)}
              </span>
              <div className="flex items-center gap-2 min-w-0">
                {cc.crewName && <CrewAvatar name={cc.crewName} size={22} />}
                <div className="min-w-0">
                  <div className="text-[12px] font-medium truncate" style={{ color: 'var(--ink)' }}>
                    {cc.crewName}
                  </div>
                  <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                    {cc.crewRank}
                  </div>
                </div>
              </div>
              <span className="text-[12.5px] truncate" style={{ color: 'var(--ink)' }}>
                {cc.kind}
              </span>
              <span className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                {cc.authority}
              </span>
              <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                {fmtDate(cc.expiresAt)}
              </span>
              <Badge color={cc.status}>{cc.daysLeft} d</Badge>
              <button
                className="px-3 py-1 rounded-2 border text-[11px] font-medium justify-self-end"
                style={{
                  borderColor: 'var(--border)',
                  color: cc.status === 'red' ? 'var(--sig-red)' : 'var(--ink-2)',
                  cursor: 'pointer',
                }}
              >
                {cc.status === 'red' ? 'Renew' : 'Open'}
              </button>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Drills tab ───────────────────────────────────────────────────────────────

function DrillsTab() {
  const [drills, setDrills] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Drill[]>('/drills')
      .then(setDrills)
      .catch(() => setDrills([]))
      .finally(() => setLoading(false));
  }, []);

  const totalFindings = drills.reduce((s, d) => s + d.findingsCount, 0);

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Toolbar */}
      <div
        className="flex items-center gap-3 px-4 py-2 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
      >
        <span
          className="text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--ink-3)' }}
        >
          Drill register · last 90 d
        </span>
        {drills.length > 0 && (
          <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            {drills.length} drill{drills.length !== 1 ? 's' : ''} · {totalFindings} finding
            {totalFindings !== 1 ? 's' : ''}
          </span>
        )}
        <div className="flex-1" />
        <button
          className="px-3 py-1 rounded-2 border text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--ink-2)', cursor: 'pointer' }}
        >
          Filter type
        </button>
        <button
          className="px-3 py-1 rounded-2 text-xs font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          + Schedule drill
        </button>
      </div>

      {/* Column headers */}
      <div
        className="grid gap-2 px-4 py-2 flex-shrink-0 text-[10.5px] font-semibold uppercase tracking-widest"
        style={{
          gridTemplateColumns: '90px 140px 1fr 150px 90px 110px 90px 70px',
          background: 'var(--surface-sunk)',
          color: 'var(--ink-3)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Drill</span>
        <span>Date</span>
        <span>Type</span>
        <span>Location</span>
        <span className="text-right">Duration</span>
        <span>Attendance</span>
        <span className="text-right">Findings</span>
        <span />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface)' }}>
        {loading && (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {!loading && drills.length === 0 && (
          <EmptyState message="No drills recorded in the last 90 days." />
        )}
        {!loading &&
          drills.map((d) => {
            const attendanceLabel =
              d.attendancePresent !== null && d.attendanceTotal !== null
                ? `${d.attendancePresent}/${d.attendanceTotal}`
                : '—';
            const durationLabel = d.durationMinutes !== null ? `${d.durationMinutes} min` : '—';
            return (
              <div
                key={d.id}
                className="grid gap-2 px-4 py-2.5 items-center"
                style={{
                  gridTemplateColumns: '90px 140px 1fr 150px 90px 110px 90px 70px',
                  borderTop: '1px solid var(--hairline)',
                }}
              >
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {d.id.slice(0, 8)}
                </span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {new Date(d.conductedAt).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
                <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
                  {d.type}
                </span>
                <span className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                  {d.location ?? '—'}
                </span>
                <span
                  className="font-mono text-[11px] text-right"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {durationLabel}
                </span>
                <Badge color={d.status}>{attendanceLabel}</Badge>
                <span
                  className="font-mono text-[11.5px] text-right"
                  style={{
                    color: d.findingsCount > 0 ? 'var(--sig-amber)' : 'var(--ink-3)',
                    fontWeight: d.findingsCount > 0 ? 600 : 400,
                  }}
                >
                  {d.findingsCount}
                </span>
                <button
                  className="px-2.5 py-1 rounded-2 border text-[11px] font-medium justify-self-end"
                  style={{ borderColor: 'var(--border)', color: 'var(--ink-2)', cursor: 'pointer' }}
                >
                  Open
                </button>
              </div>
            );
          })}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'crew' | 'rotation' | 'rest-hours' | 'certificates' | 'drills';

export function CrewingPage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'crew';
  const [search, setSearch] = useState('');
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [crewLoading, setCrewLoading] = useState(true);
  const [certCount, setCertCount] = useState(0);
  const [drillCount, setDrillCount] = useState(0);

  const loadCrew = useCallback(() => {
    setCrewLoading(true);
    api
      .get<CrewMember[]>('/crew-members')
      .then(setCrew)
      .catch(() => setCrew([]))
      .finally(() => setCrewLoading(false));
  }, []);

  useEffect(() => {
    loadCrew();
    api
      .get<CrewCert[]>('/crew-certificates')
      .then((c) => setCertCount(c.length))
      .catch(() => undefined);
    api
      .get<Drill[]>('/drills')
      .then((d) => setDrillCount(d.length))
      .catch(() => undefined);
  }, [loadCrew]);

  const setTab = (t: Tab) => setParams(t === 'crew' ? {} : { tab: t });

  const nonCompliant = crew.filter((c) => c.mlcStatus !== 'compliant').length;

  const TABS: { id: Tab; label: string; count: number }[] = [
    { id: 'crew', label: 'Crew', count: crew.length },
    { id: 'rotation', label: 'Rotation', count: crew.length },
    { id: 'rest-hours', label: 'Rest hours', count: nonCompliant },
    { id: 'certificates', label: 'Certificates', count: certCount },
    { id: 'drills', label: 'Drills', count: drillCount },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        background: 'var(--bg)',
      }}
    >
      {/* Sub-header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <h1
          className="text-[16px] font-semibold m-0"
          style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
        >
          Crewing
        </h1>
        <span className="text-[12px] whitespace-nowrap" style={{ color: 'var(--ink-3)' }}>
          MV HALCYON{crew.length > 0 ? ` · ${crew.length} on board` : ''} · MLC 2006
        </span>
        <div className="flex-1" />
        <div
          className="flex items-center gap-2 px-3 h-7 rounded-2 text-[12px]"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--ink-3)',
            width: 200,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M10.5 10.5 L14 14"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search crew, certs…"
            className="flex-1 bg-transparent outline-none text-[12px]"
            style={{ color: 'var(--ink)', border: 'none' }}
          />
        </div>
        <button
          className="px-3 py-1 rounded-2 border text-xs font-medium"
          style={{ borderColor: 'var(--border)', color: 'var(--ink-2)', cursor: 'pointer' }}
        >
          Crew pool
        </button>
        <button
          className="px-3 py-1 rounded-2 text-xs font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          + Sign on
        </button>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-0 flex-shrink-0 px-4 overflow-x-auto"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex items-center gap-2 px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap flex-shrink-0"
            style={
              tab === t.id
                ? { borderBottomColor: 'var(--navy)', color: 'var(--navy)', marginBottom: -1 }
                : { borderBottomColor: 'transparent', color: 'var(--ink-3)' }
            }
          >
            <span>{t.label}</span>
            <span
              className="font-mono text-[10.5px] px-1.5 py-px rounded-[10px]"
              style={{
                background: tab === t.id ? 'var(--navy)' : 'var(--surface-2)',
                color: tab === t.id ? '#fff' : 'var(--ink-3)',
              }}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'crew' && <CrewTab crew={crew} loading={crewLoading} />}
        {tab === 'rotation' && <RotationTab crew={crew} loading={crewLoading} />}
        {tab === 'rest-hours' && <RestHoursTab crew={crew} loading={crewLoading} />}
        {tab === 'certificates' && <CertificatesTab />}
        {tab === 'drills' && <DrillsTab />}
      </div>
    </div>
  );
}
