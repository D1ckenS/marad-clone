import { useEffect, useState } from 'react';
import { Button, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import type { Job } from '../components/EditJobModal.js';

interface CompMeta {
  id: string;
  name: string;
}

interface TemplatesTabProps {
  onCreateJob: (componentId: string, componentName: string) => void;
  onEditJob: (job: Job, componentName: string) => void;
  onScheduleJob: (jobId: string, componentId: string) => void;
}

const PRIORITY_STYLE: Record<string, { bg: string; fg: string }> = {
  CRITICAL: { bg: '#F2DDD8', fg: '#AB382E' },
  HIGH: { bg: '#F4E7D0', fg: '#B5731E' },
  NORMAL: { bg: '#F4F2EC', fg: '#41546A' },
  LOW: { bg: '#F4F2EC', fg: '#8893A0' },
};

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 160px 130px 80px 70px 80px',
  gap: 12,
  alignItems: 'center',
  padding: '10px 16px',
  borderTop: '1px solid #EEEBE2',
};

export function MaintenanceTemplatesTab({
  onCreateJob,
  onEditJob,
  onScheduleJob,
}: TemplatesTabProps) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [compsById, setCompsById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([api.get<Job[]>('/jobs'), api.get<CompMeta[]>('/components')])
      .then(([j, c]) => {
        setJobs(j);
        setCompsById(new Map(c.map((x) => [x.id, x.name])));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  if (loading)
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  if (error) return <div style={{ padding: 20, color: '#AB382E', fontSize: 13 }}>{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'flex-end' }}>
        <Button variant="secondary" size="sm" onClick={() => onCreateJob('', '')}>
          + New Job Template
        </Button>
      </div>

      <div
        style={{
          background: '#fff',
          border: '1px solid #E5E3DA',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ ...ROW, borderTop: 'none', background: '#FAFAF7' }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8893A0',
            }}
          >
            Job
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8893A0',
            }}
          >
            Component
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8893A0',
            }}
          >
            Interval
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8893A0',
            }}
          >
            Priority
          </span>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8893A0',
              textAlign: 'right',
            }}
          >
            Est. h
          </span>
          <span />
        </div>

        {jobs.length === 0 && (
          <div
            style={{ padding: '32px 16px', textAlign: 'center', color: '#8893A0', fontSize: 12 }}
          >
            No job templates yet. Add one via the Components tab.
          </div>
        )}

        {jobs.map((j) => {
          const compName = compsById.get(j.componentId) ?? j.componentId.slice(-8);
          const intervalLabel = j.intervalDays
            ? `${j.intervalDays}d`
            : j.intervalRunningHours
              ? `${j.intervalRunningHours}h RH`
              : '—';
          const intervalKind =
            j.intervalDays && j.intervalRunningHours
              ? 'RH+CAL'
              : j.intervalRunningHours
                ? 'RH'
                : 'CAL';
          const pStyle = (PRIORITY_STYLE[j.priority] ?? PRIORITY_STYLE['NORMAL']) as {
            bg: string;
            fg: string;
          };
          const partsCount = j.typicalPartsJson
            ? (() => {
                try {
                  return (JSON.parse(j.typicalPartsJson) as unknown[]).length;
                } catch {
                  return 0;
                }
              })()
            : 0;

          return (
            <div key={j.id} style={{ ...ROW }} className="group">
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: '#0A1F33',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {j.title}
                </div>
                {partsCount > 0 && (
                  <div style={{ fontSize: 11, color: '#8893A0', marginTop: 1 }}>
                    {partsCount} typical part{partsCount !== 1 ? 's' : ''}
                  </div>
                )}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: '#41546A',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {compName}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span
                  style={{ fontFamily: '"Geist Mono", monospace', fontSize: 12, color: '#0A1F33' }}
                >
                  {intervalLabel}
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    background: '#F4F2EC',
                    color: '#8893A0',
                    padding: '1px 5px',
                    borderRadius: 3,
                  }}
                >
                  {intervalKind}
                </span>
              </div>

              <span
                style={{
                  background: pStyle.bg,
                  color: pStyle.fg,
                  fontSize: 10.5,
                  fontWeight: 500,
                  padding: '2px 7px',
                  borderRadius: 4,
                  display: 'inline-flex',
                  alignSelf: 'flex-start',
                }}
              >
                {j.priority}
              </span>

              <div
                style={{
                  fontSize: 12.5,
                  fontFamily: '"Geist Mono", monospace',
                  color: '#0A1F33',
                  textAlign: 'right',
                }}
              >
                {j.estimatedHours ?? '—'}
              </div>

              <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => onScheduleJob(j.id, j.componentId)}
                  style={{
                    fontSize: 11.5,
                    padding: '3px 8px',
                    border: '1px solid #E5E3DA',
                    borderRadius: 5,
                    background: '#fff',
                    color: '#41546A',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  + Instance
                </button>
                <button
                  onClick={() => onEditJob(j, compName)}
                  style={{
                    fontSize: 11.5,
                    padding: '3px 8px',
                    border: '1px solid #E5E3DA',
                    borderRadius: 5,
                    background: '#fff',
                    color: '#41546A',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  Edit
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
