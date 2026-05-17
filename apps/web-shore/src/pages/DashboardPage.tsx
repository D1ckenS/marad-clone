import { useEffect, useState } from 'react';
import { api } from '../api/client.js';
import { useAuth } from '../context/AuthContext.js';

interface Kpi {
  label: string;
  value: string | number;
  sub?: string;
  tone?: 'green' | 'amber' | 'red' | 'neutral';
}

const TONES = {
  green: { bg: '#E2EEE6', fg: '#2F7D4F' },
  amber: { bg: '#F4E7D0', fg: '#B5731E' },
  red: { bg: '#F2DDD8', fg: '#AB382E' },
  neutral: { bg: '#F4F2EC', fg: '#41546A' },
};

function KpiTile({ label, value, sub, tone = 'neutral' }: Kpi) {
  const { bg, fg } = TONES[tone];
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E5E3DA',
        borderRadius: 10,
        padding: '16px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <span
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#8893A0',
        }}
      >
        {label}
      </span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span
          style={{
            fontSize: 30,
            fontWeight: 600,
            letterSpacing: '-0.025em',
            fontFamily: '"Geist Mono", monospace',
            color: '#0A1F33',
          }}
        >
          {value}
        </span>
        {sub && <span style={{ fontSize: 11.5, color: '#8893A0' }}>{sub}</span>}
      </div>
      <span
        style={{
          display: 'inline-flex',
          alignSelf: 'flex-start',
          background: bg,
          color: fg,
          fontSize: 10.5,
          fontWeight: 500,
          padding: '1px 6px',
          borderRadius: 4,
        }}
      >
        {tone === 'green'
          ? 'All clear'
          : tone === 'red'
            ? 'Needs attention'
            : tone === 'amber'
              ? 'Review'
              : '—'}
      </span>
    </div>
  );
}

interface JobInstance {
  id: string;
  status: string;
  dueAt: string | null;
  jobId: string;
}
interface Requisition {
  id: string;
  status: string;
  title: string;
}
interface PartSummary {
  id: string;
  name: string;
  stockLevels: { status: string }[];
}

