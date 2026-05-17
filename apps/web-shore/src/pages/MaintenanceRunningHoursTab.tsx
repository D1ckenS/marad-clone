import { useEffect, useState } from 'react';
import { Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { LogRunningHoursModal } from '../components/LogRunningHoursModal.js';
import type { ComponentItem } from '../components/EditComponentModal.js';

interface RunningHourReading {
  id: string;
  componentId: string;
  value: string;
  source: string;
  recordedAt: string;
}

interface JobInterval {
  componentId: string;
  intervalRunningHours: string | null;
}

interface CompRow {
  id: string;
  name: string;
  sfi: string | null;
  runningHours: string;
  lastReadingDate: string | null;
  nextInterval: number | null;
  pct: number;
  overdue: boolean;
}

function ProgressBar({ pct, overdue }: { pct: number; overdue: boolean }) {
  const color = overdue ? '#AB382E' : pct >= 90 ? '#B5731E' : '#0A1F33';
  return (
    <div
      style={{
        height: 4,
        background: '#EFEDE6',
        borderRadius: 4,
        overflow: 'hidden',
        width: '100%',
      }}
    >
      <div
        style={{
          width: `${Math.min(pct, 100)}%`,
          height: '100%',
          background: color,
          transition: 'width .3s',
        }}
      />
    </div>
  );
}

export function MaintenanceRunningHoursTab() {
  const [rows, setRows] = useState<CompRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logTarget, setLogTarget] = useState<ComponentItem | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([
      api.get<ComponentItem[]>('/components'),
      api.get<RunningHourReading[]>('/running-hour-readings'),
      api.get<JobInterval[]>('/jobs'),
    ])
      .then(([comps, readings, jobs]) => {
        // Latest reading per component
        const latestReading = new Map<string, RunningHourReading>();
        for (const r of readings) {
          const existing = latestReading.get(r.componentId);
          if (!existing || r.recordedAt > existing.recordedAt) {
            latestReading.set(r.componentId, r);
          }
        }
        // Smallest running-hour interval per component (first job to trigger)
        const nextIntervalByComp = new Map<string, number>();
        for (const j of jobs) {
          if (!j.intervalRunningHours) continue;
          const interval = parseFloat(j.intervalRunningHours);
          const existing = nextIntervalByComp.get(j.componentId);
          if (!existing || interval < existing) nextIntervalByComp.set(j.componentId, interval);
        }

        const built: CompRow[] = comps
          .map((c) => {
            const currentHours = parseFloat(c.runningHours) || 0;
            const lastReading = latestReading.get(c.id);
            const nextInterval = nextIntervalByComp.get(c.id) ?? null;
            // Progress within the current interval cycle
            let pct = 0;
            let overdue = false;
            if (nextInterval) {
              const cycleHours = currentHours % nextInterval;
              pct = (cycleHours / nextInterval) * 100;
              // If hours since last threshold crossing exceed interval, mark overdue
              overdue =
                pct >= 100 || (nextInterval > 0 && currentHours >= nextInterval && pct === 0);
            }
            return {
              id: c.id,
              name: c.name,
              sfi: c.sfi,
              runningHours: c.runningHours,
              lastReadingDate: lastReading?.recordedAt ?? null,
              nextInterval,
              pct,
              overdue,
            };
          })
          .sort((a, b) => b.pct - a.pct); // worst-first

        setRows(built);
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
      <div
        style={{
          background: '#fff',
          border: '1px solid #E5E3DA',
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        {/* Header row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 100px 140px 180px 100px',
            gap: 12,
            padding: '10px 16px',
            background: '#FAFAF7',
            alignItems: 'center',
          }}
        >
          {['Equipment', 'Hours', 'Last reading', 'Next interval', ''].map((h, i) => (
            <span
              key={i}
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#8893A0',
                textAlign: i >= 4 ? 'right' : 'left',
              }}
            >
              {h}
            </span>
          ))}
        </div>

        {rows.length === 0 && (
          <div
            style={{ padding: '32px 16px', textAlign: 'center', color: '#8893A0', fontSize: 12 }}
          >
            No components yet. Add them in the Components tab.
          </div>
        )}

        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 100px 140px 180px 100px',
              gap: 12,
              padding: '11px 16px',
              borderTop: '1px solid #EEEBE2',
              alignItems: 'center',
            }}
          >
            {/* Equipment */}
            <div>
              <div style={{ fontSize: 13, fontWeight: 500, color: '#0A1F33' }}>{r.name}</div>
              {r.sfi && (
                <div
                  style={{
                    fontSize: 10.5,
                    fontFamily: '"Geist Mono", monospace',
                    color: '#8893A0',
                  }}
                >
                  {r.sfi}
                </div>
              )}
            </div>

            {/* Current hours */}
            <div
              style={{
                fontFamily: '"Geist Mono", monospace',
                fontSize: 13,
                color: '#0A1F33',
                fontWeight: 600,
              }}
            >
              {parseFloat(r.runningHours).toLocaleString('en', { maximumFractionDigits: 1 })} h
            </div>

            {/* Last reading */}
            <div
              style={{
                fontSize: 11.5,
                color: r.lastReadingDate ? '#41546A' : '#8893A0',
                fontFamily: '"Geist Mono", monospace',
              }}
            >
              {r.lastReadingDate
                ? new Date(r.lastReadingDate).toLocaleDateString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  })
                : '— no readings'}
            </div>

            {/* Progress to next interval */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {r.nextInterval ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 11, color: '#8893A0' }}>every {r.nextInterval} h</span>
                    {r.overdue ? (
                      <span
                        style={{
                          background: '#F2DDD8',
                          color: '#AB382E',
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '1px 6px',
                          borderRadius: 4,
                        }}
                      >
                        OVERDUE
                      </span>
                    ) : (
                      <span
                        style={{
                          fontFamily: '"Geist Mono", monospace',
                          fontSize: 11,
                          color: r.pct >= 90 ? '#B5731E' : '#8893A0',
                        }}
                      >
                        {Math.round(r.pct)}%
                      </span>
                    )}
                  </div>
                  <ProgressBar pct={r.pct} overdue={r.overdue} />
                </>
              ) : (
                <span style={{ fontSize: 11.5, color: '#B6BDC6' }}>No RH interval jobs</span>
              )}
            </div>

            {/* Action */}
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() =>
                  setLogTarget({
                    id: r.id,
                    name: r.name,
                    description: null,
                    sfi: r.sfi,
                    parentId: null,
                    runningHours: r.runningHours,
                  })
                }
                style={{
                  fontSize: 11.5,
                  padding: '4px 10px',
                  border: '1px solid #E5E3DA',
                  borderRadius: 5,
                  background: '#fff',
                  color: '#41546A',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  whiteSpace: 'nowrap',
                }}
              >
                Log reading
              </button>
            </div>
          </div>
        ))}
      </div>

      <LogRunningHoursModal
        open={logTarget !== null}
        componentId={logTarget?.id ?? ''}
        componentName={logTarget?.name ?? ''}
        currentHours={logTarget?.runningHours ?? '0'}
        onClose={() => setLogTarget(null)}
        onLogged={() => {
          setLogTarget(null);
          load();
        }}
      />
    </div>
  );
}
