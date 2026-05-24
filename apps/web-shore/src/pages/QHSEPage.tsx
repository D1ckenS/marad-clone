import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Badge, type BadgeColor, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { useVessel } from '../context/useVessel.js';
import { CreateQhseObjectiveModal } from '../components/CreateQhseObjectiveModal.js';
import { CreateAuditModal } from '../components/CreateAuditModal.js';
import { CreateAuditFindingModal } from '../components/CreateAuditFindingModal.js';
import { CreateVoyageLegModal } from '../components/CreateVoyageLegModal.js';
import { CreateDischargeLogModal } from '../components/CreateDischargeLogModal.js';
import { CreateDrybmsElementModal } from '../components/CreateDrybmsElementModal.js';
import { CreateManagementReviewModal } from '../components/CreateManagementReviewModal.js';
import { EditQhseObjectiveModal } from '../components/EditQhseObjectiveModal.js';
import { EditAuditModal } from '../components/EditAuditModal.js';
import { EditAuditFindingModal } from '../components/EditAuditFindingModal.js';
import { EditVoyageLegModal } from '../components/EditVoyageLegModal.js';
import { EditDischargeLogModal } from '../components/EditDischargeLogModal.js';
import { EditDrybmsElementModal } from '../components/EditDrybmsElementModal.js';
import { EditManagementReviewModal } from '../components/EditManagementReviewModal.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type ObjCategory = 'safety' | 'quality' | 'env' | 'health';
type AuditKind = 'Internal' | 'External' | 'Vetting';
type AuditStatus = 'scheduled' | 'closed' | 'overdue';

interface QhseObjective {
  id: string;
  category: ObjCategory;
  label: string;
  target: string;
  actual: string;
  unit: string;
  status: 'green' | 'amber' | 'red';
  delta: string;
  trend: number[];
}

interface Audit {
  id: string;
  kind: AuditKind;
  scope: string;
  scheduledAt: string;
  auditor: string;
  status: AuditStatus;
  findings: string;
  daysOut: number;
  tone: string;
}

interface AuditFinding {
  id: string;
  auditRef: string;
  classification: string;
  smsRef: string;
  title: string;
  detail: string;
  owner: string;
  openedAt: string;
  dueAt: string;
  daysLeft: number;
  tone: string;
}

interface VoyageLeg {
  id: string;
  route: string;
  departureAt: string;
  arrivalAt: string;
  nm: number;
  fuelTonnes: number;
  co2Tonnes: number;
  soxTonnes: number;
  noxTonnes: number;
  hours: number;
  mode: 'laden' | 'ballast';
  cargo: string;
}

interface DischargeLog {
  id: string;
  kind: string;
  when: string;
  where: string;
  volume: string;
  notes: string;
  compliant: boolean;
}

interface DryBmsElement {
  id: string;
  chapter: string;
  chapterTitle: string;
  name: string;
  score: number;
  target: number;
  evidence: string;
}

interface ManagementReview {
  id: string;
  kind: string;
  scheduledAt: string;
  chair: string;
  attendees: number | string;
  status: 'scheduled' | 'closed';
  actionsTotal: number;
  actionsDone: number;
  summary: string;
  tone: string;
}

// ─── Normalizers: shore API → page-local shapes ──────────────────────────────
// The QHSE shore endpoints return uppercase enum values and a few fewer fields
// than this page renders (e.g. AuditKind 'CLASS'/'FLAG' collapse to 'External';
// VoyageLeg numerics arrive as Prisma Decimal strings). These mappers do the
// translation in one place so the rendering code stays untouched.

interface RawQhseObjective {
  id: string;
  category: 'Q' | 'H' | 'S' | 'E';
  label: string;
  target: string;
  actual: string;
  unit: string;
  status: 'GREEN' | 'AMBER' | 'RED';
  delta: string | null;
  trend: number[] | null;
}

interface RawAudit {
  id: string;
  kind: 'INTERNAL' | 'EXTERNAL' | 'CLASS' | 'FLAG';
  scope: string;
  scheduledAt: string;
  auditor: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  findings: number;
  notes?: string | null;
}

interface RawAuditFinding {
  id: string;
  auditId: string | null;
  classification: string;
  smsRef: string | null;
  title: string;
  detail: string | null;
  owner: string | null;
  openedAt: string;
  dueAt: string | null;
  closedAt: string | null;
}

interface RawVoyageLeg {
  id: string;
  route: string;
  departureAt: string;
  arrivalAt: string;
  nm: string;
  fuelTonnes: string;
  co2Tonnes: string;
  soxTonnes: string;
  noxTonnes: string;
  hours: string;
  mode: 'LADEN' | 'BALLAST';
  cargo: string | null;
}

interface RawDischargeLog {
  id: string;
  kind: string;
  occurredAt: string;
  location: string;
  volume: string;
  notes: string | null;
  compliant: boolean;
}

interface RawDrybmsElement {
  id: string;
  chapter: string;
  chapterTitle: string;
  name: string;
  score: number;
  stage: string | null;
  evidence: string | null;
}

interface RawManagementReview {
  id: string;
  kind: string;
  scheduledAt: string;
  chair: string;
  attendees: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'CLOSED' | 'CANCELLED';
  actionsTotal: number;
  actionsDone: number;
  summary: string | null;
}

const OBJ_CAT_MAP: Record<RawQhseObjective['category'], ObjCategory> = {
  Q: 'quality',
  H: 'health',
  S: 'safety',
  E: 'env',
};

const AUDIT_KIND_MAP: Record<RawAudit['kind'], AuditKind> = {
  INTERNAL: 'Internal',
  EXTERNAL: 'External',
  CLASS: 'External',
  FLAG: 'External',
};

function normalizeQhseObjectives(raw: RawQhseObjective[]): QhseObjective[] {
  return raw.map((r) => ({
    id: r.id,
    category: OBJ_CAT_MAP[r.category],
    label: r.label,
    target: r.target,
    actual: r.actual,
    unit: r.unit,
    status: r.status.toLowerCase() as QhseObjective['status'],
    delta: r.delta ?? '',
    trend: r.trend ?? [],
  }));
}

function normalizeAudits(raw: RawAudit[]): Audit[] {
  const now = Date.now();
  return raw.map((r) => {
    const daysOut = Math.round((new Date(r.scheduledAt).getTime() - now) / 86_400_000);
    const status: AuditStatus =
      r.status === 'COMPLETED' ? 'closed' : daysOut < 0 ? 'overdue' : 'scheduled';
    const tone = status === 'overdue' ? 'red' : status === 'closed' ? 'green' : 'amber';
    return {
      id: r.id,
      kind: AUDIT_KIND_MAP[r.kind],
      scope: r.scope,
      scheduledAt: r.scheduledAt,
      auditor: r.auditor,
      status,
      findings: String(r.findings),
      daysOut,
      tone,
    };
  });
}

