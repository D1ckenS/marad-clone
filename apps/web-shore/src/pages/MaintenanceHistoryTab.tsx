import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface JobHistory {
  id: string;
  jobId: string;
  componentId: string;
  jobInstanceId: string;
  completedAt: string;
  completedByUserId: string;
  hoursWorked: string | null;
  notes: string | null;
  partsConsumed: unknown[] | null;
  photos: unknown[] | null;
}

interface JobMeta {
  id: string;
  title: string;
}
interface CompMeta {
  id: string;
  name: string;
}

const ROW: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '28px 150px 1fr 130px 60px 48px 48px',
  gap: 12,
  alignItems: 'center',
  padding: '10px 16px',
  borderTop: '1px solid #EEEBE2',
};

export function MaintenanceHistoryTab() {
  const { t } = useTranslation();
  const [histories, setHistories] = useState<JobHistory[]>([]);
  const [jobsById, setJobsById] = useState<Map<string, string>>(new Map());
  const [compsById, setCompsById] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<JobHistory[]>('/job-histories'),
      api.get<JobMeta[]>('/jobs'),
      api.get<CompMeta[]>('/components'),
    ])
      .then(([h, j, c]) => {
        setHistories(h);
        setJobsById(new Map(j.map((x) => [x.id, x.title])));
        setCompsById(new Map(c.map((x) => [x.id, x.name])));
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div style={{ padding: 40, display: 'flex', justifyContent: 'center' }}>
        <Spinner />
      </div>
    );
  if (error) return <div style={{ padding: 20, color: '#AB382E', fontSize: 13 }}>{error}</div>;

  return (
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
        <span />
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#8893A0',
          }}
        >
          {t('common.date')}
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
          {t('maintenance.job')} / {t('maintenance.tab_components')}
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
          {t('maintenance.sign_off')}
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
          h
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#8893A0',
            textAlign: 'center',
          }}
        >
          📷
        </span>
        <span
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#8893A0',
            textAlign: 'center',
          }}
        >
          🔩
        </span>
      </div>

      {histories.length === 0 && (
        <div style={{ padding: '32px 16px', textAlign: 'center', color: '#8893A0', fontSize: 12 }}>
          {t('maintenance.no_history')}
        </div>
      )}

      {histories.map((h) => {
        const photoCount = Array.isArray(h.photos) ? h.photos.length : 0;
        const partCount = Array.isArray(h.partsConsumed) ? h.partsConsumed.length : 0;
        const date = new Date(h.completedAt);
        return (
          <div key={h.id} style={ROW}>
            {/* Lock — immutability indicator */}
            <span
              style={{ fontSize: 13, textAlign: 'center', color: '#8893A0' }}
              title="Immutable record"
            >
              🔒
            </span>

            {/* Date */}
            <div>
              <div
                style={{ fontSize: 12.5, fontFamily: '"Geist Mono", monospace', color: '#0A1F33' }}
              >
                {date.toLocaleDateString('en-GB', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
              <div
                style={{ fontSize: 10.5, color: '#8893A0', fontFamily: '"Geist Mono", monospace' }}
              >
                {date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} UTC
              </div>
            </div>

            {/* Job / Component */}
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
                {jobsById.get(h.jobId) ?? h.jobId.slice(-8)}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#8893A0',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {compsById.get(h.componentId) ?? h.componentId.slice(-8)}
              </div>
            </div>

            {/* Signed by */}
            <div
              style={{
                fontSize: 11,
                color: '#41546A',
                fontFamily: '"Geist Mono", monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {h.completedByUserId.slice(-8)}
            </div>

            {/* Hours */}
            <div
              style={{
                fontSize: 12.5,
                fontFamily: '"Geist Mono", monospace',
                color: '#0A1F33',
                textAlign: 'right',
              }}
            >
              {h.hoursWorked ?? '—'}
            </div>

            {/* Photos */}
            <div
              style={{
                fontSize: 12,
                textAlign: 'center',
                color: photoCount > 0 ? '#41546A' : '#B6BDC6',
              }}
            >
              {photoCount > 0 ? photoCount : '—'}
            </div>

            {/* Parts */}
            <div
              style={{
                fontSize: 12,
                textAlign: 'center',
                color: partCount > 0 ? '#41546A' : '#B6BDC6',
              }}
            >
              {partCount > 0 ? partCount : '—'}
            </div>
          </div>
        );
      })}

      {histories.length > 0 && (
        <div
          style={{
            padding: '10px 16px',
            borderTop: '1px solid #EEEBE2',
            fontSize: 11,
            color: '#8893A0',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <span>🔒</span>
          <span>{t('maintenance.immutable_records')}</span>
        </div>
      )}
    </div>
  );
}