export function DashboardPage() {
  const { user } = useAuth();
  const [instances, setInstances] = useState<JobInstance[]>([]);
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [parts, setParts] = useState<PartSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<JobInstance[]>('/job-instances').catch(() => []),
      api.get<Requisition[]>('/requisitions').catch(() => []),
      api.get<PartSummary[]>('/parts/inventory-summary').catch(() => []),
    ])
      .then(([ji, rq, pt]) => {
        setInstances(ji as JobInstance[]);
        setReqs(rq as Requisition[]);
        setParts(pt as PartSummary[]);
      })
      .finally(() => setLoading(false));
  }, []);

  const today = new Date().toISOString().split('T')[0] ?? '';
  const overdue = instances.filter((i) => i.status !== 'DONE' && i.dueAt && i.dueAt < today).length;
  const dueToday = instances.filter(
    (i) => i.status !== 'DONE' && i.dueAt && i.dueAt.startsWith(today),
  ).length;
  const pendingApprovals = reqs.filter((r) => r.status === 'SUBMITTED').length;
  const lowStock = parts.filter((p) =>
    p.stockLevels.some((l) => l.status === 'red' || l.status === 'amber'),
  ).length;
  const drafts = reqs.filter((r) => r.status === 'DRAFT').length;

  const kpis: Kpi[] = [
    { label: 'Overdue jobs', value: overdue, tone: overdue > 0 ? 'red' : 'green' },
    { label: 'Due today', value: dueToday, tone: dueToday > 0 ? 'amber' : 'green' },
    {
      label: 'Pending approval',
      value: pendingApprovals,
      tone: pendingApprovals > 0 ? 'amber' : 'green',
    },
    { label: 'Low / out of stock', value: lowStock, tone: lowStock > 0 ? 'amber' : 'green' },
    { label: 'Draft requisitions', value: drafts, tone: 'neutral' },
  ];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div style={{ maxWidth: 960, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            letterSpacing: '-0.011em',
            color: '#0A1F33',
            margin: '0 0 4px',
          }}
        >
          {greeting()}
          {user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </h1>
        <p style={{ fontSize: 13, color: '#8893A0', margin: 0 }}>
          {new Date().toLocaleDateString('en-GB', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>

      {/* KPI strip */}
      {loading ? (
        <div
          style={{
            height: 120,
            background: '#fff',
            borderRadius: 10,
            border: '1px solid #E5E3DA',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#8893A0',
            marginBottom: 24,
          }}
        >
          Loading…
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(5, 1fr)',
            gap: 12,
            marginBottom: 28,
          }}
        >
          {kpis.map((k) => (
            <KpiTile key={k.label} {...k} />
          ))}
        </div>
      )}

      {/* Two-column content */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Open jobs */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E5E3DA',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #EEEBE2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0A1F33' }}>
              Open Job Instances
            </span>
            <span style={{ fontSize: 11, color: '#8893A0' }}>
              {instances.filter((i) => i.status !== 'DONE').length} open
            </span>
          </div>
          {instances
            .filter((i) => i.status !== 'DONE')
            .slice(0, 6)
            .map((inst) => {
              const isOverdue = inst.dueAt && inst.dueAt < today;
              return (
                <div
                  key={inst.id}
                  style={{
                    padding: '10px 16px',
                    borderTop: '1px solid #EEEBE2',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <span
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      flexShrink: 0,
                      background: isOverdue
                        ? '#AB382E'
                        : inst.status === 'IN_PROGRESS'
                          ? '#1F5B9D'
                          : '#CECABE',
                    }}
                  />
                  <span
                    style={{
                      flex: 1,
                      fontSize: 11,
                      color: '#0A1F33',
                      fontFamily: '"Geist Mono", monospace',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {inst.jobId.slice(-10)}
                  </span>
                  <span style={{ fontSize: 11, color: isOverdue ? '#AB382E' : '#8893A0' }}>
                    {inst.dueAt ? inst.dueAt.split('T')[0] : 'No date'}
                  </span>
                </div>
              );
            })}
          {instances.filter((i) => i.status !== 'DONE').length === 0 && (
            <div
              style={{ padding: '24px 16px', textAlign: 'center', color: '#8893A0', fontSize: 12 }}
            >
              All jobs complete
            </div>
          )}
        </div>

        {/* Requisitions */}
        <div
          style={{
            background: '#fff',
            border: '1px solid #E5E3DA',
            borderRadius: 10,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #EEEBE2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0A1F33' }}>Requisitions</span>
            <span style={{ fontSize: 11, color: '#8893A0' }}>{reqs.length} total</span>
          </div>
          {reqs.length === 0 && !loading && (
            <div
              style={{ padding: '28px 16px', textAlign: 'center', color: '#8893A0', fontSize: 12 }}
            >
              No requisitions yet
            </div>
          )}
          {reqs.slice(0, 7).map((r) => {
            const COLOR: Record<string, string> = {
              DRAFT: '#CECABE',
              SUBMITTED: '#B5731E',
              APPROVED: '#2F7D4F',
              REJECTED: '#AB382E',
            };
            const BG: Record<string, string> = {
              DRAFT: '#F4F2EC',
              SUBMITTED: '#F4E7D0',
              APPROVED: '#E2EEE6',
              REJECTED: '#F2DDD8',
            };
            return (
              <div
                key={r.id}
                style={{
                  padding: '9px 16px',
                  borderTop: '1px solid #EEEBE2',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <span
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    color: '#0A1F33',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.title}
                </span>
                <span
                  style={{
                    background: BG[r.status] ?? '#F4F2EC',
                    color: COLOR[r.status] ?? '#41546A',
                    fontSize: 10.5,
                    fontWeight: 500,
                    padding: '1px 6px',
                    borderRadius: 4,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {r.status}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