function normalizeAuditFindings(raw: RawAuditFinding[]): AuditFinding[] {
  const now = Date.now();
  return raw.map((r) => {
    const daysLeft = r.dueAt ? Math.round((new Date(r.dueAt).getTime() - now) / 86_400_000) : 0;
    return {
      id: r.id,
      auditRef: r.auditId ?? '—',
      classification: r.classification,
      smsRef: r.smsRef ?? '—',
      title: r.title,
      detail: r.detail ?? '',
      owner: r.owner ?? '—',
      openedAt: r.openedAt,
      dueAt: r.dueAt ?? '',
      daysLeft,
      tone: daysLeft < 0 ? 'red' : daysLeft <= 14 ? 'amber' : 'green',
    };
  });
}

function normalizeVoyageLegs(raw: RawVoyageLeg[]): VoyageLeg[] {
  return raw.map((r) => ({
    id: r.id,
    route: r.route,
    departureAt: r.departureAt,
    arrivalAt: r.arrivalAt,
    nm: Number(r.nm),
    fuelTonnes: Number(r.fuelTonnes),
    co2Tonnes: Number(r.co2Tonnes),
    soxTonnes: Number(r.soxTonnes),
    noxTonnes: Number(r.noxTonnes),
    hours: Number(r.hours),
    mode: r.mode.toLowerCase() as VoyageLeg['mode'],
    cargo: r.cargo ?? '—',
  }));
}

function normalizeDischargeLogs(raw: RawDischargeLog[]): DischargeLog[] {
  return raw.map((r) => ({
    id: r.id,
    kind: r.kind,
    when: r.occurredAt,
    where: r.location,
    volume: r.volume,
    notes: r.notes ?? '',
    compliant: r.compliant,
  }));
}

function normalizeDrybms(raw: RawDrybmsElement[]): DryBmsElement[] {
  return raw.map((r) => ({
    id: r.id,
    chapter: r.chapter,
    chapterTitle: r.chapterTitle,
    name: r.name,
    score: r.score,
    target: 4, // DryBMS aspirational maturity is always 4 (Excellent)
    evidence: r.evidence ?? '',
  }));
}

