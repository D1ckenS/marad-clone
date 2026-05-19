import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Badge, type BadgeColor, Select, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type CertCat = 'statutory' | 'class' | 'mlc' | 'ism' | 'isps' | 'marpol' | 'insurance' | 'flag';

interface Certificate {
  id: string;
  category: CertCat;
  title: string;
  acronym: string;
  authority: string;
  cycle: string;
  issuedAt: string;
  expiresAt: string | null;
  nextSurvey: string | null;
  daysLeft: number;
  status: 'green' | 'amber' | 'red';
  documentKey: string | null;
}

interface Survey {
  id: string;
  scheduledAt: string;
  kind: string;
  scope: string;
  surveyor: string;
  location: string;
  status: string;
  daysOut: number;
  tone: string;
}

interface ConditionOfClass {
  id: string;
  severity: 'Condition' | 'Recommendation' | 'Memorandum' | 'Closed';
  title: string;
  detail: string;
  raisedAt: string;
  openedAt: string;
  dueAt: string | null;
  daysLeft: number | null;
  linkedCertId: string | null;
  tone: string;
}

interface Inspection {
  id: string;
  inspectedAt: string;
  kind: 'PSC' | 'Vetting' | 'Flag';
  mou: string;
  port: string;
  inspector: string;
  deficiencies: number;
  detained: boolean;
  status: string;
  tone: string;
  findings: string;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const CAT_META: Record<CertCat, { labelKey: string; color: BadgeColor; short: string }> = {
  statutory: { labelKey: 'certificates.cat_statutory', color: 'slate', short: 'STAT' },
  class: { labelKey: 'certificates.cat_class', color: 'blue', short: 'CLASS' },
  mlc: { labelKey: 'certificates.cat_mlc', color: 'purple', short: 'MLC' },
  ism: { labelKey: 'certificates.cat_ism', color: 'purple', short: 'ISM' },
  isps: { labelKey: 'certificates.cat_isps', color: 'purple', short: 'ISPS' },
  marpol: { labelKey: 'certificates.cat_marpol', color: 'green', short: 'MARP' },
  insurance: { labelKey: 'certificates.cat_insurance', color: 'amber', short: 'INS' },
  flag: { labelKey: 'certificates.cat_flag', color: 'slate', short: 'FLAG' },
};

const toneColor = (t: string): BadgeColor =>
  t === 'red'
    ? 'red'
    : t === 'amber'
      ? 'amber'
      : t === 'blue'
        ? 'blue'
        : t === 'purple'
          ? 'purple'
          : 'green';

type Tab = 'reg' | 'surv' | 'coc' | 'insp' | 'renew';

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

function DaysLeftBadge({ daysLeft, status }: { daysLeft: number; status: string }) {
  if (daysLeft > 9000) return <Badge color="slate">PERPETUAL</Badge>;
  if (daysLeft < 0) return <Badge color="red">{-daysLeft}d OVERDUE</Badge>;
  return <Badge color={toneColor(status)}>{daysLeft}d</Badge>;
}

// ─── Register tab ─────────────────────────────────────────────────────────────

function RegisterTab({ certs, loading }: { certs: Certificate[]; loading: boolean }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'critical' | 'soon'>('all');
  const [catFilter, setCatFilter] = useState<string>('all');

  const visible = certs.filter((c) => {
    if (statusFilter === 'critical' && c.status !== 'red') return false;
    if (statusFilter === 'soon' && c.status === 'green') return false;
    if (catFilter !== 'all' && c.category !== catFilter) return false;
    return true;
  });

  const sel = certs.find((c) => c.id === selected) ?? visible[0] ?? null;

  const chipStyle = (active: boolean): React.CSSProperties => ({
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

  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-1 min-h-0">
      <section className="flex flex-col flex-1 min-w-0">
        {/* Filters */}
        <div
          className="flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
        >
          <span
            className="text-[10.5px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-3)' }}
          >
            {t('certificates.status_filter')}
          </span>
          {(['all', 'critical', 'soon'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              style={chipStyle(statusFilter === f)}
            >
              {f === 'all'
                ? `${t('certificates.filter_all')} ${certs.length}`
                : f === 'critical'
                  ? t('certificates.filter_expired')
                  : t('certificates.filter_90d')}
            </button>
          ))}
          <div style={{ width: 1, height: 18, background: 'var(--hairline)', margin: '0 4px' }} />
          <span
            className="text-[10.5px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-3)' }}
          >
            Category
          </span>
          <div style={{ width: 160 }}>
            <Select
              value={catFilter}
              onChange={setCatFilter}
              options={[
                { value: 'all', label: t('certificates.filter_all_cats') },
                ...Object.entries(CAT_META).map(([k, v]) => ({ value: k, label: t(v.labelKey) })),
              ]}
              size="sm"
            />
          </div>
          <div className="flex-1" />
          <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
            {visible.length} of {certs.length}
          </span>
        </div>

        {/* Column header */}
        <div
          className="grid gap-2 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest flex-shrink-0"
          style={{
            gridTemplateColumns: '90px 65px 1fr 180px 110px 90px 70px',
            background: 'var(--surface-sunk)',
            color: 'var(--ink-3)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>{t('certificates.col_id')}</span>
          <span>{t('certificates.col_cat')}</span>
          <span>{t('certificates.col_title')}</span>
          <span>{t('certificates.col_authority')}</span>
          <span>{t('certificates.col_expires')}</span>
          <span style={{ textAlign: 'right' }}>{t('certificates.col_days_left')}</span>
          <span />
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface)' }}>
          {visible.length === 0 ? (
            <EmptyState msg={t('certificates.no_certs')} />
          ) : (
            visible.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelected(c.id)}
                className="grid gap-2 px-4 py-2.5 items-center cursor-pointer"
                style={{
                  gridTemplateColumns: '90px 65px 1fr 180px 110px 90px 70px',
                  borderTop: '1px solid var(--hairline)',
                  background: sel?.id === c.id ? 'var(--surface-sunk)' : 'var(--surface)',
                }}
              >
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {c.id}
                </span>
                <Badge color={CAT_META[c.category]?.color ?? 'slate'}>
                  {CAT_META[c.category]?.short ?? c.category}
                </Badge>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{c.title}</div>
                  <div className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                    {c.acronym}
                  </div>
                </div>
                <span className="text-[11.5px] truncate" style={{ color: 'var(--ink-2)' }}>
                  {c.authority}
                </span>
                <span
                  className="font-mono text-[11px]"
                  style={{ color: c.status === 'red' ? 'var(--sig-red)' : 'var(--ink-2)' }}
                >
                  {c.expiresAt ?? '—'}
                </span>
                <span style={{ textAlign: 'right' }}>
                  <DaysLeftBadge daysLeft={c.daysLeft} status={c.status} />
                </span>
                <button
                  className="text-[11px] px-2 py-0.5 rounded-1 border"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  {c.status === 'red' ? t('common.renew') : t('common.open')}
                </button>
              </div>
            ))
          )}
        </div>
      </section>

      {/* Detail pane */}
      <aside
        style={{
          width: 360,
          flexShrink: 0,
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {!sel ? (
          <EmptyState msg={t('certificates.select_cert_hint')} />
        ) : (
          <>
            <div className="overflow-y-auto flex-1">
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
                <div className="flex items-start gap-3">
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 8,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background:
                        sel.status === 'red'
                          ? '#F2DDD8'
                          : sel.status === 'amber'
                            ? '#F4E7D0'
                            : 'var(--surface-2)',
                      border: `1px solid ${sel.status === 'red' ? 'var(--sig-red)' : sel.status === 'amber' ? 'var(--sig-amber)' : 'var(--border)'}`,
                    }}
                  >
                    <span
                      className="font-mono text-[11px] font-semibold"
                      style={{
                        color:
                          sel.status === 'red'
                            ? 'var(--sig-red)'
                            : sel.status === 'amber'
                              ? 'var(--sig-amber)'
                              : 'var(--ink-2)',
                      }}
                    >
                      {CAT_META[sel.category]?.short ?? sel.category}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                        {sel.id}
                      </span>
                      <Badge color={CAT_META[sel.category]?.color ?? 'slate'}>
                        {CAT_META[sel.category] ? t(CAT_META[sel.category].labelKey) : ''}
                      </Badge>
                    </div>
                    <div
                      className="text-[14px] font-semibold"
                      style={{ letterSpacing: '-0.005em', lineHeight: 1.3 }}
                    >
                      {sel.title}
                    </div>
                    <div
                      className="font-mono text-[10.5px]"
                      style={{ color: 'var(--ink-3)', marginTop: 2 }}
                    >
                      {sel.acronym}
                    </div>
                  </div>
                </div>
              </div>

              {/* Days hero */}
              <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
                <div className="flex items-baseline gap-3">
                  <span
                    className="font-mono text-[24px] font-semibold"
                    style={{
                      letterSpacing: '-0.02em',
                      color:
                        sel.status === 'red'
                          ? 'var(--sig-red)'
                          : sel.status === 'amber'
                            ? 'var(--sig-amber)'
                            : 'var(--ink)',
                    }}
                  >
                    {sel.daysLeft > 9000
                      ? '∞'
                      : sel.daysLeft < 0
                        ? `${-sel.daysLeft} d`
                        : `${sel.daysLeft} d`}
                  </span>
                  <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                    {sel.daysLeft > 9000
                      ? t('certificates.status_perpetual_lower')
                      : sel.daysLeft < 0
                        ? t('certificates.status_overdue_lower')
                        : t('certificates.to_expiry')}
                  </span>
                  <div className="flex-1" />
                  <Badge
                    color={
                      sel.status === 'red' ? 'red' : sel.status === 'amber' ? 'amber' : 'green'
                    }
                  >
                    {sel.status === 'red'
                      ? t('certificates.status_action_req')
                      : sel.status === 'amber'
                        ? t('certificates.status_in_window')
                        : t('certificates.status_in_order')}
                  </Badge>
                </div>
              </div>

              {/* Key-value grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', fontSize: 12 }}>
                {(
                  [
                    [t('certificates.col_authority'), sel.authority, false],
                    [t('certificates.issued'), sel.issuedAt, true],
                    [t('certificates.expires'), sel.expiresAt ?? '—', true],
                    [t('certificates.cycle'), sel.cycle, false],
                    [t('certificates.next_survey'), sel.nextSurvey ?? '—', false],
                  ] as [string, string, boolean][]
                ).map(([k, v, mono]) => (
                  <div key={k} className="contents">
                    <div
                      className="px-4 py-2"
                      style={{ borderTop: '1px solid var(--hairline)', color: 'var(--ink-3)' }}
                    >
                      {k}
                    </div>
                    <div
                      className="px-4 py-2"
                      style={{
                        borderTop: '1px solid var(--hairline)',
                        color: 'var(--ink)',
                        fontFamily: mono ? 'var(--font-mono)' : undefined,
                        fontSize: mono ? 11 : 12,
                      }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div
              className="flex gap-2 p-3 flex-shrink-0"
              style={{ borderTop: '1px solid var(--hairline)', background: 'var(--surface-2)' }}
            >
              <button
                className="flex-1 py-1.5 rounded-2 text-[12px] font-medium border"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  cursor: 'pointer',
                  color: 'var(--ink)',
                }}
              >
                {t('certificates.schedule_survey')}
              </button>
              <button
                className="flex-1 py-1.5 rounded-2 text-[12px] font-medium"
                style={{
                  background: 'var(--navy)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {sel.status === 'red'
                  ? t('certificates.initiate_renewal')
                  : t('certificates.open_document')}
              </button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

// ─── Surveys tab ──────────────────────────────────────────────────────────────

function SurveysTab({ surveys, loading }: { surveys: Survey[]; loading: boolean }) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const overdue = surveys.filter((s) => s.status === 'overdue').length;

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
          {t('certificates.schedule_12months')}
        </span>
        <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          {surveys.length} {t('certificates.surveys')} · {overdue}{' '}
          {t('certificates.status_overdue').toLowerCase()}
        </span>
        <div className="flex-1" />
        <button
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {t('certificates.schedule_survey')}
        </button>
      </div>

      {surveys.length === 0 ? (
        <EmptyState msg={t('certificates.no_surveys')} />
      ) : (
        <div className="p-4 flex flex-col gap-3">
          {surveys.map((s) => (
            <div
              key={s.id}
              className="rounded-2 overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="grid gap-2 px-4 py-2.5 items-center"
                style={{
                  gridTemplateColumns: '80px 90px 100px 1fr 160px 110px 70px',
                  borderBottom: '1px solid var(--hairline)',
                }}
              >
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {s.scheduledAt}
                </span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {s.id}
                </span>
                <Badge
                  color={
                    s.kind === 'Annual'
                      ? 'slate'
                      : s.kind === 'Intermediate'
                        ? 'blue'
                        : s.kind === 'Special'
                          ? 'slate'
                          : s.kind === 'Renewal'
                            ? 'purple'
                            : 'amber'
                  }
                >
                  {s.kind.toUpperCase()}
                </Badge>
                <span className="text-[12px] truncate">{s.scope}</span>
                <div className="min-w-0">
                  <div className="text-[11.5px] truncate" style={{ color: 'var(--ink-2)' }}>
                    {s.surveyor}
                  </div>
                  <div className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                    {s.location}
                  </div>
                </div>
                <Badge color={toneColor(s.tone)}>
                  {s.status === 'overdue'
                    ? `OVERDUE`
                    : s.status === 'tentative'
                      ? 'TENTATIVE'
                      : `IN ${s.daysOut}d`}
                </Badge>
                <button
                  className="text-[11px] px-2 py-0.5 rounded-1 border justify-self-end"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  {t('common.open')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Conditions of class tab ───────────────────────────────────────────────────

function ConditionsTab({
  conditions,
  loading,
}: {
  conditions: ConditionOfClass[];
  loading: boolean;
}) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const open = conditions.filter((c) => c.severity !== 'Closed');
  const closed = conditions.filter((c) => c.severity === 'Closed');

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
          {t('certificates.conditions_header')}
        </span>
        <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          {open.length} {t('certificates.conditions_open')} · {closed.length}{' '}
          {t('certificates.conditions_closed')}
        </span>
        <div className="flex-1" />
        <button
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {t('certificates.log_item')}
        </button>
      </div>

      {conditions.length === 0 ? (
        <EmptyState msg={t('certificates.no_conditions')} />
      ) : (
        <div className="p-4 flex flex-col gap-3">
          {open.map((c) => (
            <section
              key={c.id}
              className="rounded-2 overflow-hidden"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderLeft: `3px solid ${c.tone === 'red' ? 'var(--sig-red)' : c.tone === 'amber' ? 'var(--sig-amber)' : 'var(--sig-blue)'}`,
              }}
            >
              <div
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: '1px solid var(--hairline)' }}
              >
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {c.id}
                </span>
                <Badge color={toneColor(c.tone)}>{c.severity.toUpperCase()}</Badge>
                <span className="flex-1 min-w-0 text-[13px] font-semibold truncate">{c.title}</span>
                {c.daysLeft !== null && <DaysLeftBadge daysLeft={c.daysLeft} status={c.tone} />}
              </div>
              <div
                className="px-4 py-2.5 text-[12.5px]"
                style={{ color: 'var(--ink-2)', lineHeight: 1.5 }}
              >
                {c.detail}
              </div>
              <div
                className="grid gap-px"
                style={{
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  background: 'var(--hairline)',
                  borderTop: '1px solid var(--hairline)',
                }}
              >
                {[
                  [t('certificates.raised'), c.raisedAt],
                  [t('certificates.opened_at'), c.openedAt],
                  [t('certificates.due_by'), c.dueAt ?? '—'],
                ].map(([k, v]) => (
                  <div key={k} className="px-3 py-2" style={{ background: 'var(--surface-2)' }}>
                    <div
                      className="text-[9px] font-semibold uppercase tracking-widest mb-0.5"
                      style={{ color: 'var(--ink-3)' }}
                    >
                      {k}
                    </div>
                    <div
                      className="font-mono text-[11px] font-medium"
                      style={{ color: 'var(--ink)' }}
                    >
                      {v}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
          {closed.length > 0 && (
            <div
              className="rounded-2 overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="px-4 py-2.5"
                style={{
                  borderBottom: '1px solid var(--hairline)',
                  background: 'var(--surface-sunk)',
                }}
              >
                <span
                  className="text-[10.5px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {t('purchase.status_closed').toUpperCase()}
                </span>
              </div>
              {closed.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderTop: '1px solid var(--hairline)' }}
                >
                  <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {c.id}
                  </span>
                  <Badge color="green">CLOSED</Badge>
                  <span className="flex-1 text-[12.5px] font-medium">{c.title}</span>
                  <button
                    className="text-[11px] px-2 py-0.5 rounded-1 border"
                    style={{
                      background: 'var(--surface)',
                      borderColor: 'var(--border)',
                      cursor: 'pointer',
                      color: 'var(--ink-2)',
                    }}
                  >
                    {t('common.open')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Inspections tab ───────────────────────────────────────────────────────────

function InspectionsTab({ inspections, loading }: { inspections: Inspection[]; loading: boolean }) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const pscCount = inspections.filter((i) => i.kind === 'PSC').length;
  const totalDef = inspections.reduce((a, i) => a + i.deficiencies, 0);
  const detentions = inspections.filter((i) => i.detained).length;

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
      {/* KPI strip */}
      <div className="grid gap-2 p-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          {
            label: t('certificates.psc_inspections'),
            value: pscCount,
            sub: t('certificates.last_24_months'),
          },
          {
            label: t('certificates.deficiencies'),
            value: totalDef,
            sub: t('certificates.all_closed'),
          },
          {
            label: t('certificates.detentions'),
            value: detentions,
            sub: t('certificates.last_24_months'),
            accent: detentions > 0 ? 'var(--sig-red)' : undefined,
          },
          {
            label: t('certificates.vetting_score'),
            value: '—',
            sub: t('certificates.no_data_yet'),
          },
        ].map((k) => (
          <div
            key={k.label}
            className="rounded-2 px-4 py-3"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="text-[10.5px] font-semibold uppercase tracking-widest mb-1"
              style={{ color: 'var(--ink-3)' }}
            >
              {k.label}
            </div>
            <div
              className="font-mono text-[22px] font-semibold"
              style={{
                color: (k as { accent?: string }).accent ?? 'var(--ink)',
                letterSpacing: '-0.02em',
              }}
            >
              {k.value}
            </div>
            <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
              {k.sub}
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-4">
        <div
          className="rounded-2 overflow-hidden"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <div
            className="flex items-center gap-3 px-4 py-2.5"
            style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surface)' }}
          >
            <span
              className="text-[10.5px] font-semibold uppercase tracking-widest"
              style={{ color: 'var(--ink-3)' }}
            >
              {t('certificates.inspection_history')}
            </span>
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
              {t('common.export')}
            </button>
          </div>
          <div
            className="grid gap-2 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest"
            style={{
              gridTemplateColumns: '80px 100px 110px 130px 1fr 70px 90px 70px',
              background: 'var(--surface-sunk)',
              color: 'var(--ink-3)',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <span>{t('common.date')}</span>
            <span>{t('certificates.col_id')}</span>
            <span>{t('certificates.col_kind_mou')}</span>
            <span>{t('purchase.col_port')}</span>
            <span>{t('certificates.col_findings')}</span>
            <span style={{ textAlign: 'right' }}>{t('certificates.col_defs')}</span>
            <span>{t('certificates.col_detained')}</span>
            <span />
          </div>
          {inspections.length === 0 ? (
            <EmptyState msg={t('certificates.no_inspections')} />
          ) : (
            inspections.map((i) => (
              <div
                key={i.id}
                className="grid gap-2 px-4 py-2.5 items-center"
                style={{
                  gridTemplateColumns: '80px 100px 110px 130px 1fr 70px 90px 70px',
                  borderTop: '1px solid var(--hairline)',
                }}
              >
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {i.inspectedAt}
                </span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {i.id}
                </span>
                <div>
                  <Badge
                    color={i.kind === 'PSC' ? 'slate' : i.kind === 'Vetting' ? 'purple' : 'blue'}
                  >
                    {i.kind.toUpperCase()}
                  </Badge>
                  <div className="font-mono text-[10px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                    {i.mou}
                  </div>
                </div>
                <span className="text-[11.5px] truncate" style={{ color: 'var(--ink-2)' }}>
                  {i.port}
                </span>
                <span className="text-[11.5px]" style={{ color: 'var(--ink-2)', lineHeight: 1.35 }}>
                  {i.findings}
                </span>
                <span
                  className="font-mono text-[12px]"
                  style={{
                    textAlign: 'right',
                    color: i.deficiencies > 0 ? 'var(--sig-amber)' : 'var(--ink-3)',
                    fontWeight: i.deficiencies > 0 ? 600 : 400,
                  }}
                >
                  {i.deficiencies}
                </span>
                {i.detained ? (
                  <Badge color="red">DETAINED</Badge>
                ) : (
                  <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
                    No
                  </span>
                )}
                <button
                  className="text-[11px] px-2 py-0.5 rounded-1 border justify-self-end"
                  style={{
                    background: 'var(--surface)',
                    borderColor: 'var(--border)',
                    cursor: 'pointer',
                    color: 'var(--ink-2)',
                  }}
                >
                  {t('common.open')}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Renewal timeline tab ─────────────────────────────────────────────────────

function RenewalTimelineTab({ certs, loading }: { certs: Certificate[]; loading: boolean }) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const finite = certs.filter(
    (c) => c.expiresAt && c.expiresAt !== '—' && c.expiresAt !== 'On change',
  );

  if (finite.length === 0)
    return (
      <EmptyState msg="No certificates with finite expiry dates. The timeline appears once certificates are uploaded." />
    );

  const now = new Date();
  const months: { lab: string; date: Date }[] = [];
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      lab: d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }),
      date: d,
    });
  }
  const totalMonths = months.length;
  const msPerMonth = 1000 * 60 * 60 * 24 * 30.5;

  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-4" style={{ background: 'var(--bg)' }}>
      <div
        className="rounded-2 overflow-hidden"
        style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
      >
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{ borderBottom: '1px solid var(--hairline)' }}
        >
          <span
            className="text-[10.5px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-3)' }}
          >
            {t('certificates.renewal_18months')}
          </span>
          <div className="flex-1" />
          {(['green', 'amber', 'red'] as const).map((c) => (
            <span
              key={c}
              className="flex items-center gap-1 text-[10.5px]"
              style={{ color: 'var(--ink-3)' }}
            >
              <span
                style={{
                  width: 9,
                  height: 9,
                  borderRadius: 2,
                  background:
                    c === 'green'
                      ? 'var(--sig-green)'
                      : c === 'amber'
                        ? 'var(--sig-amber)'
                        : 'var(--sig-red)',
                }}
              />
              {c === 'green'
                ? t('certificates.legend_in_order')
                : c === 'amber'
                  ? t('certificates.legend_window')
                  : t('certificates.status_overdue_lower')}
            </span>
          ))}
        </div>
        {/* Month header */}
        <div
          className="grid sticky top-0 z-10"
          style={{ gridTemplateColumns: '240px 1fr', background: 'var(--surface-sunk)' }}
        >
          <div
            className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-widest"
            style={{ color: 'var(--ink-3)' }}
          >
            {t('certificates.cert_col')}
          </div>
          <div className="grid" style={{ gridTemplateColumns: `repeat(${totalMonths}, 1fr)` }}>
            {months.map((m, i) => (
              <div
                key={i}
                className="py-1.5 text-center font-mono text-[10px]"
                style={{
                  color: 'var(--ink-3)',
                  borderLeft: i === 0 ? 'none' : '1px solid var(--hairline)',
                }}
              >
                {m.lab}
              </div>
            ))}
          </div>
        </div>
        {/* Rows */}
        {finite.map((c) => {
          const expiryDate = c.expiresAt ? new Date(c.expiresAt) : null;
          const offsetMonths = expiryDate ? (expiryDate.getTime() - now.getTime()) / msPerMonth : 0;
          const barWidth = Math.max(0, Math.min(offsetMonths / totalMonths, 1)) * 100;
          return (
            <div
              key={c.id}
              className="grid items-center"
              style={{
                gridTemplateColumns: '240px 1fr',
                borderTop: '1px solid var(--hairline)',
                minHeight: 38,
              }}
            >
              <div className="flex items-center gap-2 px-4 py-2">
                <Badge color={CAT_META[c.category]?.color ?? 'slate'}>
                  {CAT_META[c.category]?.short}
                </Badge>
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-medium truncate">{c.acronym}</div>
                  <div className="font-mono text-[10px]" style={{ color: 'var(--ink-3)' }}>
                    {c.id}
                  </div>
                </div>
              </div>
              <div className="relative h-[38px]" style={{ background: 'var(--surface)' }}>
                {months.map((_, i) => (
                  <div
                    key={i}
                    className="absolute top-0 bottom-0"
                    style={{
                      left: `${(i / totalMonths) * 100}%`,
                      width: 1,
                      background: 'var(--hairline)',
                    }}
                  />
                ))}
                {/* Today line */}
                <div
                  className="absolute top-0 bottom-0"
                  style={{ left: '0%', width: 2, background: 'var(--ink)', zIndex: 2 }}
                />
                {/* Bar */}
                <div
                  className="absolute top-2.5 bottom-2.5 flex items-center px-2 text-[10.5px] font-medium text-white overflow-hidden"
                  style={{
                    left: 3,
                    width: `calc(${barWidth}% - 6px)`,
                    background:
                      c.status === 'red'
                        ? 'var(--sig-red)'
                        : c.status === 'amber'
                          ? 'var(--sig-amber)'
                          : 'var(--sig-green)',
                    borderRadius: 3,
                    opacity: 0.85,
                  }}
                >
                  {c.acronym} · {c.expiresAt}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function CertificatesPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'reg';
  const setTab = (tabId: Tab) => setParams(tabId === 'reg' ? {} : { tab: tabId });
  const tabs: { id: Tab; label: string }[] = [
    { id: 'reg', label: t('certificates.tab_register') },
    { id: 'surv', label: t('certificates.tab_surveys') },
    { id: 'coc', label: t('certificates.tab_conditions') },
    { id: 'insp', label: t('certificates.tab_inspections') },
    { id: 'renew', label: t('certificates.tab_renewal') },
  ];

  const [certs, setCerts] = useState<Certificate[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [conditions, setConditions] = useState<ConditionOfClass[]>([]);
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loadCerts, setLoadCerts] = useState(true);
  const [loadSurveys, setLoadSurveys] = useState(true);
  const [loadCoc, setLoadCoc] = useState(true);
  const [loadInsp, setLoadInsp] = useState(true);

  const fetchAll = useCallback(() => {
    api
      .get<Certificate[]>('/certificates')
      .then(setCerts)
      .catch(() => setCerts([]))
      .finally(() => setLoadCerts(false));
    api
      .get<Survey[]>('/surveys')
      .then(setSurveys)
      .catch(() => setSurveys([]))
      .finally(() => setLoadSurveys(false));
    api
      .get<ConditionOfClass[]>('/conditions-of-class')
      .then(setConditions)
      .catch(() => setConditions([]))
      .finally(() => setLoadCoc(false));
    api
      .get<Inspection[]>('/inspections')
      .then(setInspections)
      .catch(() => setInspections([]))
      .finally(() => setLoadInsp(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const overdueCount = certs.filter((c) => c.status === 'red').length;
  const windowCount = certs.filter((c) => c.status === 'amber').length;
  const openCoc = conditions.filter((c) => c.severity !== 'Closed').length;

  const counts: Record<Tab, number> = {
    reg: certs.length,
    surv: surveys.length,
    coc: openCoc,
    insp: inspections.length,
    renew: certs.filter((c) => c.expiresAt && c.expiresAt !== '—').length,
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
          {t('certificates.title')}
        </h1>
        <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
          {certs.length} {certs.length !== 1 ? t('certificates.certs') : t('certificates.cert')}
        </span>
        {overdueCount > 0 && (
          <Badge color="red">
            {overdueCount} {t('certificates.status_overdue')}
          </Badge>
        )}
        {windowCount > 0 && (
          <Badge color="amber">
            {windowCount} {t('certificates.status_in_window')}
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
          {t('certificates.notification_rules')}
        </button>
        <button
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {t('certificates.new_cert')}
        </button>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-0 flex-shrink-0 px-4 overflow-x-auto"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        {tabs.map((tabItem) => (
          <button
            key={tabItem.id}
            onClick={() => setTab(tabItem.id)}
            className="flex items-center gap-2 py-3 text-[13px] border-b-2 whitespace-nowrap flex-shrink-0"
            style={{
              padding: '12px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: `2px solid ${tab === tabItem.id ? 'var(--navy)' : 'transparent'}`,
              cursor: 'pointer',
              color: tab === tabItem.id ? 'var(--ink)' : 'var(--ink-2)',
              fontWeight: tab === tabItem.id ? 600 : 500,
              marginBottom: -1,
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

      {tab === 'reg' && <RegisterTab certs={certs} loading={loadCerts} />}
      {tab === 'surv' && <SurveysTab surveys={surveys} loading={loadSurveys} />}
      {tab === 'coc' && <ConditionsTab conditions={conditions} loading={loadCoc} />}
      {tab === 'insp' && <InspectionsTab inspections={inspections} loading={loadInsp} />}
      {tab === 'renew' && <RenewalTimelineTab certs={certs} loading={loadCerts} />}
    </div>
  );
}
