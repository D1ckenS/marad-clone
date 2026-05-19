import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { Badge, type BadgeColor, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

// ─── Types ───────────────────────────────────────────────────────────────────

type PermitKind = 'hot' | 'enc' | 'aloft' | 'overside' | 'elec' | 'cold' | 'bunker' | 'crane';
type PermitStatus = 'active' | 'awaiting' | 'closed' | 'suspended';
type FindingKind = 'near-miss' | 'NC' | 'observation' | 'hazard';
type CapaStage = 'investigation' | 'action' | 'verification' | 'closed';

interface GasCheck {
  interval: string;
  last: string;
  next: string;
  lel: string;
  o2: string;
  h2s: string;
  co: string;
}

interface CoSigner {
  name: string;
  role: string;
  signedAt: string | null;
}

interface WorkPermit {
  id: string;
  kind: PermitKind;
  status: PermitStatus;
  title: string;
  location: string;
  supervisor: string;
  supervisorRank: string;
  issuedBy: string;
  validFrom: string;
  validTo: string;
  countdown: string;
  hazards: string[];
  ppe: string[];
  isolations: string[];
  standby: string;
  gasChecks: GasCheck | null;
  coSigners: CoSigner[];
}

interface SafetyFinding {
  id: string;
  kind: FindingKind;
  severity: 'High' | 'Med' | 'Low';
  title: string;
  where: string;
  raisedBy: string;
  raisedAt: string;
  detail: string;
  capaRef: string | null;
  status: string;
}

interface JHA {
  id: string;
  title: string;
  category: string;
  owner: string;
  revision: string;
  inherentL: number;
  inherentS: number;
  residualL: number;
  residualS: number;
  lastUsed: string;
  useCount: number;
  keyControls: string[];
}

interface SafetyEquipment {
  id: string;
  category: 'FFA' | 'LSA' | 'OTH';
  name: string;
  location: string;
  quantity: string;
  lastCheck: string;
  nextCheck: string;
  status: 'green' | 'amber' | 'red';
  flag: string | null;
}

interface Capa {
  id: string;
  title: string;
  source: string;
  raisedAt: string;
  dueAt: string | null;
  daysLeft: number | null;
  owner: string;
  rootCause: string;
  totalActions: number;
  doneActions: number;
  stage: CapaStage;
  tone: string;
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

const PERMIT_KIND_META: Record<PermitKind, { labelKey: string; color: BadgeColor; short: string }> =
  {
    hot: { labelKey: 'safety.permit_type_hot', color: 'red', short: 'HOT' },
    enc: { labelKey: 'safety.permit_type_enc', color: 'red', short: 'ENC' },
    aloft: { labelKey: 'safety.permit_type_aloft', color: 'amber', short: 'ALFT' },
    overside: { labelKey: 'safety.permit_type_overside', color: 'amber', short: 'OS' },
    elec: { labelKey: 'safety.permit_type_elec', color: 'amber', short: 'ELEC' },
    cold: { labelKey: 'safety.permit_type_cold', color: 'blue', short: 'COLD' },
    bunker: { labelKey: 'safety.permit_type_bunker', color: 'slate', short: 'BNK' },
    crane: { labelKey: 'safety.permit_type_crane', color: 'amber', short: 'LIFT' },
  };

const statusMeta: Record<string, { color: BadgeColor; labelKey: string }> = {
  active: { color: 'green', labelKey: 'safety.status_active' },
  awaiting: { color: 'amber', labelKey: 'safety.status_awaiting' },
  closed: { color: 'slate', labelKey: 'safety.status_closed' },
  suspended: { color: 'red', labelKey: 'safety.status_suspended' },
  investigation: { color: 'amber', labelKey: 'safety.status_investigation' },
  action: { color: 'blue', labelKey: 'safety.status_action' },
  verification: { color: 'purple', labelKey: 'safety.verifying' },
  open: { color: 'red', labelKey: 'safety.status_open' },
};

const findingMeta: Record<FindingKind, { color: BadgeColor; labelKey: string }> = {
  'near-miss': { color: 'red', labelKey: 'safety.finding_near_miss' },
  NC: { color: 'amber', labelKey: 'safety.finding_nc' },
  observation: { color: 'blue', labelKey: 'safety.finding_observation' },
  hazard: { color: 'purple', labelKey: 'safety.finding_hazard' },
};

type Tab = 'permit' | 'find' | 'jha' | 'eq' | 'capa';

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

function StatusBadge({ s }: { s: string }) {
  const { t } = useTranslation();
  const m = statusMeta[s];
  return <Badge color={m?.color ?? 'slate'}>{m ? t(m.labelKey) : s.toUpperCase()}</Badge>;
}

// ─── Permits tab ──────────────────────────────────────────────────────────────

function PermitsTab({ permits, loading }: { permits: WorkPermit[]; loading: boolean }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | PermitStatus>('all');

  const visible = filter === 'all' ? permits : permits.filter((p) => p.status === filter);
  const sel = permits.find((p) => p.id === selected) ?? visible[0] ?? null;

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
      {/* Left list */}
      <section
        style={{
          width: 420,
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex items-center gap-2 px-3 py-2 flex-wrap flex-shrink-0"
          style={{ borderBottom: '1px solid var(--hairline)' }}
        >
          {(['all', 'active', 'awaiting', 'closed'] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} style={chipStyle(filter === f)}>
              {f === 'all'
                ? t('common.all')
                : t(`safety.status_${f}`).charAt(0) +
                  t(`safety.status_${f}`).slice(1).toLowerCase()}
              <span className="font-mono text-[10px] ml-1 opacity-70">
                {f === 'all' ? permits.length : permits.filter((p) => p.status === f).length}
              </span>
            </button>
          ))}
        </div>
        {visible.length === 0 ? (
          <EmptyState msg={t('safety.no_permits')} />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {visible.map((p) => {
              const km = PERMIT_KIND_META[p.kind] ?? {
                labelKey: p.kind,
                color: 'slate' as BadgeColor,
                short: p.kind,
              };
              const isActive = p.id === sel?.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(p.id)}
                  className="px-3 py-3 cursor-pointer"
                  style={{
                    borderBottom: '1px solid var(--hairline)',
                    borderLeft: `3px solid ${isActive ? 'var(--navy)' : 'transparent'}`,
                    background: isActive ? 'var(--surface-sunk)' : 'var(--surface)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="font-mono text-[11px] font-medium"
                      style={{ color: 'var(--ink-2)' }}
                    >
                      {p.id}
                    </span>
                    <Badge color={km.color}>{km.short}</Badge>
                    <div className="flex-1" />
                    <StatusBadge s={p.status} />
                  </div>
                  <div className="text-[12.5px] font-medium mb-0.5" style={{ lineHeight: 1.3 }}>
                    {p.title}
                  </div>
                  <div className="text-[11px] mb-1" style={{ color: 'var(--ink-3)' }}>
                    {p.location}
                  </div>
                  <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                    {t('safety.supervisor_abbrev')} {p.supervisor} ·{' '}
                    <span className="font-mono">{p.countdown}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Right detail */}
      {!sel ? (
        <div
          className="flex-1 flex items-center justify-center"
          style={{ background: 'var(--bg)' }}
        >
          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
            {t('safety.select_permit_hint')}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto min-w-0" style={{ background: 'var(--bg)' }}>
          {/* Header */}
          <div
            className="px-5 py-4"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                {sel.id}
              </span>
              <Badge color={PERMIT_KIND_META[sel.kind]?.color ?? 'slate'}>
                {PERMIT_KIND_META[sel.kind]?.short}
              </Badge>
              <div className="flex-1" />
              <StatusBadge s={sel.status} />
            </div>
            <h2 className="text-[17px] font-semibold m-0" style={{ letterSpacing: '-0.005em' }}>
              {sel.title}
            </h2>
            <div className="text-[12px] mt-1" style={{ color: 'var(--ink-3)' }}>
              {sel.location}
            </div>
          </div>

          {/* Validity strip */}
          <div
            className="grid gap-px"
            style={{
              gridTemplateColumns: 'repeat(3, 1fr)',
              background: 'var(--hairline)',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            {[
              [t('safety.valid_from'), sel.validFrom],
              [t('safety.valid_to'), sel.validTo],
              [
                sel.status === 'active' ? t('safety.time_remaining') : t('common.status'),
                sel.countdown,
              ],
            ].map(([k, v]) => (
              <div key={k} className="px-4 py-3" style={{ background: 'var(--surface)' }}>
                <div
                  className="text-[9.5px] font-semibold uppercase tracking-widest mb-1"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {k}
                </div>
                <div className="font-mono text-[13px] font-semibold">{v}</div>
              </div>
            ))}
          </div>

          {/* Gas checks */}
          {sel.gasChecks && (
            <div className="px-4 py-3">
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
                  <span
                    className="text-[10.5px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {t('safety.gas_monitoring')} {sel.gasChecks.interval}
                  </span>
                  <div className="flex-1" />
                  <Badge color="green">
                    {t('safety.next')} {sel.gasChecks.next}
                  </Badge>
                </div>
                <div
                  className="grid gap-px"
                  style={{ gridTemplateColumns: 'repeat(5, 1fr)', background: 'var(--hairline)' }}
                >
                  {[
                    [t('safety.last_check'), sel.gasChecks.last],
                    ['LEL', sel.gasChecks.lel],
                    ['O₂', sel.gasChecks.o2],
                    ['H₂S', sel.gasChecks.h2s],
                    ['CO', sel.gasChecks.co],
                  ].map(([k, v]) => (
                    <div key={k} className="px-3 py-2.5" style={{ background: 'var(--surface)' }}>
                      <div
                        className="text-[9px] font-semibold uppercase tracking-widest mb-0.5"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        {k}
                      </div>
                      <div className="font-mono text-[13px] font-semibold">{v}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Hazards + PPE */}
          <div className="grid gap-3 px-4 py-0 pb-3" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {[
              {
                label: t('safety.hazards'),
                items: sel.hazards,
                prefix: '!',
                prefixColor: 'var(--sig-red)',
              },
              {
                label: t('safety.ppe_required'),
                items: sel.ppe,
                prefix: '✓',
                prefixColor: 'var(--sig-green)',
              },
            ].map(({ label, items, prefix, prefixColor }) => (
              <div
                key={label}
                className="rounded-2 overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div
                  className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-widest"
                  style={{
                    borderBottom: '1px solid var(--hairline)',
                    color: 'var(--ink-3)',
                    background: 'var(--surface-sunk)',
                  }}
                >
                  {label}
                </div>
                <ul
                  className="m-0 list-none p-3 text-[12.5px]"
                  style={{ color: 'var(--ink-2)', lineHeight: 1.6 }}
                >
                  {items.map((h, i) => (
                    <li key={i} className="flex gap-2 items-start">
                      <span className="font-mono flex-shrink-0" style={{ color: prefixColor }}>
                        {prefix}
                      </span>
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Co-signers */}
          <div className="px-4 pb-4">
            <div
              className="rounded-2 overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-widest"
                style={{
                  borderBottom: '1px solid var(--hairline)',
                  color: 'var(--ink-3)',
                  background: 'var(--surface-sunk)',
                }}
              >
                {t('safety.sign_offs')}
              </div>
              {sel.coSigners.map((s, i) => (
                <div
                  key={i}
                  className="grid gap-3 px-4 py-2.5 items-center"
                  style={{
                    gridTemplateColumns: '1fr 140px 90px',
                    borderTop: i === 0 ? 'none' : '1px solid var(--hairline)',
                  }}
                >
                  <div>
                    <div className="text-[12.5px] font-medium">{s.name}</div>
                    <div className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {s.role}
                    </div>
                  </div>
                  <span
                    className="font-mono text-[11px]"
                    style={{ color: s.signedAt ? 'var(--ink-3)' : 'var(--sig-amber)' }}
                  >
                    {s.signedAt ?? 'pending'}
                  </span>
                  <Badge color={s.signedAt ? 'green' : 'amber'}>
                    {s.signedAt ? 'SIGNED' : 'PENDING'}
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          <div
            className="sticky bottom-0 flex gap-2 px-4 py-3 justify-end"
            style={{ background: 'var(--surface)', borderTop: '1px solid var(--border)' }}
          >
            {sel.status === 'active' && (
              <button
                className="px-3 py-1.5 rounded-2 text-[12px] font-medium"
                style={{
                  background: 'var(--sig-red)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('safety.suspend')}
              </button>
            )}
            {sel.status === 'awaiting' && (
              <button
                className="px-3 py-1.5 rounded-2 text-[12px] font-medium border"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  cursor: 'pointer',
                  color: 'var(--ink)',
                }}
              >
                {t('safety.request_changes')}
              </button>
            )}
            {sel.status === 'awaiting' && (
              <button
                className="px-3 py-1.5 rounded-2 text-[12px] font-medium"
                style={{
                  background: 'var(--navy)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('safety.approve_issue')}
              </button>
            )}
            {sel.status === 'active' && (
              <button
                className="px-3 py-1.5 rounded-2 text-[12px] font-medium"
                style={{
                  background: 'var(--navy)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('safety.log_gas_check')}
              </button>
            )}
            {sel.status === 'closed' && (
              <button
                className="px-3 py-1.5 rounded-2 text-[12px] font-medium border"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  cursor: 'pointer',
                  color: 'var(--ink)',
                }}
              >
                {t('safety.clone')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Findings tab ─────────────────────────────────────────────────────────────

function FindingsTab({ findings, loading }: { findings: SafetyFinding[]; loading: boolean }) {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<'all' | 'open' | FindingKind>('all');

  const visible = findings.filter((f) =>
    filter === 'all' ? true : filter === 'open' ? f.status !== 'closed' : f.kind === filter,
  );

  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const open = findings.filter((f) => f.status !== 'closed').length;
  const nearMisses = findings.filter((f) => f.kind === 'near-miss').length;
  const ncs = findings.filter((f) => f.kind === 'NC').length;

  const chipStyle = (active: boolean): React.CSSProperties => ({
    height: 22,
    padding: '0 8px',
    borderRadius: 4,
    fontSize: 11,
    fontWeight: 500,
    cursor: 'pointer',
    border: `1px solid ${active ? 'var(--ink)' : 'var(--border)'}`,
    background: active ? 'var(--ink)' : 'var(--surface)',
    color: active ? '#fff' : 'var(--ink-2)',
  });

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
      {/* KPI strip */}
      <div className="grid gap-2 p-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          { label: t('safety.open_findings'), value: open, sub: t('safety.last_30_days') },
          {
            label: t('safety.ncs_raised'),
            value: nearMisses,
            sub: 'LTI rate 0.00',
            accent: nearMisses > 0 ? 'var(--sig-amber)' : undefined,
          },
          { label: t('safety.ncs_raised'), value: ncs, sub: '' },
          {
            label: t('safety.days_since_lti'),
            value: '—',
            sub: t('safety.no_incidents'),
            accent: 'var(--sig-green)',
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
            className="flex items-center gap-2 px-4 py-2.5 flex-wrap"
            style={{ borderBottom: '1px solid var(--hairline)' }}
          >
            <span
              className="text-[10.5px] font-semibold uppercase tracking-widest flex-1"
              style={{ color: 'var(--ink-3)' }}
            >
              {t('safety.findings_register')}
            </span>
            {(['all', 'open', 'near-miss', 'NC', 'observation'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} style={chipStyle(filter === f)}>
                {f === 'near-miss' ? t('safety.near_miss') : f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
            <button
              className="px-2 py-0.5 rounded-1 text-[11px] font-medium"
              style={{
                background: 'var(--navy)',
                color: '#fff',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {t('safety.findings_register')}
            </button>
          </div>
          <div
            className="grid gap-2 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest"
            style={{
              gridTemplateColumns: '80px 100px 90px 1fr 150px 80px 100px 80px',
              background: 'var(--surface-sunk)',
              color: 'var(--ink-3)',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <span>{t('safety.col_id')}</span>
            <span>{t('common.date')}</span>
            <span>{t('safety.col_kind')}</span>
            <span>{t('safety.col_title_location')}</span>
            <span>{t('safety.col_raised_by')}</span>
            <span>{t('safety.col_sev')}</span>
            <span>{t('safety.col_capa')}</span>
            <span>{t('common.status')}</span>
          </div>
          {visible.length === 0 ? (
            <EmptyState msg={t('safety.no_findings')} />
          ) : (
            visible.map((f) => (
              <div
                key={f.id}
                className="grid gap-2 px-4 py-2.5 items-center"
                style={{
                  gridTemplateColumns: '80px 100px 90px 1fr 150px 80px 100px 80px',
                  borderTop: '1px solid var(--hairline)',
                }}
              >
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {f.id}
                </span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {f.raisedAt.split(' ').slice(0, 2).join(' ')}
                </span>
                <Badge color={findingMeta[f.kind]?.color ?? 'slate'}>
                  {findingMeta[f.kind] ? t(findingMeta[f.kind]!.labelKey) : f.kind}
                </Badge>
                <div className="min-w-0">
                  <div className="text-[12.5px] font-medium truncate">{f.title}</div>
                  <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                    {f.where}
                  </div>
                </div>
                <span className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                  {f.raisedBy}
                </span>
                <Badge
                  color={f.severity === 'High' ? 'red' : f.severity === 'Med' ? 'amber' : 'green'}
                >
                  {f.severity.toUpperCase()}
                </Badge>
                <span
                  className="font-mono text-[10.5px]"
                  style={{ color: f.capaRef ? 'var(--sig-blue)' : 'var(--ink-3)' }}
                >
                  {f.capaRef ?? '—'}
                </span>
                <StatusBadge s={f.status} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── JHA tab ──────────────────────────────────────────────────────────────────

function RiskMatrix({ l, s }: { l: number; s: number }) {
  const { t } = useTranslation();
  const score = (li: number, si: number) => li * si;
  const cellColor = (sc: number) =>
    sc >= 15
      ? 'var(--sig-red)'
      : sc >= 8
        ? 'var(--sig-amber)'
        : sc >= 4
          ? 'var(--sig-green)'
          : 'var(--ink-3)';
  const cellBg = (sc: number) =>
    sc >= 15 ? '#F2DDD8' : sc >= 8 ? '#F4E7D0' : sc >= 4 ? '#E2EEE6' : 'var(--surface-sunk)';
  const total = l * s;
  return (
    <div className="p-4">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: '32px repeat(5, 1fr)' }}>
        <span />
        {[1, 2, 3, 4, 5].map((si) => (
          <div
            key={si}
            className="text-center font-mono text-[9.5px]"
            style={{ color: 'var(--ink-3)', paddingBottom: 4 }}
          >
            S{si}
          </div>
        ))}
        {[5, 4, 3, 2, 1].map((li) => (
          <div key={li} className="contents">
            <div
              className="flex items-center justify-center font-mono text-[9.5px]"
              style={{ color: 'var(--ink-3)' }}
            >
              L{li}
            </div>
            {[1, 2, 3, 4, 5].map((si) => {
              const sc = score(li, si);
              const isThis = li === l && si === s;
              return (
                <div
                  key={si}
                  style={{
                    height: 30,
                    background: cellBg(sc),
                    color: cellColor(sc),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    fontWeight: 500,
                    border: isThis ? '2px solid var(--ink)' : '1px solid transparent',
                  }}
                >
                  {sc}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-baseline gap-2 mt-3">
        <span className="font-mono text-[22px] font-semibold" style={{ color: cellColor(total) }}>
          {total}
        </span>
        <span className="text-[11.5px]" style={{ color: 'var(--ink-3)' }}>
          {total >= 15
            ? t('safety.risk_intolerable')
            : total >= 8
              ? t('safety.risk_substantial')
              : total >= 4
                ? t('safety.risk_moderate')
                : t('safety.risk_acceptable')}
        </span>
      </div>
    </div>
  );
}

function JhaTab({ jhas, loading }: { jhas: JHA[]; loading: boolean }) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const sel = jhas.find((j) => j.id === selected) ?? jhas[0] ?? null;

  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  return (
    <div className="flex flex-1 min-h-0">
      {/* Library list */}
      <section
        style={{
          width: 360,
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="flex items-center gap-2 px-4 py-2.5 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--hairline)' }}
        >
          <span
            className="text-[10.5px] font-semibold uppercase tracking-widest flex-1"
            style={{ color: 'var(--ink-3)' }}
          >
            {t('safety.jha_library')} {jhas.length} {t('safety.assessments')}
          </span>
          <button
            className="w-6 h-6 flex items-center justify-center rounded-1 text-[13px]"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--ink-3)',
            }}
          >
            +
          </button>
        </div>
        {jhas.length === 0 ? (
          <EmptyState msg="No JHA / risk assessments on file. Add your first assessment to build the library." />
        ) : (
          <div className="flex-1 overflow-y-auto">
            {jhas.map((j) => {
              const residual = j.residualL * j.residualS;
              const tone: BadgeColor = residual >= 15 ? 'red' : residual >= 8 ? 'amber' : 'green';
              const isActive = j.id === sel?.id;
              return (
                <div
                  key={j.id}
                  onClick={() => setSelected(j.id)}
                  className="px-4 py-3 cursor-pointer"
                  style={{
                    borderBottom: '1px solid var(--hairline)',
                    borderLeft: `3px solid ${isActive ? 'var(--navy)' : 'transparent'}`,
                    background: isActive ? 'var(--surface-sunk)' : 'var(--surface)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                      {j.id}
                    </span>
                    <Badge color="slate">{j.category.toUpperCase()}</Badge>
                    <div className="flex-1" />
                    <Badge color={tone}>R {residual}</Badge>
                  </div>
                  <div className="text-[12.5px] font-medium">{j.title}</div>
                  <div className="text-[10.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                    {j.owner} · {j.revision} · used {j.useCount}×
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Detail */}
      {!sel ? (
        <div
          className="flex-1 flex items-center justify-center"
          style={{ background: 'var(--bg)' }}
        >
          <p className="text-xs" style={{ color: 'var(--ink-3)' }}>
            {t('safety.select_jha_hint')}
          </p>
        </div>
      ) : (
        <section className="flex-1 overflow-y-auto min-w-0" style={{ background: 'var(--bg)' }}>
          <div
            className="px-5 py-4"
            style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                {sel.id}
              </span>
              <Badge color="slate">{sel.category.toUpperCase()}</Badge>
              <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                · {sel.revision}
              </span>
              <div className="flex-1" />
              <button
                className="px-2 py-1 rounded-1 text-[11px] border"
                style={{
                  background: 'var(--surface)',
                  borderColor: 'var(--border)',
                  cursor: 'pointer',
                  color: 'var(--ink)',
                }}
              >
                {t('safety.revise')}
              </button>
              <button
                className="px-2 py-1 rounded-1 text-[11px]"
                style={{
                  background: 'var(--navy)',
                  color: '#fff',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                {t('safety.open_as_permit_jha')}
              </button>
            </div>
            <h2 className="text-[18px] font-semibold m-0" style={{ letterSpacing: '-0.005em' }}>
              {sel.title}
            </h2>
            <div className="text-[11.5px] mt-1" style={{ color: 'var(--ink-3)' }}>
              Owner {sel.owner} · last used {sel.lastUsed} · {sel.useCount} uses
            </div>
          </div>

          <div className="grid gap-3 p-4" style={{ gridTemplateColumns: '1fr 1fr' }}>
            {[
              {
                label: t('safety.inherent_risk'),
                eyebrow: t('safety.without_controls'),
                l: sel.inherentL,
                s: sel.inherentS,
              },
              {
                label: t('safety.residual_risk'),
                eyebrow: t('safety.with_controls'),
                l: sel.residualL,
                s: sel.residualS,
              },
            ].map(({ label, eyebrow, l, s }) => (
              <div
                key={label}
                className="rounded-2 overflow-hidden"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div
                  className="flex items-center gap-2 px-4 py-2.5"
                  style={{
                    borderBottom: '1px solid var(--hairline)',
                    background: 'var(--surface-sunk)',
                  }}
                >
                  <span className="text-[12px] font-semibold">{label}</span>
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: 'var(--ink-3)' }}
                  >
                    {eyebrow}
                  </span>
                </div>
                <RiskMatrix l={l} s={s} />
              </div>
            ))}
          </div>

          <div className="px-4 pb-4">
            <div
              className="rounded-2 overflow-hidden"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            >
              <div
                className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-widest"
                style={{
                  borderBottom: '1px solid var(--hairline)',
                  color: 'var(--ink-3)',
                  background: 'var(--surface-sunk)',
                }}
              >
                {t('safety.key_controls')}
              </div>
              {sel.keyControls.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5"
                  style={{ borderTop: i === 0 ? 'none' : '1px solid var(--hairline)' }}
                >
                  <span
                    className="font-mono text-[11px] font-semibold flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-1"
                    style={{ background: 'var(--navy)', color: '#fff' }}
                  >
                    {i + 1}
                  </span>
                  <span className="text-[12.5px]" style={{ color: 'var(--ink-2)' }}>
                    {c}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Equipment tab ────────────────────────────────────────────────────────────

function EquipmentTab({ equipment, loading }: { equipment: SafetyEquipment[]; loading: boolean }) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const groups: { cat: 'FFA' | 'LSA' | 'OTH'; label: string }[] = [
    { cat: 'FFA', label: t('safety.ffa_label') },
    { cat: 'LSA', label: t('safety.lsa_label') },
    { cat: 'OTH', label: t('safety.other_safety') },
  ];

  const flagged = equipment.filter((e) => e.status !== 'green').length;

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
      <div className="grid gap-2 p-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          {
            label: t('safety.ffa_items'),
            value: equipment.filter((e) => e.category === 'FFA').length,
            sub: `${equipment.filter((e) => e.category === 'FFA' && e.status !== 'green').length} ${t('safety.flagged')}`,
          },
          {
            label: t('safety.lsa_items'),
            value: equipment.filter((e) => e.category === 'LSA').length,
            sub: `${equipment.filter((e) => e.category === 'LSA' && e.status !== 'green').length} ${t('safety.flagged')}`,
          },
          {
            label: t('safety.items_flagged'),
            value: flagged,
            sub: t('safety.require_attention'),
            accent: flagged > 0 ? 'var(--sig-amber)' : undefined,
          },
          {
            label: t('safety.total_items'),
            value: equipment.length,
            sub: t('safety.all_categories'),
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

      {groups.map(({ cat, label }) => {
        const items = equipment.filter((e) => e.category === cat);
        return (
          <div key={cat} className="px-4 pb-4">
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
                <span className="text-[12px] font-semibold">{label}</span>
                <Badge color="slate">
                  {cat} · {items.length} {t('safety.items')}
                </Badge>
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
                  {t('safety.log_check')}
                </button>
              </div>
              <div
                className="grid gap-2 px-4 py-2 text-[10.5px] font-semibold uppercase tracking-widest"
                style={{
                  gridTemplateColumns: '110px 1fr 180px 80px 110px 120px 90px',
                  background: 'var(--surface-sunk)',
                  color: 'var(--ink-3)',
                  borderBottom: '1px solid var(--hairline)',
                }}
              >
                <span>{t('safety.col_id')}</span>
                <span>{t('common.name')}</span>
                <span>{t('inventory.location')}</span>
                <span>{t('common.status')}</span>
                <span>{t('safety.last_check')}</span>
                <span>{t('certificates.next_survey')}</span>
                <span />
              </div>
              {items.length === 0 ? (
                <EmptyState msg={`No ${label.toLowerCase()} on file.`} />
              ) : (
                items.map((it) => (
                  <div
                    key={it.id}
                    className="grid gap-2 px-4 py-2.5 items-center"
                    style={{
                      gridTemplateColumns: '110px 1fr 180px 80px 110px 120px 90px',
                      borderTop: '1px solid var(--hairline)',
                    }}
                  >
                    <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                      {it.id}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-medium">{it.name}</div>
                      <div className="text-[10.5px]" style={{ color: 'var(--ink-3)' }}>
                        {it.quantity}
                      </div>
                    </div>
                    <span className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                      {it.location}
                    </span>
                    <Badge
                      color={
                        it.status === 'red' ? 'red' : it.status === 'amber' ? 'amber' : 'green'
                      }
                    >
                      {it.status === 'red' ? 'ATTN' : it.status === 'amber' ? 'CHECK' : 'OK'}
                    </Badge>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                      {it.lastCheck}
                    </span>
                    <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                      {it.nextCheck}
                    </span>
                    {it.flag ? (
                      <Badge color="amber">FLAG</Badge>
                    ) : (
                      <button
                        className="text-[11px] px-2 py-0.5 rounded-1 border justify-self-end"
                        style={{
                          background: 'var(--surface)',
                          borderColor: 'var(--border)',
                          cursor: 'pointer',
                          color: 'var(--ink-2)',
                        }}
                      >
                        {t('safety.check')}
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CAPA tab ─────────────────────────────────────────────────────────────────

function CapaTab({ capas, loading }: { capas: Capa[]; loading: boolean }) {
  const { t } = useTranslation();
  if (loading)
    return (
      <div className="flex-1 flex items-center justify-center">
        <Spinner />
      </div>
    );

  const stages: { id: CapaStage; label: string; color: string }[] = [
    { id: 'investigation', label: t('safety.investigation'), color: 'var(--sig-amber)' },
    { id: 'action', label: t('safety.action'), color: 'var(--sig-blue)' },
    { id: 'verification', label: t('safety.verification'), color: '#5E479F' },
    { id: 'closed', label: t('safety.closed'), color: 'var(--sig-green)' },
  ];

  const open = capas.filter((c) => c.stage !== 'closed').length;

  return (
    <div className="flex-1 overflow-y-auto min-h-0" style={{ background: 'var(--bg)' }}>
      <div className="grid gap-2 p-4" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {[
          {
            label: t('safety.open_capa'),
            value: open,
            sub: t('safety.in_progress'),
            accent: open > 0 ? 'var(--sig-amber)' : undefined,
          },
          { label: t('safety.avg_cycle_time'), value: '—', sub: t('safety.target_45d') },
          {
            label: t('safety.overdue_actions'),
            value: capas.filter((c) => c.daysLeft !== null && c.daysLeft < 0).length,
            sub: '',
          },
          {
            label: t('safety.closed'),
            value: capas.filter((c) => c.stage === 'closed').length,
            sub: t('safety.all_time'),
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

      {/* Kanban board */}
      <div className="px-4 pb-4 grid gap-3" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        {stages.map(({ id, label, color }) => {
          const items = capas.filter((c) => c.stage === id);
          return (
            <div
              key={id}
              className="rounded-2 overflow-hidden"
              style={{
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                borderTop: `3px solid ${color}`,
                minHeight: 200,
              }}
            >
              <div
                className="flex items-center gap-2 px-3 py-2.5"
                style={{ borderBottom: '1px solid var(--hairline)' }}
              >
                <span
                  className="text-[10.5px] font-semibold uppercase tracking-widest flex-1"
                  style={{ color: 'var(--ink-3)' }}
                >
                  {label}
                </span>
                <span
                  className="font-mono text-[10.5px] px-1.5 py-px rounded-[10px]"
                  style={{ background: 'var(--surface-2)', color: 'var(--ink-3)', fontWeight: 600 }}
                >
                  {items.length}
                </span>
              </div>
              <div className="p-2 flex flex-col gap-1.5">
                {items.length === 0 ? (
                  <div className="py-4 text-center text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {t('safety.no_items')}
                  </div>
                ) : (
                  items.map((c) => (
                    <div
                      key={c.id}
                      className="rounded-1 p-2.5"
                      style={{
                        background: 'var(--surface-2)',
                        border: '1px solid var(--border)',
                        borderLeft: `3px solid ${c.tone === 'red' ? 'var(--sig-red)' : c.tone === 'amber' ? 'var(--sig-amber)' : 'var(--sig-green)'}`,
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="font-mono text-[10.5px] font-medium"
                          style={{ color: 'var(--ink-2)' }}
                        >
                          {c.id}
                        </span>
                        <div className="flex-1" />
                        {c.daysLeft !== null && (
                          <span
                            className="font-mono text-[10px]"
                            style={{
                              color:
                                c.daysLeft <= 0
                                  ? 'var(--sig-red)'
                                  : c.daysLeft <= 7
                                    ? 'var(--sig-amber)'
                                    : 'var(--ink-3)',
                            }}
                          >
                            {c.daysLeft <= 0 ? `${-c.daysLeft}d late` : `${c.daysLeft}d`}
                          </span>
                        )}
                      </div>
                      <div
                        className="text-[11.5px] font-medium"
                        style={{ lineHeight: 1.3, marginBottom: 4 }}
                      >
                        {c.title}
                      </div>
                      <div
                        className="text-[10px]"
                        style={{ color: 'var(--ink-3)', marginBottom: 6 }}
                      >
                        {c.owner}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div
                          className="flex-1 rounded-[3px] overflow-hidden"
                          style={{ height: 4, background: 'var(--hairline)' }}
                        >
                          <div
                            style={{
                              width: `${(c.doneActions / Math.max(c.totalActions, 1)) * 100}%`,
                              height: '100%',
                              background:
                                c.tone === 'red'
                                  ? 'var(--sig-red)'
                                  : c.tone === 'amber'
                                    ? 'var(--sig-amber)'
                                    : 'var(--sig-green)',
                            }}
                          />
                        </div>
                        <span
                          className="font-mono text-[10px]"
                          style={{ color: 'var(--ink-3)', flexShrink: 0 }}
                        >
                          {c.doneActions}/{c.totalActions}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function SafetyPage() {
  const { t } = useTranslation();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'permit';
  const setTab = (tabId: Tab) => setParams(tabId === 'permit' ? {} : { tab: tabId });

  const [permits, setPermits] = useState<WorkPermit[]>([]);
  const [findings, setFindings] = useState<SafetyFinding[]>([]);
  const [jhas, setJhas] = useState<JHA[]>([]);
  const [equipment, setEquipment] = useState<SafetyEquipment[]>([]);
  const [capas, setCapas] = useState<Capa[]>([]);
  const [loadP, setLoadP] = useState(true);
  const [loadF, setLoadF] = useState(true);
  const [loadJ, setLoadJ] = useState(true);
  const [loadE, setLoadE] = useState(true);
  const [loadC, setLoadC] = useState(true);

  const fetchAll = useCallback(() => {
    api
      .get<WorkPermit[]>('/work-permits')
      .then(setPermits)
      .catch(() => setPermits([]))
      .finally(() => setLoadP(false));
    api
      .get<SafetyFinding[]>('/safety-findings')
      .then(setFindings)
      .catch(() => setFindings([]))
      .finally(() => setLoadF(false));
    api
      .get<JHA[]>('/jhas')
      .then(setJhas)
      .catch(() => setJhas([]))
      .finally(() => setLoadJ(false));
    api
      .get<SafetyEquipment[]>('/safety-equipment')
      .then(setEquipment)
      .catch(() => setEquipment([]))
      .finally(() => setLoadE(false));
    api
      .get<Capa[]>('/capas')
      .then(setCapas)
      .catch(() => setCapas([]))
      .finally(() => setLoadC(false));
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const activePermits = permits.filter((p) => p.status === 'active').length;
  const awaitingPermits = permits.filter((p) => p.status === 'awaiting').length;

  const counts: Record<Tab, number> = {
    permit: permits.filter((p) => p.status !== 'closed').length,
    find: findings.filter((f) => f.status !== 'closed').length,
    jha: jhas.length,
    eq: equipment.filter((e) => e.status !== 'green').length,
    capa: capas.filter((c) => c.stage !== 'closed').length,
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
          {t('safety.title')}
        </h1>
        <span className="text-[12px]" style={{ color: 'var(--ink-3)' }}>
          ISM 2006
        </span>
        {activePermits > 0 && (
          <Badge color="green">
            {activePermits} {t('safety.status_active')}
          </Badge>
        )}
        {awaitingPermits > 0 && (
          <Badge color="amber">
            {awaitingPermits} {t('safety.status_awaiting')}
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
          {t('safety.toolbox_talk')}
        </button>
        <button
          className="px-3 py-1 rounded-2 text-[12px] font-medium"
          style={{ background: 'var(--navy)', color: '#fff', border: 'none', cursor: 'pointer' }}
        >
          {t('safety.new_permit')}
        </button>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-0 flex-shrink-0 px-4 overflow-x-auto"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        {(
          [
            { id: 'permit', label: t('safety.tab_permits') },
            { id: 'find', label: t('safety.tab_findings') },
            { id: 'jha', label: t('safety.tab_jha') },
            { id: 'eq', label: t('safety.tab_equipment') },
            { id: 'capa', label: t('safety.tab_capa') },
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

      {tab === 'permit' && <PermitsTab permits={permits} loading={loadP} />}
      {tab === 'find' && <FindingsTab findings={findings} loading={loadF} />}
      {tab === 'jha' && <JhaTab jhas={jhas} loading={loadJ} />}
      {tab === 'eq' && <EquipmentTab equipment={equipment} loading={loadE} />}
      {tab === 'capa' && <CapaTab capas={capas} loading={loadC} />}
    </div>
  );
}