function normalizeManagementReviews(raw: RawManagementReview[]): ManagementReview[] {
  return raw.map((r) => {
    const status: ManagementReview['status'] = r.status === 'CLOSED' ? 'closed' : 'scheduled';
    return {
      id: r.id,
      kind: r.kind,
      scheduledAt: r.scheduledAt,
      chair: r.chair,
      attendees: r.attendees,
      status,
      actionsTotal: r.actionsTotal,
      actionsDone: r.actionsDone,
      summary: r.summary ?? '',
      tone: status === 'closed' ? 'green' : 'amber',
    };
  });
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const CAT_META: Record<ObjCategory, { labelKey: string; color: BadgeColor; short: string }> = {
  safety: { labelKey: 'qhse.cat_safety', color: 'red', short: 'SAFE' },
  quality: { labelKey: 'qhse.cat_quality', color: 'blue', short: 'QUAL' },
  env: { labelKey: 'qhse.cat_env', color: 'green', short: 'ENV' },
  health: { labelKey: 'qhse.cat_health', color: 'purple', short: 'HLTH' },
};

const toneColor = (t: string): BadgeColor =>
  t === 'red'
    ? 'red'
    : t === 'amber'
      ? 'amber'
      : t === 'blue'
        ? 'blue'
        : t === 'green'
          ? 'green'
          : 'slate';

const stageMeta: Record<number, { labelKey: string; tone: string; bg: string }> = {
  1: { labelKey: 'qhse.awareness', tone: 'var(--sig-red)', bg: '#F2DDD8' },
  2: { labelKey: 'qhse.implementation', tone: 'var(--sig-amber)', bg: '#F4E7D0' },
  3: { labelKey: 'qhse.measurement', tone: 'var(--sig-blue)', bg: '#DDE7F3' },
  4: { labelKey: 'qhse.continuous_improvement', tone: 'var(--sig-green)', bg: '#E2EEE6' },
};

type Tab = 'obj' | 'audit' | 'env' | 'dryb' | 'review';

// ─── Shared atoms ─────────────────────────────────────────────────────────────

function EmptyState({ msg }: { msg: string }) {
  return (
    <div className="flex-1 flex items-center justify-center p-10">
      <p className="text-xs text-center" style={{ color: 'var(--ink-3)' }}>
        {msg}
      </p>
    </div>
  );
}

function KpiTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent?: string;
}) {
  return (
    <div
      className="rounded-2 px-4 py-3"
      style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
    >
      <div
        className="text-[10.5px] font-semibold uppercase tracking-widest mb-1"
        style={{ color: 'var(--ink-3)' }}
      >
        {label}
      </div>
      <div
        className="font-mono text-[22px] font-semibold"
        style={{ color: accent ?? 'var(--ink)', letterSpacing: '-0.02em' }}
      >
        {value}
      </div>
      <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
        {sub}
      </div>
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const w = 70;
  const h = 18;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pts = data
    .map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * h}`)
    .join(' ');
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Objectives tab ───────────────────────────────────────────────────────────

function ObjectivesTab({
  objectives,
  loading,
  onAdd,
  onEdit,
}: {
  objectives: QhseObjective[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [catFilter, setCatFilter] = useState<'all' | ObjCategory>('all');
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const visible =
    catFilter === 'all' ? objectives : objectives.filter((o) => o.category === catFilter);

  const groups: Partial<Record<ObjCategory, QhseObjective[]>> = {};
  visible.forEach((o) => {
    (groups[o.category] ??= []).push(o);
  });

  const chipStyle = (active: boolean): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 24,
    padding: '0 10px',
    borderRadius: 5,
    fontSize: 11.5,
    fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
    background: active ? 'var(--ink)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--ink-2)',
  });

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
      <div
        className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
      >
        <span
          className="text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--ink-3)' }}
        >
          {t('qhse.category')}
        </span>
        <button onClick={() => setCatFilter('all')} style={chipStyle(catFilter === 'all')}>
          {t('qhse.category_all')}
          {objectives.length}
        </button>
        {(Object.entries(CAT_META) as [ObjCategory, (typeof CAT_META)[ObjCategory]][]).map(
          ([k, v]) => (
            <button key={k} onClick={() => setCatFilter(k)} style={chipStyle(catFilter === k)}>
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background:
                    v.color === 'red'
                      ? 'var(--sig-red)'
                      : v.color === 'green'
                        ? 'var(--sig-green)'
                        : v.color === 'blue'
                          ? 'var(--sig-blue)'
                          : '#5E479F',
                }}
              />
              {t(v.labelKey)}
            </button>
          ),
        )}
        <div className="flex-1" />
        <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          {visible.filter((o) => o.status === 'green').length} {t('qhse.on_target')} ·{' '}
          {visible.filter((o) => o.status !== 'green').length} {t('qhse.attention')}
        </span>
        <button
          onClick={onAdd}
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          + Objective
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState msg="No QHSE objectives on file. Configure your KPI framework to track performance." />
      ) : (
        <div className="p-4 flex flex-col gap-4">
          {(Object.entries(groups) as [ObjCategory, QhseObjective[]][]).map(([cat, items]) => {
            const m = CAT_META[cat];
            return (
              <div key={cat}>
                <div className="flex items-baseline gap-2 mb-2">
                  <span
                    className="text-[10.5px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {t(m.labelKey)}
                  </span>
                  <Badge color={m.color}>{m.short}</Badge>
                  <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {items.length} {items.length === 1 ? t('qhse.kpi') : t('qhse.kpis')}
                  </span>
                </div>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {items.map((o) => {
                    const color =
                      o.status === 'red'
                        ? 'var(--sig-red)'
                        : o.status === 'amber'
                          ? 'var(--sig-amber)'
                          : 'var(--sig-green)';
                    return (
                      <div
                        key={o.id}
                        onClick={() => onEdit(o.id)}
                        className="rounded-2 p-3.5"
                        style={{
                          background: 'var(--surface)',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <div className="flex items-baseline justify-between gap-1.5">
                          <span
                            className="text-[9.5px] font-semibold uppercase tracking-widest"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {o.id}
                          </span>
                          <Badge color={toneColor(o.status)}>{o.delta}</Badge>
                        </div>
                        <div
                          className="text-[11.5px] font-medium"
                          style={{ color: 'var(--ink-2)', lineHeight: 1.3 }}
                        >
                          {o.label}
                        </div>
                        <div className="flex items-baseline gap-1.5">
                          <span
                            className="font-mono text-[24px] font-semibold"
                            style={{ color, letterSpacing: '-0.02em' }}
                          >
                            {o.actual}
                          </span>
                          <span className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                            {o.unit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
                            {t('qhse.target_lower')} {o.target}
                          </span>
                          <Sparkline data={o.trend} color={color} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Audits tab ───────────────────────────────────────────────────────────────

function AuditsTab({
  audits,
  auditFindings,
  loading,
  onAddAudit,
  onAddFinding,
  onEditAudit,
  onEditFinding,
  canAddFinding,
}: {
  audits: Audit[];
  auditFindings: AuditFinding[];
  loading: boolean;
  onAddAudit: () => void;
  onAddFinding: () => void;
  onEditAudit: (id: string) => void;
  onEditFinding: (id: string) => void;
  canAddFinding: boolean;
}) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const openFindings = auditFindings.filter((f) => !f.classification.includes('Closed'));
  const overdue = auditFindings.filter((f) => f.daysLeft < 0).length;

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
      <div className="grid gap-2 p-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiTile
          label={t('qhse.audits_12mo')}
          value={audits.length}
          sub={`${audits.filter((a) => a.kind === 'External').length} ext · ${audits.filter((a) => a.kind === 'Internal').length} int`}
        />
        <KpiTile
          label={t('qhse.open_sms_findings')}
          value={openFindings.length}
          sub={`${openFindings.filter((f) => f.classification.includes('NC')).length} ${t('qhse.nc')} ${openFindings.filter((f) => f.classification === 'OFI').length} ${t('qhse.ofi')}`}
          {...(openFindings.length > 0 ? { accent: 'var(--sig-amber)' } : {})}
        />
        <KpiTile
          label={t('qhse.overdue_closeouts')}
          value={overdue}
          sub=""
          {...(overdue > 0 ? { accent: 'var(--sig-red)' } : {})}
        />
        <KpiTile label={t('qhse.avg_closeout')} value="—" sub={t('qhse.target_60d')} />
      </div>

      {/* Schedule */}
      <div className="px-4 pb-4">
        <div
          className="rounded-2 overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surface-sunk)' }}
          >
            <span className="text-[12px] font-semibold">{t('qhse.audit_schedule')}</span>
            <span
              className="text-[10.5px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--ink-3)' }}
            >
              {t('qhse.last_6_next_6')}
            </span>
            <div className="flex-1" />
            <button
              onClick={onAddAudit}
              className="px-2 py-0.5 rounded-1 text-[11px]"
              style={{
                background: 'var(--navy)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('qhse.schedule_audit')}
            </button>
          </div>
          <div
            className="grid gap-2 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest"
            style={{
              gridTemplateColumns: '90px 100px 1fr 180px 110px 130px 80px',
              background: 'var(--surface-sunk)',
              color: 'var(--ink-3)',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <span>{t('qhse.col_id')}</span>
            <span>{t('qhse.col_kind')}</span>
            <span>{t('qhse.col_scope')}</span>
            <span>{t('qhse.col_auditor')}</span>
            <span>{t('qhse.col_when')}</span>
            <span>{t('qhse.col_findings')}</span>
            <span />
          </div>
          {audits.length === 0 ? (
            <EmptyState msg={t('qhse.no_audits')} />
          ) : (
            audits.map((a) => (
              <div
                key={a.id}
                onClick={() => onEditAudit(a.id)}
                className="grid gap-2 px-4 py-2.5 items-center"
                style={{
                  gridTemplateColumns: '90px 100px 1fr 180px 110px 130px 80px',
                  borderTop: '1px solid var(--hairline)',
                  cursor: 'pointer',
                }}
              >
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {a.id}
                </span>
                <Badge
                  color={a.kind === 'External' ? 'slate' : a.kind === 'Vetting' ? 'purple' : 'blue'}
                >
                  {a.kind.toUpperCase()}
                </Badge>
                <span className="text-[12.5px] font-medium truncate">{a.scope}</span>
                <span className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                  {a.auditor}
                </span>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: a.tone === 'red' ? 'var(--sig-red)' : 'var(--ink-2)' }}
                >
                  {a.scheduledAt}
                </span>
                <span className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                  {a.findings}
                </span>
                <Badge color={toneColor(a.tone)}>
                  {a.status === 'overdue'
                    ? `−${-a.daysOut}d`
                    : a.status === 'closed'
                      ? 'CLOSED'
                      : `IN ${a.daysOut}d`}
                </Badge>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Open findings */}
      {auditFindings.length > 0 && (
        <div className="px-4 pb-4">
          <div
            className="rounded-2 overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center gap-3 px-4 py-2.5 text-[12px] font-semibold"
              style={{
                borderBottom: '1px solid var(--hairline)',
                background: 'var(--surface-sunk)',
              }}
            >
              <span>{t('qhse.open_sms_findings')}</span>
              <div className="flex-1" />
              <button
                onClick={canAddFinding ? onAddFinding : undefined}
                disabled={!canAddFinding}
                className="px-2 py-0.5 rounded-1 text-[11px]"
                style={{
                  background: canAddFinding ? 'var(--navy)' : 'var(--surface-2)',
                  color: canAddFinding ? '#fff' : 'var(--ink-3)',
                  border: 'none',
                  cursor: canAddFinding ? 'pointer' : 'not-allowed',
                }}
                title={canAddFinding ? undefined : 'Select a vessel first'}
              >
                + Raise finding
              </button>
            </div>
            <div
              className="grid gap-2 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest"
              style={{
                gridTemplateColumns: '90px 100px 110px 1fr 150px 100px 70px',
                background: 'var(--surface-sunk)',
                color: 'var(--ink-3)',
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              <span>{t('qhse.col_id')}</span>
              <span>{t('qhse.col_class')}</span>
              <span>{t('qhse.col_from')}</span>
              <span>{t('qhse.col_finding_ref')}</span>
              <span>{t('qhse.col_owner_due')}</span>
              <span>{t('qhse.col_days_left')}</span>
              <span />
            </div>
            {auditFindings.map((f) => (
              <div
                key={f.id}
                className="grid gap-2 px-4 py-2.5 items-center"
                style={{
                  gridTemplateColumns: '90px 100px 110px 1fr 150px 100px 70px',
                  borderTop: '1px solid var(--hairline)',
                }}
              >
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {f.id}
                </span>
                <Badge
                  color={
                    f.classification.includes('Major')
                      ? 'red'
                      : f.classification === 'NC'
                        ? 'amber'
                        : 'blue'
                  }
                >
                  {f.classification.toUpperCase()}
                </Badge>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: 'var(--sig-blue)', fontWeight: 500 }}
                >
                  {f.auditRef}
                </span>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{f.title}</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                    {f.smsRef}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                    {f.owner}
                  </div>
                  <div className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                    {f.dueAt}
                  </div>
                </div>
                <Badge color={f.daysLeft < 0 ? 'red' : f.daysLeft < 14 ? 'amber' : 'green'}>
                  {f.daysLeft < 0 ? `${-f.daysLeft}d LATE` : `${f.daysLeft}d`}
                </Badge>
                <button
                  className="text-[11px] px-2 py-0.5 rounded-1 border"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer',
                    color: 'var(--ink-2)',
                  }}
                  onClick={() => onEditFinding(f.id)}
                >
                  {t('common.edit')}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Environmental tab ────────────────────────────────────────────────────────

function CIIBands({ current }: { current: number | null }) {
  const minVal = 3.0;
  const maxVal = 6.5;
  const bands = [
    { letter: 'A', max: 3.78, color: 'var(--sig-green)' },
    { letter: 'B', max: 4.16, color: 'var(--sig-green)' },
    { letter: 'C', max: 4.6, color: 'var(--sig-amber)' },
    { letter: 'D', max: 5.06, color: 'var(--sig-amber)' },
    { letter: 'E', max: 6.5, color: 'var(--sig-red)' },
  ];
  const pos = current !== null ? ((current - minVal) / (maxVal - minVal)) * 100 : null;
  return (
    <div className="px-4 pb-4 pt-2">
      <div className="relative" style={{ height: 38 }}>
        <div className="flex h-6 rounded-1 overflow-hidden">
          {bands.map((b, i) => {
            const prev = i === 0 ? minVal : bands[i - 1]!.max;
            const w = ((b.max - prev) / (maxVal - minVal)) * 100;
            return (
              <div
                key={b.letter}
                style={{
                  width: `${w}%`,
                  background: b.color,
                  opacity: 0.8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: 12,
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {b.letter}
              </div>
            );
          })}
        </div>
        {pos !== null && (
          <div
            className="absolute top-0 bottom-0 flex flex-col items-center"
            style={{ left: `${pos}%`, transform: 'translateX(-50%)' }}
          >
            <span className="font-mono text-[10px] font-semibold" style={{ color: 'var(--ink)' }}>
              {current?.toFixed(2)}
            </span>
            <span
              style={{
                width: 0,
                height: 0,
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '8px solid var(--ink)',
              }}
            />
          </div>
        )}
      </div>
      <div
        className="flex justify-between font-mono text-[10px] mt-4"
        style={{ color: 'var(--ink-3)' }}
      >
        <span>3.00 required</span>
        <span>4.50 target</span>
        <span>6.50 penalty</span>
      </div>
    </div>
  );
}

function EnvironmentalTab({
  legs,
  discharges,
  loading,
  onAddLeg,
  onAddDischarge,
  onEditLeg,
  onEditDischarge,
  canAdd,
}: {
  legs: VoyageLeg[];
  discharges: DischargeLog[];
  loading: boolean;
  onAddLeg: () => void;
  onAddDischarge: () => void;
  onEditLeg: (id: string) => void;
  onEditDischarge: (id: string) => void;
  canAdd: boolean;
}) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const totalFuel = legs.reduce((a, l) => a + l.fuelTonnes, 0);
  const totalCO2 = legs.reduce((a, l) => a + l.co2Tonnes, 0);
  const totalNm = legs.reduce((a, l) => a + l.nm, 0);

  const addBtnStyle = (enabled: boolean): React.CSSProperties => ({
    background: enabled ? 'var(--navy)' : 'var(--surface-2)',
    color: enabled ? '#fff' : 'var(--ink-3)',
    border: 'none',
    cursor: enabled ? 'pointer' : 'not-allowed',
  });

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
      >
        <span
          className="text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--ink-3)' }}
        >
          Environmental log
        </span>
        <div className="flex-1" />
        <button
          onClick={canAdd ? onAddLeg : undefined}
          disabled={!canAdd}
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={addBtnStyle(canAdd)}
          title={canAdd ? undefined : 'Select a vessel first'}
        >
          + Voyage leg
        </button>
        <button
          onClick={canAdd ? onAddDischarge : undefined}
          disabled={!canAdd}
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={addBtnStyle(canAdd)}
          title={canAdd ? undefined : 'Select a vessel first'}
        >
          + Discharge
        </button>
      </div>
      <div
        className="grid gap-2 p-4"
        style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}
      >
        <KpiTile
          label={t('qhse.cii_rating')}
          value="—"
          sub={t('qhse.configure_reporting')}
          accent="var(--sig-amber)"
        />
        <KpiTile
          label={`${t('qhse.fuel')} ${legs.length} ${t('qhse.legs')}`}
          value={totalFuel > 0 ? `${totalFuel.toFixed(0)} t` : '—'}
          sub={
            totalNm > 0
              ? `${((totalFuel / totalNm) * 1000).toFixed(1)} kg/nm`
              : t('qhse.no_voyages')
          }
        />
        <KpiTile
          label={t('qhse.co2_ytd')}
          value={totalCO2 > 0 ? `${(totalCO2 / 1000).toFixed(1)} kt` : '—'}
          sub={t('qhse.vs_cii_baseline')}
        />
        <KpiTile
          label={t('qhse.discharge_logs')}
          value={discharges.length}
          sub={t('qhse.last_30_days')}
        />
        <KpiTile
          label={t('qhse.col_distance')}
          value={totalNm > 0 ? `${(totalNm / 1000).toFixed(1)} k nm` : '—'}
          sub={`${legs.reduce((a, l) => a + l.hours, 0)} ${t('qhse.col_h_underway')}`}
        />
      </div>

      <div className="px-4 pb-4">
        <div
          className="rounded-2 overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surface-sunk)' }}
          >
            <span className="text-[12px] font-semibold">{t('qhse.cii_annual_ratio')}</span>
            <div className="flex-1" />
            <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
              {t('qhse.cii_mepc')}
            </span>
          </div>
          <CIIBands current={null} />
        </div>
      </div>

      <div className="px-4 pb-4">
        <div
          className="rounded-2 overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div
            className="px-4 py-2.5 text-[12px] font-semibold"
            style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surface-sunk)' }}
          >
            {t('qhse.voyage_emissions')}
          </div>
          <div
            className="grid gap-2 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest"
            style={{
              gridTemplateColumns: '80px minmax(80px, 1fr) 150px 50px 55px 60px 50px 50px',
              background: 'var(--surface-sunk)',
              color: 'var(--ink-3)',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <span>{t('qhse.col_leg')}</span>
            <span>{t('qhse.col_route')}</span>
            <span>{t('qhse.col_dates')}</span>
            <span>{t('qhse.col_nm')}</span>
            <span>{t('qhse.col_fuel_t')}</span>
            <span>{t('qhse.col_co2_t')}</span>
            <span>{t('qhse.col_sox')}</span>
            <span>{t('qhse.col_nox')}</span>
          </div>
          {legs.length === 0 ? (
            <EmptyState msg="No voyage legs recorded. Log fuel consumption data to generate IMO DCS and EU MRV reports." />
          ) : (
            legs.map((l) => (
              <div
                key={l.id}
                onClick={() => onEditLeg(l.id)}
                className="grid gap-2 px-4 py-2.5 items-center"
                style={{
                  gridTemplateColumns: '80px minmax(80px, 1fr) 150px 50px 55px 60px 50px 50px',
                  borderTop: '1px solid var(--hairline)',
                  cursor: 'pointer',
                }}
              >
                <div className="min-w-0">
                  <div
                    className="font-mono text-[11px] truncate"
                    style={{ color: 'var(--ink-2)' }}
                  >
                    {l.id.slice(0, 8)}
                  </div>
                  <Badge color="slate">{l.mode.toUpperCase()}</Badge>
                </div>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{l.route}</div>
                  <div
                    className="text-[10.5px] truncate"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {l.cargo}
                  </div>
                </div>
                <div
                  className="font-mono text-[10.5px] min-w-0"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {l.departureAt.slice(0, 10)} → {l.arrivalAt.slice(0, 10)}
                </div>
                <span className="font-mono text-[11.5px]">{l.nm.toLocaleString()}</span>
                <span className="font-mono text-[11.5px]">{l.fuelTonnes.toFixed(1)}</span>
                <span className="font-mono text-[11.5px]">{l.co2Tonnes.toLocaleString()}</span>
                <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                  {l.soxTonnes.toFixed(1)}
                </span>
                <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                  {l.noxTonnes.toFixed(1)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {discharges.length > 0 && (
        <div className="px-4 pb-4">
          <div
            className="rounded-2 overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                borderBottom: '1px solid var(--hairline)',
                background: 'var(--surface-sunk)',
              }}
            >
              <span className="text-[12px] font-semibold">{t('qhse.marpol_log')}</span>
              <div className="flex-1" />
              <button
                className="text-[11px] px-2 py-0.5 rounded-1 border"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  cursor: 'pointer',
                  color: 'var(--ink-2)',
                }}
              >
                {t('qhse.open_record_books')}
              </button>
            </div>
            <div
              className="grid gap-2 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest"
              style={{
                gridTemplateColumns: '90px 110px 150px 1fr 80px 90px',
                background: 'var(--surface-sunk)',
                color: 'var(--ink-3)',
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              <span>{t('qhse.col_id')}</span>
              <span>{t('qhse.col_kind')}</span>
              <span>{t('common.date')}</span>
              <span>{t('common.notes')}</span>
              <span>{t('qhse.col_volume')}</span>
              <span />
            </div>
            {discharges.map((d) => (
              <div
                key={d.id}
                onClick={() => onEditDischarge(d.id)}
                className="grid gap-2 px-4 py-2.5 items-center"
                style={{
                  gridTemplateColumns: '90px 110px 150px 1fr 80px 90px',
                  borderTop: '1px solid var(--hairline)',
                  cursor: 'pointer',
                }}
              >
                <span
                  className="font-mono text-[11px] truncate"
                  style={{ color: 'var(--ink-2)' }}
                >
                  {d.id.slice(0, 8)}
                </span>
                <Badge
                  color={
                    d.kind === 'oily-water'
                      ? 'amber'
                      : d.kind === 'ballast'
                        ? 'blue'
                        : d.kind === 'garbage'
                          ? 'green'
                          : 'purple'
                  }
                >
                  {d.kind.toUpperCase()}
                </Badge>
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {d.when.slice(0, 10)}
                </span>
                <span className="text-[11.5px] truncate" style={{ color: 'var(--ink-3)' }}>
                  {d.notes}
                </span>
                <span className="font-mono text-[11.5px] font-medium">{d.volume}</span>
                <Badge color={d.compliant ? 'green' : 'red'}>
                  {d.compliant ? 'COMPLIANT' : 'NON-COMPL'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DryBMS tab ───────────────────────────────────────────────────────────────

function DryBmsTab({
  elements,
  loading,
  onAdd,
  onEdit,
}: {
  elements: DryBmsElement[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (id: string) => void;
}) {
  const { t } = useTranslation();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const sel = elements.find((e) => e.id === selectedId) ?? null;

  // Group by chapter
  const chapters: Record<string, DryBmsElement[]> = {};
  elements.forEach((e) => {
    (chapters[`${e.chapter}|${e.chapterTitle}`] ??= []).push(e);
  });

  const avg = elements.length
    ? (elements.reduce((a, e) => a + e.score, 0) / elements.length).toFixed(2)
    : '—';
  const atTarget = elements.filter((e) => e.score >= e.target).length;

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
      >
        <span
          className="text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--ink-3)' }}
        >
          DryBMS maturity
        </span>
        <div className="flex-1" />
        <button
          onClick={onAdd}
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          + Element
        </button>
      </div>
      <div className="grid gap-2 p-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiTile
          label={t('qhse.avg_maturity')}
          value={avg}
          sub={`${t('qhse.of_4')} ${elements.length} ${t('qhse.elements')}`}
          accent="var(--navy)"
        />
        <KpiTile
          label={t('qhse.at_above_target')}
          value={elements.length ? `${atTarget}/${elements.length}` : '—'}
          sub={elements.length ? `${Math.round((atTarget / elements.length) * 100)}%` : ''}
          accent="var(--sig-green)"
        />
        <KpiTile
          label={t('qhse.below_target')}
          value={elements.length ? elements.length - atTarget : '—'}
          sub={t('qhse.remediation_plan')}
          {...(elements.length && elements.length - atTarget > 0
            ? { accent: 'var(--sig-amber)' }
            : {})}
        />
        <KpiTile label={t('qhse.last_assessed')} value="—" sub="RightShip / DPA" />
      </div>

      {elements.length === 0 ? (
        <EmptyState msg="No DryBMS self-assessment data. Complete the 30-element assessment to track maturity levels." />
      ) : (
        <div className="px-4 pb-4">
          <div
            className="rounded-2 overflow-hidden"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="flex items-center gap-3 px-4 py-2.5"
              style={{
                borderBottom: '1px solid var(--hairline)',
                background: 'var(--surface-sunk)',
              }}
            >
              <span className="text-[12px] font-semibold">{t('qhse.drybms_self_assessment')}</span>
              <div className="flex-1" />
              {[1, 2, 3, 4].map((s) => (
                <span
                  key={s}
                  className="flex items-center gap-1 text-[10.5px]"
                  style={{ color: 'var(--ink-3)' }}
                >
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: 2,
                      background: stageMeta[s]!.tone,
                    }}
                  />
                  <span className="font-mono">{s}</span>
                </span>
              ))}
            </div>
            <div className="p-4 flex flex-col gap-3">
              {Object.entries(chapters).map(([chKey, items]) => {
                const [ch, chTitle] = chKey.split('|');
                return (
                  <div
                    key={chKey}
                    className="grid items-center gap-3"
                    style={{
                      gridTemplateColumns: '240px 1fr',
                      padding: '8px 0',
                      borderTop: '1px solid var(--hairline)',
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="font-mono text-[11px] font-semibold flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-1"
                        style={{ background: 'var(--navy)', color: '#fff' }}
                      >
                        {ch}
                      </span>
                      <span className="text-[12.5px] font-medium">{chTitle}</span>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {items.map((e) => {
                        const m = stageMeta[e.score] ?? stageMeta[1]!;
                        const isBelow = e.score < e.target;
                        const isSel = e.id === selectedId;
                        return (
                          <button
                            key={e.id}
                            onClick={() => setSelectedId(isSel ? null : e.id)}
                            style={{
                              width: 120,
                              padding: '6px 8px',
                              background: m.bg,
                              border: `${isSel ? 2 : 1}px solid ${isSel ? 'var(--ink)' : m.tone}33`,
                              borderRadius: 5,
                              cursor: 'pointer',
                              textAlign: 'left',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              position: 'relative',
                            }}
                          >
                            <span
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: 3,
                                background: m.tone,
                                color: '#fff',
                                fontSize: 10,
                                fontWeight: 600,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                              }}
                            >
                              {e.score}
                            </span>
                            <div className="min-w-0 flex-1">
                              <div
                                className="font-mono text-[9px]"
                                style={{ color: 'var(--ink-3)' }}
                              >
                                {e.id}
                              </div>
                              <div
                                className="text-[10.5px] font-medium"
                                style={{
                                  lineHeight: 1.2,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {e.name}
                              </div>
                            </div>
                            {isBelow && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: -4,
                                  right: -4,
                                  width: 12,
                                  height: 12,
                                  borderRadius: '50%',
                                  background: 'var(--sig-amber)',
                                  border: '1.5px solid var(--surface)',
                                  color: '#fff',
                                  fontSize: 8,
                                  fontWeight: 700,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                ↓
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Element drilldown */}
          {sel && (
            <div
              className="mt-3 rounded-2 overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="flex items-center gap-3 px-4 py-2.5"
                style={{
                  borderBottom: '1px solid var(--hairline)',
                  background: 'var(--surface-sunk)',
                }}
              >
                <span className="text-[12px] font-semibold">{sel.name}</span>
                <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                  {sel.id}
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => onEdit(sel.id)}
                  className="px-2 py-1 rounded-1 text-[11px]"
                  style={{
                    background: 'var(--navy)',
                    color: '#fff',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  {t('qhse.update_score')}
                </button>
              </div>
              <div className="grid gap-2 p-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                {[1, 2, 3, 4].map((s) => {
                  const m = stageMeta[s]!;
                  const isCurrent = sel.score === s;
                  const isTarget = sel.target === s;
                  return (
                    <div
                      key={s}
                      style={{
                        padding: '12px',
                        background: isCurrent ? m.bg : 'var(--surface-2)',
                        border: `${isCurrent ? 2 : 1}px solid ${isCurrent ? m.tone : 'var(--border)'}`,
                        borderRadius: 6,
                        position: 'relative',
                      }}
                    >
                      {isTarget && (
                        <span
                          style={{
                            position: 'absolute',
                            top: -8,
                            right: 8,
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: 'var(--ink)',
                            color: '#fff',
                            fontSize: 9,
                            fontWeight: 600,
                            letterSpacing: '0.04em',
                          }}
                        >
                          {t('qhse.target')}
                        </span>
                      )}
                      <div className="flex items-center gap-2 mb-1.5">
                        <span
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            background: m.tone,
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 600,
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}
                        >
                          {s}
                        </span>
                        <span className="text-[12px] font-semibold">{t(m.labelKey)}</span>
                      </div>
                      {isCurrent && sel.evidence && (
                        <div
                          className="text-[10.5px]"
                          style={{
                            color: 'var(--ink-2)',
                            paddingTop: 6,
                            borderTop: `1px solid ${m.tone}33`,
                            marginTop: 6,
                          }}
                        >
                          <span
                            className="text-[9px] font-semibold uppercase tracking-widest block mb-1"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {t('qhse.evidence')}
                          </span>
                          {sel.evidence}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Management review tab ────────────────────────────────────────────────────

function MgmtReviewTab({
  reviews,
  loading,
  onAdd,
  onEdit,
}: {
  reviews: ManagementReview[];
  loading: boolean;
  onAdd: () => void;
  onEdit: (id: string) => void;
}) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const upcoming = reviews.filter((r) => r.status === 'scheduled');
  const past = reviews.filter((r) => r.status === 'closed');

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
      <div
        className="flex items-center gap-3 px-4 py-2.5"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
      >
        <span
          className="text-[10.5px] font-semibold uppercase tracking-widest flex-1"
          style={{ color: 'var(--ink-3)' }}
        >
          {t('qhse.management_reviews')}
        </span>
        <button
          onClick={onAdd}
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {t('qhse.schedule_review')}
        </button>
      </div>

      {reviews.length === 0 ? (
        <EmptyState msg="No management reviews on file. Annual company reviews and master's monthly reviews will appear here." />
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="p-4 pb-2">
              <div
                className="text-[10.5px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--ink-3)' }}
              >
                {t('qhse.upcoming')}
              </div>
              <div className="flex flex-col gap-2">
                {upcoming.map((r) => (
                  <ReviewCard key={r.id} r={r} onEdit={onEdit} />
                ))}
              </div>
            </div>
          )}
          {past.length > 0 && (
            <div className="px-4 pb-4 pt-2">
              <div
                className="text-[10.5px] font-semibold uppercase tracking-widest mb-2"
                style={{ color: 'var(--ink-3)' }}
              >
                {t('qhse.recent')}
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(2, 1fr)' }}>
                {past.map((r) => (
                  <ReviewCard key={r.id} r={r} onEdit={onEdit} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReviewCard({ r, onEdit }: { r: ManagementReview; onEdit: (id: string) => void }) {
  const { t } = useTranslation();
  const borderColor =
    r.tone === 'red'
      ? 'var(--sig-red)'
      : r.tone === 'amber'
        ? 'var(--sig-amber)'
        : r.tone === 'navy'
          ? 'var(--navy)'
          : 'var(--sig-green)';
  return (
    <div
      className="rounded-2 overflow-hidden"
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderLeft: `3px solid ${borderColor}`,
      }}
    >
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--hairline)' }}
      >
        <span className="font-mono text-[11px] font-medium" style={{ color: 'var(--ink-2)' }}>
          {r.id}
        </span>
        <Badge color="slate">{(r.kind.split('(')[0] ?? r.kind).trim().toUpperCase()}</Badge>
        <div className="flex-1" />
        <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
          {r.scheduledAt}
        </span>
        <Badge color={r.status === 'scheduled' ? 'blue' : 'green'}>{r.status.toUpperCase()}</Badge>
      </div>
      <div className="px-4 py-3">
        <div className="grid gap-2 text-[11px] mb-2" style={{ gridTemplateColumns: '1fr 1fr' }}>
          <div>
            <span
              className="text-[9px] font-semibold uppercase tracking-widest block"
              style={{ color: 'var(--ink-3)' }}
            >
              {t('qhse.chair')}
            </span>
            <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink)' }}>
              {r.chair}
            </div>
          </div>
          <div>
            <span
              className="text-[9px] font-semibold uppercase tracking-widest block"
              style={{ color: 'var(--ink-3)' }}
            >
              {t('qhse.actions')}
            </span>
            <div className="text-[12px] mt-0.5" style={{ color: 'var(--ink)' }}>
              {r.actionsDone}/{r.actionsTotal} {t('qhse.actions_done')}
            </div>
          </div>
        </div>
        <div className="text-[12px]" style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}>
          {r.summary}
        </div>
      </div>
      <div
        className="flex items-center justify-between px-4 py-2"
        style={{ borderTop: '1px solid var(--hairline)', background: 'var(--surface-2)' }}
      >
        <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
          {typeof r.attendees === 'number'
            ? `${r.attendees} ${t('qhse.attendees')}`
            : t('qhse.invitations_pending')}
        </span>
        <button
          onClick={() => onEdit(r.id)}
          className="text-[11px] px-2 py-0.5 rounded-1 border"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            cursor: 'pointer',
            color: 'var(--ink-2)',
          }}
        >
          {t('common.edit')}
        </button>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function QHSEPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'obj';
  const setTab = (tabId: Tab) => setParams(tabId === 'obj' ? {} : { tab: tabId });

  const [objectives, setObjectives] = useState<QhseObjective[]>([]);
  const [rawObjectives, setRawObjectives] = useState<RawQhseObjective[]>([]);
  const [audits, setAudits] = useState<Audit[]>([]);
  const [rawAudits, setRawAudits] = useState<RawAudit[]>([]);
  const [auditFindings, setAuditFindings] = useState<AuditFinding[]>([]);
  const [rawAuditFindings, setRawAuditFindings] = useState<RawAuditFinding[]>([]);
  const [legs, setLegs] = useState<VoyageLeg[]>([]);
  const [rawLegs, setRawLegs] = useState<RawVoyageLeg[]>([]);
  const [discharges, setDischarges] = useState<DischargeLog[]>([]);
  const [rawDischarges, setRawDischarges] = useState<RawDischargeLog[]>([]);
  const [elements, setElements] = useState<DryBmsElement[]>([]);
  const [rawElements, setRawElements] = useState<RawDrybmsElement[]>([]);
  const [reviews, setReviews] = useState<ManagementReview[]>([]);
  const [rawReviews, setRawReviews] = useState<RawManagementReview[]>([]);
  const [loadO, setLoadO] = useState(true);
  const [loadA, setLoadA] = useState(true);
  const [loadE, setLoadE] = useState(true);
  const [loadD, setLoadD] = useState(true);
  const [loadR, setLoadR] = useState(true);

  const { selectedVesselId } = useVessel();
  const canAddVessel = Boolean(selectedVesselId);
  const [addObjective, setAddObjective] = useState(false);
  const [addAudit, setAddAudit] = useState(false);
  const [addFinding, setAddFinding] = useState(false);
  const [addLeg, setAddLeg] = useState(false);
  const [addDischarge, setAddDischarge] = useState(false);
  const [addElement, setAddElement] = useState(false);
  const [addReview, setAddReview] = useState(false);
  const [editObjectiveId, setEditObjectiveId] = useState<string | null>(null);
  const [editAuditId, setEditAuditId] = useState<string | null>(null);
  const [editFindingId, setEditFindingId] = useState<string | null>(null);
  const [editLegId, setEditLegId] = useState<string | null>(null);
  const [editDischargeId, setEditDischargeId] = useState<string | null>(null);
  const [editElementId, setEditElementId] = useState<string | null>(null);
  const [editReviewId, setEditReviewId] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    api
      .get<RawQhseObjective[]>('/qhse-objectives')
      .then((raw) => {
        setRawObjectives(raw);
        setObjectives(normalizeQhseObjectives(raw));
      })
      .catch(() => {
        setRawObjectives([]);
        setObjectives([]);
      })
      .finally(() => setLoadO(false));
    Promise.all([
      api.get<RawAudit[]>('/audits').catch(() => [] as RawAudit[]),
      api.get<RawAuditFinding[]>('/audit-findings').catch(() => [] as RawAuditFinding[]),
    ])
      .then(([a, f]) => {
        setRawAudits(a);
        setAudits(normalizeAudits(a));
        setRawAuditFindings(f);
        setAuditFindings(normalizeAuditFindings(f));
      })
      .finally(() => setLoadA(false));
    Promise.all([
      api.get<RawVoyageLeg[]>('/voyage-legs').catch(() => [] as RawVoyageLeg[]),
      api.get<RawDischargeLog[]>('/discharge-logs').catch(() => [] as RawDischargeLog[]),
    ])
      .then(([l, d]) => {
        setRawLegs(l);
        setLegs(normalizeVoyageLegs(l));
        setRawDischarges(d);
        setDischarges(normalizeDischargeLogs(d));
      })
      .finally(() => setLoadE(false));
    api
      .get<RawDrybmsElement[]>('/drybms-elements')
      .then((raw) => {
        setRawElements(raw);
        setElements(normalizeDrybms(raw));
      })
      .catch(() => {
        setRawElements([]);
        setElements([]);
      })
      .finally(() => setLoadD(false));
    api
      .get<RawManagementReview[]>('/management-reviews')
      .then((raw) => {
        setRawReviews(raw);
        setReviews(normalizeManagementReviews(raw));
      })
      .catch(() => {
        setRawReviews([]);
        setReviews([]);
      })
      .finally(() => setLoadR(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const offTarget = objectives.filter((o) => o.status !== 'green').length;
  const openFindings = auditFindings.filter((f) => !f.classification.includes('Closed')).length;
  const belowTarget = elements.filter((e) => e.score < e.target).length;
  const upcomingReviews = reviews.filter((r) => r.status === 'scheduled').length;

  const counts: Record<Tab, number> = {
    obj: objectives.length,
    audit: openFindings,
    env: discharges.length,
    dryb: belowTarget,
    review: upcomingReviews,
  };

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
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <h1
          className="text-[16px] font-semibold m-0"
          style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
        >
          {t('qhse.title')}
        </h1>
        <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
          ISM + DryBMS + ISO 14001
        </span>
        {offTarget > 0 && (
          <Badge color="amber">
            {offTarget} {t('qhse.attention').toUpperCase()}
          </Badge>
        )}
        <div className="flex-1" />
        <button
          className="px-3 py-1 rounded-2 text-[12px] font-medium border"
          style={{
            background: 'var(--surface)',
            borderColor: 'var(--border)',
            cursor: 'pointer',
            color: 'var(--ink)',
          }}
        >
          SMS manual
        </button>
        <button
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {t('qhse.log_audit')}
        </button>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-0 flex-shrink-0 px-4 overflow-x-auto"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        {(
          [
            { id: 'obj', label: t('qhse.tab_objectives') },
            { id: 'audit', label: t('qhse.tab_audits') },
            { id: 'env', label: t('qhse.tab_environmental') },
            { id: 'dryb', label: t('qhse.tab_drybms') },
            { id: 'review', label: t('qhse.tab_management_review') },
          ] as { id: Tab; label: string }[]
        ).map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: `2px solid ${tab === tabItem.id ? 'var(--navy)' : 'transparent'}`,
              cursor: 'pointer',
              color: tab === tabItem.id ? 'var(--ink)' : 'var(--ink-2)',
              fontSize: 13,
              fontWeight: tab === tabItem.id ? 600 : 500,
              marginBottom: -1,
              whiteSpace: 'nowrap',
            }}
          >
            <span>{tabItem.label}</span>
            <span
              className="font-mono text-[10.5px] px-1.5 py-px rounded-[10px]"
              style={{
                background: tab === tabItem.id ? 'var(--navy)' : 'var(--surface-2)',
                color: tab === tabItem.id ? '#fff' : 'var(--ink-3)',
              }}
            >
              {counts[tabItem.id]}
            </span>
          </button>
        ))}
      </div>

      {tab === 'obj' && (
        <ObjectivesTab
          objectives={objectives}
          loading={loadO}
          onAdd={() => setAddObjective(true)}
          onEdit={(id) => setEditObjectiveId(id)}
        />
      )}
      {tab === 'audit' && (
        <AuditsTab
          audits={audits}
          auditFindings={auditFindings}
          loading={loadA}
          onAddAudit={() => setAddAudit(true)}
          onAddFinding={() => setAddFinding(true)}
          onEditAudit={(id) => setEditAuditId(id)}
          onEditFinding={(id) => setEditFindingId(id)}
          canAddFinding={canAddVessel}
        />
      )}
      {tab === 'env' && (
        <EnvironmentalTab
          legs={legs}
          discharges={discharges}
          loading={loadE}
          onAddLeg={() => setAddLeg(true)}
          onAddDischarge={() => setAddDischarge(true)}
          onEditLeg={(id) => setEditLegId(id)}
          onEditDischarge={(id) => setEditDischargeId(id)}
          canAdd={canAddVessel}
        />
      )}
      {tab === 'dryb' && (
        <DryBmsTab
          elements={elements}
          loading={loadD}
          onAdd={() => setAddElement(true)}
          onEdit={(id) => setEditElementId(id)}
        />
      )}
      {tab === 'review' && (
        <MgmtReviewTab
          reviews={reviews}
          loading={loadR}
          onAdd={() => setAddReview(true)}
          onEdit={(id) => setEditReviewId(id)}
        />
      )}

      <CreateQhseObjectiveModal
        open={addObjective}
        onClose={() => setAddObjective(false)}
        onCreated={() => {
          setAddObjective(false);
          fetchAll();
        }}
      />
      <CreateAuditModal
        open={addAudit}
        vesselId={selectedVesselId}
        onClose={() => setAddAudit(false)}
        onCreated={() => {
          setAddAudit(false);
          fetchAll();
        }}
      />
      <CreateDrybmsElementModal
        open={addElement}
        onClose={() => setAddElement(false)}
        onCreated={() => {
          setAddElement(false);
          fetchAll();
        }}
      />
      <CreateManagementReviewModal
        open={addReview}
        onClose={() => setAddReview(false)}
        onCreated={() => {
          setAddReview(false);
          fetchAll();
        }}
      />
      {selectedVesselId && (
        <>
          <CreateAuditFindingModal
            open={addFinding}
            vesselId={selectedVesselId}
            onClose={() => setAddFinding(false)}
            onCreated={() => {
              setAddFinding(false);
              fetchAll();
            }}
          />
          <CreateVoyageLegModal
            open={addLeg}
            vesselId={selectedVesselId}
            onClose={() => setAddLeg(false)}
            onCreated={() => {
              setAddLeg(false);
              fetchAll();
            }}
          />
          <CreateDischargeLogModal
            open={addDischarge}
            vesselId={selectedVesselId}
            onClose={() => setAddDischarge(false)}
            onCreated={() => {
              setAddDischarge(false);
              fetchAll();
            }}
          />
        </>
      )}
      {(() => {
        const obj = rawObjectives.find((r) => r.id === editObjectiveId);
        if (!obj) return null;
        return (
          <EditQhseObjectiveModal
            objective={obj}
            onClose={() => setEditObjectiveId(null)}
            onSaved={() => {
              setEditObjectiveId(null);
              fetchAll();
            }}
          />
        );
      })()}
      {(() => {
        const a = rawAudits.find((r) => r.id === editAuditId);
        if (!a) return null;
        return (
          <EditAuditModal
            audit={a}
            onClose={() => setEditAuditId(null)}
            onSaved={() => {
              setEditAuditId(null);
              fetchAll();
            }}
          />
        );
      })()}
      {(() => {
        const f = rawAuditFindings.find((r) => r.id === editFindingId);
        if (!f) return null;
        return (
          <EditAuditFindingModal
            finding={f}
            onClose={() => setEditFindingId(null)}
            onSaved={() => {
              setEditFindingId(null);
              fetchAll();
            }}
          />
        );
      })()}
      {(() => {
        const l = rawLegs.find((r) => r.id === editLegId);
        if (!l) return null;
        return (
          <EditVoyageLegModal
            leg={l}
            onClose={() => setEditLegId(null)}
            onSaved={() => {
              setEditLegId(null);
              fetchAll();
            }}
          />
        );
      })()}
      {(() => {
        const d = rawDischarges.find((r) => r.id === editDischargeId);
        if (!d) return null;
        return (
          <EditDischargeLogModal
            discharge={d}
            onClose={() => setEditDischargeId(null)}
            onSaved={() => {
              setEditDischargeId(null);
              fetchAll();
            }}
          />
        );
      })()}
      {(() => {
        const e = rawElements.find((r) => r.id === editElementId);
        if (!e) return null;
        return (
          <EditDrybmsElementModal
            element={e}
            onClose={() => setEditElementId(null)}
            onSaved={() => {
              setEditElementId(null);
              fetchAll();
            }}
          />
        );
      })()}
      {(() => {
        const r = rawReviews.find((x) => x.id === editReviewId);
        if (!r) return null;
        return (
          <EditManagementReviewModal
            review={r}
            onClose={() => setEditReviewId(null)}
            onSaved={() => {
              setEditReviewId(null);
              fetchAll();
            }}
          />
        );
      })()}
    </div>
  );
}
