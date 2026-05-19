import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useVessel } from '../context/useVessel.js';

// ── Types ─────────────────────────────────────────────────────────────────────

type CheckStatus = 'PASS' | 'FAIL' | 'PARTIAL' | 'NOT_APPLICABLE';
type OverallStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PARTIAL';

interface DnvCheck {
  requirement: string;
  status: CheckStatus;
  evidence: string[];
  detail?: string;
}

interface DnvReport {
  vessel: { id: string; name: string; imoNumber: string | null };
  reportDate: string;
  standard: string;
  checks: DnvCheck[];
  overallStatus: OverallStatus;
  complianceScore: number;
  submissionReady: boolean;
}

interface IsoControl {
  id: string;
  title: string;
  category: string;
  status: 'IMPLEMENTED' | 'PARTIAL' | 'GAP' | 'NOT_APPLICABLE';
  evidence: string[];
  notes?: string;
}

interface IsoReport {
  assessmentDate: string;
  standard: string;
  controls: IsoControl[];
  summary: {
    total: number;
    implemented: number;
    partial: number;
    gaps: number;
    notApplicable: number;
    score: number;
  };
  keyFindings: string[];
  priorityActions: string[];
}

type View = 'overview' | 'dnv' | 'iso27001';

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<string, { bg: string; fg: string; labelKey: string }> = {
  PASS: { bg: '#E2EEE6', fg: '#2F7D4F', labelKey: 'compliance.status_pass' },
  FAIL: { bg: '#F2DDD8', fg: '#AB382E', labelKey: 'compliance.status_fail' },
  PARTIAL: { bg: '#F4E7D0', fg: '#B5731E', labelKey: 'compliance.status_partial' },
  NOT_APPLICABLE: { bg: '#F4F2EC', fg: '#8893A0', labelKey: 'compliance.status_na' },
  IMPLEMENTED: { bg: '#E2EEE6', fg: '#2F7D4F', labelKey: 'compliance.status_implemented' },
  GAP: { bg: '#F2DDD8', fg: '#AB382E', labelKey: 'compliance.status_gap' },
};

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const s = STATUS_STYLE[status] ?? STATUS_STYLE.NOT_APPLICABLE!;
  return (
    <span
      style={{
        background: s.bg,
        color: s.fg,
        fontSize: 10,
        fontWeight: 700,
        padding: '2px 7px',
        borderRadius: 4,
        letterSpacing: '0.04em',
        whiteSpace: 'nowrap',
      }}
    >
      {t(s.labelKey)}
    </span>
  );
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const color = score >= 90 ? '#2F7D4F' : score >= 70 ? '#B5731E' : '#AB382E';
  const circumference = 2 * Math.PI * 36;
  const offset = circumference * (1 - score / 100);
  return (
    <div style={{ textAlign: 'center' }}>
      <svg width="90" height="90" viewBox="0 0 90 90">
        <circle cx="45" cy="45" r="36" fill="none" stroke="#EEEBE2" strokeWidth="8" />
        <circle
          cx="45"
          cy="45"
          r="36"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 45 45)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text
          x="45"
          y="49"
          textAnchor="middle"
          style={{
            fontSize: 18,
            fontWeight: 700,
            fill: '#0A1F33',
            fontFamily: '"Geist Mono", monospace',
          }}
        >
          {score}%
        </text>
      </svg>
      <div style={{ fontSize: 11, color: '#8893A0', marginTop: 4 }}>{label}</div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        border: '1px solid #E5E3DA',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 16,
      }}
    >
      <div
        style={{
          padding: '10px 16px',
          borderBottom: '1px solid #EEEBE2',
          background: '#F4F2EC',
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0A1F33' }}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function NavBtn({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        border: 'none',
        background: active ? '#0A1F33' : 'transparent',
        color: active ? '#fff' : '#41546A',
        fontSize: 12.5,
        fontWeight: 500,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

// ── DNV Detail View ───────────────────────────────────────────────────────────

function DnvView({ vesselId }: { vesselId: string }) {
  const { t } = useTranslation();
  const [report, setReport] = useState<DnvReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<DnvReport>(`/compliance/dnv-type-approval/${vesselId}`)
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [vesselId]);

  if (loading)
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8893A0' }}>
        {t('common.loading')}
      </div>
    );
  if (!report)
    return <div style={{ padding: 24, color: '#AB382E' }}>{t('compliance.load_error')}</div>;

  const statusColors: Record<OverallStatus, string> = {
    COMPLIANT: '#2F7D4F',
    PARTIAL: '#B5731E',
    NON_COMPLIANT: '#AB382E',
  };

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          padding: '16px 0',
          marginBottom: 16,
        }}
      >
        <ScoreGauge score={report.complianceScore} label="DNV CG-0339" />
        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#0A1F33', marginBottom: 4 }}>
            {report.vessel.name}
            {report.vessel.imoNumber && (
              <span style={{ fontSize: 12, color: '#8893A0', marginLeft: 8 }}>
                IMO {report.vessel.imoNumber}
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: statusColors[report.overallStatus],
              marginBottom: 4,
            }}
          >
            {report.overallStatus.replace('_', ' ')}
          </div>
          <div style={{ fontSize: 11.5, color: '#8893A0' }}>
            {report.standard} · Generated{' '}
            {new Date(report.reportDate).toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </div>
          {report.submissionReady && (
            <span
              style={{
                display: 'inline-block',
                marginTop: 6,
                background: '#E2EEE6',
                color: '#2F7D4F',
                fontSize: 10.5,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 4,
              }}
            >
              {t('compliance.ready_for_dnv')}
            </span>
          )}
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <a
            href={`/api/v1/compliance/dnv-type-approval/${vesselId}/export`}
            download
            style={{
              display: 'inline-block',
              padding: '7px 16px',
              background: '#0A1F33',
              color: '#fff',
              borderRadius: 7,
              fontSize: 12.5,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {t('compliance.download_json')}
          </a>
        </div>
      </div>

      {/* Checks */}
      <Card title={t('compliance.compliance_checks')}>
        {report.checks.map((check, i) => (
          <div
            key={i}
            style={{
              padding: '12px 16px',
              borderTop: i === 0 ? 'none' : '1px solid #EEEBE2',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 10,
                marginBottom: 6,
              }}
            >
              <StatusBadge status={check.status} />
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#0A1F33' }}>
                {check.requirement}
              </span>
            </div>
            <ul style={{ margin: '4px 0 0 24px', padding: 0 }}>
              {check.evidence.map((e, ei) => (
                <li key={ei} style={{ fontSize: 11.5, color: '#41546A', lineHeight: 1.6 }}>
                  {e}
                </li>
              ))}
            </ul>
            {check.detail && (
              <div
                style={{
                  marginTop: 6,
                  fontSize: 11.5,
                  color: check.status === 'FAIL' ? '#AB382E' : '#B5731E',
                  fontStyle: 'italic',
                }}
              >
                → {check.detail}
              </div>
            )}
          </div>
        ))}
      </Card>
    </div>
  );
}

// ── ISO 27001 Detail View ─────────────────────────────────────────────────────

function IsoView() {
  const { t } = useTranslation();
  const [report, setReport] = useState<IsoReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [_expandGaps, _setExpandGaps] = useState(false);

  useEffect(() => {
    api
      .get<IsoReport>('/compliance/iso27001-readiness')
      .then(setReport)
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#8893A0' }}>
        {t('common.loading')}
      </div>
    );
  if (!report)
    return <div style={{ padding: 24, color: '#AB382E' }}>{t('compliance.load_error')}</div>;

  const categories = [...new Set(report.controls.map((c) => c.category))];

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '16px 0',
          marginBottom: 16,
        }}
      >
        <ScoreGauge score={report.summary.score} label="ISO 27001 Readiness" />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, color: '#0A1F33', fontWeight: 600, marginBottom: 8 }}>
            {report.standard}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              {
                label: t('compliance.implemented'),
                value: report.summary.implemented,
                bg: '#E2EEE6',
                fg: '#2F7D4F',
              },
              {
                label: t('compliance.status_partial'),
                value: report.summary.partial,
                bg: '#F4E7D0',
                fg: '#B5731E',
              },
              {
                label: t('compliance.gaps'),
                value: report.summary.gaps,
                bg: '#F2DDD8',
                fg: '#AB382E',
              },
              {
                label: t('compliance.status_na'),
                value: report.summary.notApplicable,
                bg: '#F4F2EC',
                fg: '#8893A0',
              },
            ].map((s) => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <span
                  style={{
                    display: 'block',
                    fontSize: 20,
                    fontWeight: 700,
                    fontFamily: '"Geist Mono", monospace',
                    color: s.fg,
                    background: s.bg,
                    borderRadius: 8,
                    padding: '6px 14px',
                  }}
                >
                  {s.value}
                </span>
                <span style={{ fontSize: 10.5, color: '#8893A0', marginTop: 3, display: 'block' }}>
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <a
          href="/api/v1/compliance/iso27001-readiness/export"
          download
          style={{
            display: 'inline-block',
            padding: '7px 16px',
            background: '#0A1F33',
            color: '#fff',
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 500,
            textDecoration: 'none',
            alignSelf: 'flex-start',
          }}
        >
          {t('compliance.download_json')}
        </a>
      </div>

      {/* Key findings */}
      <Card title={t('compliance.key_findings')}>
        <div style={{ padding: '12px 16px' }}>
          <ul style={{ margin: 0, padding: '0 0 0 18px' }}>
            {report.keyFindings.map((f, i) => (
              <li key={i} style={{ fontSize: 12.5, color: '#41546A', lineHeight: 1.8 }}>
                {f}
              </li>
            ))}
          </ul>
        </div>
      </Card>

      {/* Priority actions */}
      {report.priorityActions.length > 0 && (
        <Card title={t('compliance.priority_actions')}>
          <div style={{ padding: '12px 16px' }}>
            <ol style={{ margin: 0, padding: '0 0 0 18px' }}>
              {report.priorityActions.map((a, i) => (
                <li key={i} style={{ fontSize: 12.5, color: '#41546A', lineHeight: 1.8 }}>
                  {a}
                </li>
              ))}
            </ol>
          </div>
        </Card>
      )}

      {/* Controls by category */}
      {categories.map((category) => {
        const catControls = report.controls.filter((c) => c.category === category);
        return (
          <Card key={category} title={`${category} ${t('compliance.controls')}`}>
            {catControls.map((ctrl, i) => (
              <div
                key={ctrl.id}
                style={{
                  padding: '10px 16px',
                  borderTop: i === 0 ? 'none' : '1px solid #EEEBE2',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: '#8893A0',
                      fontFamily: '"Geist Mono", monospace',
                      minWidth: 40,
                    }}
                  >
                    {ctrl.id}
                  </span>
                  <StatusBadge status={ctrl.status} />
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: '#0A1F33' }}>
                    {ctrl.title}
                  </span>
                </div>
                <ul style={{ margin: '2px 0 0 48px', padding: 0 }}>
                  {ctrl.evidence.map((e, ei) => (
                    <li key={ei} style={{ fontSize: 11.5, color: '#41546A', lineHeight: 1.6 }}>
                      {e}
                    </li>
                  ))}
                </ul>
                {ctrl.notes && (
                  <div
                    style={{
                      marginTop: 4,
                      marginLeft: 48,
                      fontSize: 11.5,
                      color: '#B5731E',
                      fontStyle: 'italic',
                    }}
                  >
                    → {ctrl.notes}
                  </div>
                )}
              </div>
            ))}
          </Card>
        );
      })}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function CompliancePage() {
  const { t } = useTranslation();
  const { selectedVesselId, vessels } = useVessel();
  const [view, setView] = useState<View>('overview');
  const [overviewLoading, setOverviewLoading] = useState(false);
  const [overviewData, setOverviewData] = useState<Record<string, unknown> | null>(null);

  const vesselId = selectedVesselId ?? vessels[0]?.id;

  useEffect(() => {
    if (!vesselId) return;
    setOverviewLoading(true);
    api
      .get<Record<string, unknown>>(`/compliance/status/${vesselId}`)
      .then(setOverviewData)
      .catch(() => setOverviewData(null))
      .finally(() => setOverviewLoading(false));
  }, [vesselId]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: '#0A1F33',
            margin: '0 0 4px',
            letterSpacing: '-0.011em',
          }}
        >
          {t('compliance.title')}
        </h1>
        <p style={{ fontSize: 13, color: '#8893A0', margin: 0 }}>{t('compliance.subtitle')}</p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 20,
          padding: '5px 6px',
          background: '#F4F2EC',
          borderRadius: 8,
          border: '1px solid #EEEBE2',
          width: 'fit-content',
        }}
      >
        <NavBtn
          label={t('compliance.tab_overview')}
          active={view === 'overview'}
          onClick={() => setView('overview')}
        />
        <NavBtn
          label={t('compliance.tab_dnv')}
          active={view === 'dnv'}
          onClick={() => setView('dnv')}
        />
        <NavBtn
          label={t('compliance.tab_iso')}
          active={view === 'iso27001'}
          onClick={() => setView('iso27001')}
        />
      </div>

      {/* Overview */}
      {view === 'overview' && (
        <div>
          {!vesselId ? (
            <div style={{ textAlign: 'center', color: '#8893A0', padding: 40 }}>
              {t('compliance.select_vessel')}
            </div>
          ) : overviewLoading ? (
            <div style={{ textAlign: 'center', color: '#8893A0', padding: 40 }}>
              {t('common.loading')}
            </div>
          ) : overviewData ? (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
              }}
            >
              {/* DNV card */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E5E3DA',
                  borderRadius: 10,
                  padding: '20px 24px',
                  cursor: 'pointer',
                }}
                onClick={() => setView('dnv')}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: '#8893A0',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  {t('compliance.tab_dnv')}
                </div>
                <ScoreGauge
                  score={(overviewData.dnv as { score: number })?.score ?? 0}
                  label={
                    (overviewData.dnv as { status: string })?.status?.replace('_', ' ') ?? 'Unknown'
                  }
                />
                <div style={{ marginTop: 12, fontSize: 12, color: '#8893A0', textAlign: 'center' }}>
                  {t('compliance.click_report')}
                </div>
              </div>

              {/* ISO card */}
              <div
                style={{
                  background: '#fff',
                  border: '1px solid #E5E3DA',
                  borderRadius: 10,
                  padding: '20px 24px',
                  cursor: 'pointer',
                }}
                onClick={() => setView('iso27001')}
              >
                <div
                  style={{
                    fontSize: 11,
                    color: '#8893A0',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    marginBottom: 12,
                  }}
                >
                  {t('compliance.tab_iso')}
                </div>
                <ScoreGauge
                  score={(overviewData.iso27001 as { score: number })?.score ?? 0}
                  label={`${(overviewData.iso27001 as { implemented: number })?.implemented ?? 0} ${t('compliance.controls_implemented')}`}
                />
                <div style={{ marginTop: 12, fontSize: 12, color: '#8893A0', textAlign: 'center' }}>
                  {t('compliance.click_assessment')}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {view === 'dnv' && vesselId && <DnvView vesselId={vesselId} />}
      {view === 'iso27001' && <IsoView />}
    </div>
  );
}
