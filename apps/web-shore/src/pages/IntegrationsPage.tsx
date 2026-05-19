import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface SsoConfig {
  provider: 'ENTRA' | 'GOOGLE';
  discoveryUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  enabled: boolean;
}

const GOOGLE_DISCOVERY_URL = 'https://accounts.google.com';
const DEFAULT_REDIRECT_URI =
  typeof window !== 'undefined' ? `${window.location.origin}/auth/callback` : '';

interface TechLibraryConfig {
  provider: 'TWO_BA' | 'NARETO';
  apiKey: string;
  endpoint: string | null;
  enabled: boolean;
}

interface AccountingConfig {
  provider: string;
  enabled: boolean;
}

type Tab = 'sso' | 'tech-library' | 'accounting' | 'class-societies';

const CLASS_SOCIETIES = ['DNV', 'ABS', 'LR', 'RINA', 'BV', 'NK'] as const;
type ClassSociety = (typeof CLASS_SOCIETIES)[number];
const SOCIETY_NAMES: Record<ClassSociety, string> = {
  DNV: 'DNV',
  ABS: 'ABS',
  LR: "Lloyd's Register",
  RINA: 'RINA',
  BV: 'Bureau Veritas',
  NK: 'Nippon Kaiji Kyokai',
};
const REPORT_TYPES = ['PMS_EVIDENCE', 'CERTIFICATES', 'FINDINGS', 'SURVEY_STATUS'] as const;
type ReportType = (typeof REPORT_TYPES)[number];
const REPORT_LABELS: Record<ReportType, string> = {
  PMS_EVIDENCE: 'PMS Evidence (CG-0339)',
  CERTIFICATES: 'Certificate Status',
  FINDINGS: 'Findings & CAPA',
  SURVEY_STATUS: 'Survey Status',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
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
          padding: '11px 16px',
          borderBottom: '1px solid #EEEBE2',
          background: '#F4F2EC',
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 600, color: '#0A1F33' }}>{title}</span>
      </div>
      <div style={{ padding: '16px' }}>{children}</div>
    </div>
  );
}

function LabeledInput({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label
        style={{
          display: 'block',
          fontSize: 11,
          fontWeight: 600,
          color: '#41546A',
          marginBottom: 5,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '8px 10px',
          border: '1px solid #E5E3DA',
          borderRadius: 6,
          fontSize: 13,
          color: '#0A1F33',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {hint && <p style={{ fontSize: 11, color: '#8893A0', marginTop: 4 }}>{hint}</p>}
    </div>
  );
}

function SaveBtn({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <button
      onClick={onClick}
      disabled={loading}
      style={{
        padding: '8px 20px',
        background: '#0A1F33',
        color: '#fff',
        border: 'none',
        borderRadius: 7,
        fontSize: 12.5,
        fontWeight: 500,
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
      }}
    >
      {loading ? t('common.saving') : t('common.save')}
    </button>
  );
}

function StatusBadge({ ok }: { ok: boolean }) {
  const { t } = useTranslation();
  return (
    <span
      style={{
        background: ok ? '#E2EEE6' : '#F4F2EC',
        color: ok ? '#2F7D4F' : '#8893A0',
        fontSize: 10.5,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 4,
      }}
    >
      {ok ? t('common.configured') : t('common.not_configured')}
    </span>
  );
}

// ── SSO Tab ──────────────────────────────────────────────────────────────────

function SsoTab() {
  const { t } = useTranslation();
  const [configs, setConfigs] = useState<SsoConfig[]>([]);

  useEffect(() => {
    api
      .get<SsoConfig[]>('/auth/oidc/configs')
      .then((cs) => setConfigs(Array.isArray(cs) ? cs : []))
      .catch(() => {});
  }, []);

  const entra = configs.find((c) => c.provider === 'ENTRA');
  const google = configs.find((c) => c.provider === 'GOOGLE');

  return (
    <>
      <SectionCard title={t('integrations.entra_title')}>
        <p style={{ fontSize: 12.5, color: '#41546A', marginBottom: 16 }}>
          {t('integrations.entra_desc')}{' '}
          <a
            href="https://learn.microsoft.com/en-us/entra/identity-platform/quickstart-register-app"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#1F5B9D' }}
          >
            {t('integrations.entra_docs')}
          </a>
        </p>
        <ProviderForm
          providerKey="ENTRA"
          initial={entra}
          buildDiscoveryUrl={(dirId) =>
            dirId ? `https://login.microsoftonline.com/${dirId}/v2.0` : ''
          }
        />
      </SectionCard>

      <SectionCard title={t('integrations.google_title')}>
        <p style={{ fontSize: 12.5, color: '#41546A', marginBottom: 16 }}>
          {t('integrations.google_desc')}{' '}
          <a
            href="https://developers.google.com/identity/openid-connect/openid-connect#appsetup"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: '#1F5B9D' }}
          >
            {t('integrations.google_docs')}
          </a>
        </p>
        <ProviderForm providerKey="GOOGLE" initial={google} discoveryUrl={GOOGLE_DISCOVERY_URL} />
      </SectionCard>

      <SectionCard title={t('integrations.how_sso_works')}>
        <ol
          style={{ fontSize: 12.5, color: '#41546A', lineHeight: 1.7, paddingLeft: 18, margin: 0 }}
        >
          <li>{t('integrations.sso_step1')}</li>
          <li>{t('integrations.sso_step2')}</li>
          <li>{t('integrations.sso_step3')}</li>
          <li>{t('integrations.sso_step4')}</li>
          <li>{t('integrations.sso_step5')}</li>
        </ol>
      </SectionCard>
    </>
  );
}

// ── Reusable provider form ────────────────────────────────────────────────────

function ProviderForm({
  providerKey,
  initial,
  discoveryUrl: fixedDiscoveryUrl,
  buildDiscoveryUrl,
}: {
  providerKey: 'ENTRA' | 'GOOGLE';
  initial: SsoConfig | undefined;
  discoveryUrl?: string | undefined;
  buildDiscoveryUrl?: ((dirId: string) => string) | undefined;
}) {
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [clientSecret, setClientSecret] = useState(initial?.clientSecret ?? '');
  const [redirectUri, setRedirectUri] = useState(initial?.redirectUri ?? DEFAULT_REDIRECT_URI);
  const [dirId, setDirId] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      const discoveryUrl = fixedDiscoveryUrl ?? (buildDiscoveryUrl ? buildDiscoveryUrl(dirId) : '');
      if (!discoveryUrl) {
        setMsg('Enter the Directory (Tenant) ID to construct the discovery URL.');
        return;
      }
      await api.post('/auth/oidc/config', {
        provider: providerKey,
        discoveryUrl,
        clientId,
        clientSecret,
        redirectUri,
        enabled: true,
      });
      setMsg('Saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const { t } = useTranslation();

  return (
    <div>
      {buildDiscoveryUrl && (
        <LabeledInput
          label={t('integrations.tenant_id')}
          value={dirId}
          onChange={setDirId}
          placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
          hint={t('integrations.tenant_id_hint')}
        />
      )}
      <LabeledInput
        label={t('integrations.client_id')}
        value={clientId}
        onChange={setClientId}
        placeholder={
          providerKey === 'GOOGLE'
            ? '123456789-abc.apps.googleusercontent.com'
            : 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
        }
      />
      <LabeledInput
        label={t('integrations.client_secret')}
        type="password"
        value={clientSecret}
        onChange={setClientSecret}
        placeholder={t('integrations.client_secret_placeholder')}
      />
      <LabeledInput
        label={t('integrations.redirect_uri')}
        value={redirectUri}
        onChange={setRedirectUri}
        placeholder={DEFAULT_REDIRECT_URI}
        hint={t('integrations.redirect_uri_hint')}
      />
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 8 }}
      >
        <StatusBadge ok={Boolean(clientId && clientSecret)} />
        {msg && (
          <span
            style={{
              fontSize: 12,
              color: msg === 'Saved.' ? '#2F7D4F' : '#AB382E',
            }}
          >
            {msg}
          </span>
        )}
      </div>
      <SaveBtn loading={saving} onClick={save} />
    </div>
  );
}

// ── Tech Library Tab ─────────────────────────────────────────────────────────

function TechLibraryTab() {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<Partial<TechLibraryConfig>>({ provider: 'TWO_BA' });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<TechLibraryConfig | null>('/tech-library/config')
      .then((c) => {
        if (c) setCfg(c);
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api.post('/tech-library/config', cfg);
      setMsg(t('integrations.saved'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <SectionCard title={t('integrations.tech_library_title')}>
      <p style={{ fontSize: 12.5, color: '#41546A', marginBottom: 16 }}>
        {t('integrations.tech_library_desc')}
      </p>
      <div style={{ marginBottom: 14 }}>
        <label
          style={{
            display: 'block',
            fontSize: 11,
            fontWeight: 600,
            color: '#41546A',
            marginBottom: 5,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          }}
        >
          {t('integrations.provider')}
        </label>
        <select
          value={cfg.provider ?? 'TWO_BA'}
          onChange={(e) =>
            setCfg((c) => ({ ...c, provider: e.target.value as 'TWO_BA' | 'NARETO' }))
          }
          style={{
            padding: '8px 10px',
            border: '1px solid #E5E3DA',
            borderRadius: 6,
            fontSize: 13,
            color: '#0A1F33',
          }}
        >
          <option value="TWO_BA">2BA (2ba.nl)</option>
          <option value="NARETO">Nareto</option>
        </select>
      </div>
      <LabeledInput
        label={t('integrations.api_key')}
        type="password"
        value={cfg.apiKey ?? ''}
        onChange={(v) => setCfg((c) => ({ ...c, apiKey: v }))}
        placeholder={t('integrations.api_key_placeholder')}
      />
      <LabeledInput
        label={t('integrations.custom_endpoint')}
        value={cfg.endpoint ?? ''}
        onChange={(v) => setCfg((c) => ({ ...c, endpoint: v || null }))}
        placeholder={t('integrations.custom_endpoint_hint')}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <StatusBadge ok={Boolean(cfg.apiKey)} />
        {msg && (
          <span
            style={{
              fontSize: 12,
              color: msg.includes('failed') ? '#AB382E' : '#2F7D4F',
            }}
          >
            {msg}
          </span>
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <SaveBtn loading={saving} onClick={save} />
      </div>
    </SectionCard>
  );
}

// ── Accounting Tab ───────────────────────────────────────────────────────────

function AccountingTab() {
  const { t } = useTranslation();
  const [cfg, setCfg] = useState<Partial<AccountingConfig>>({ provider: 'CSV' });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [exportFrom, setExportFrom] = useState(() => `${new Date().getFullYear()}-01-01`);
  const [exportTo, setExportTo] = useState(() => new Date().toISOString().split('T')[0]!);
  const [exportFormat, setExportFormat] = useState<'csv' | 'exact' | 'xlsx'>('xlsx');

  useEffect(() => {
    api
      .get<AccountingConfig | null>('/accounting/config')
      .then((c) => {
        if (c) setCfg(c);
      })
      .catch(() => {});
  }, []);

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api.post('/accounting/config', cfg);
      setMsg(t('integrations.saved'));
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  function triggerExport() {
    setExporting(true);
    const params = new URLSearchParams({ from: exportFrom, to: exportTo, format: exportFormat });
    const url = `/api/v1/accounting/export-pos?${params}`;
    const a = document.createElement('a');
    a.href = url;
    a.download =
      exportFormat === 'xlsx'
        ? 'purchase-orders.xlsx'
        : exportFormat === 'csv'
          ? 'purchase-orders.csv'
          : 'purchase-orders-exact.xml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => setExporting(false), 1500);
  }

  return (
    <>
      <SectionCard title={t('integrations.accounting_title')}>
        <p style={{ fontSize: 12.5, color: '#41546A', marginBottom: 16 }}>
          {t('integrations.accounting_desc')}
        </p>
        <div style={{ marginBottom: 14 }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              fontWeight: 600,
              color: '#41546A',
              marginBottom: 5,
              letterSpacing: '0.05em',
              textTransform: 'uppercase',
            }}
          >
            {t('integrations.accounting_system')}
          </label>
          <select
            value={cfg.provider ?? 'CSV'}
            onChange={(e) => setCfg((c) => ({ ...c, provider: e.target.value }))}
            style={{
              padding: '8px 10px',
              border: '1px solid #E5E3DA',
              borderRadius: 6,
              fontSize: 13,
              color: '#0A1F33',
            }}
          >
            <option value="CSV">CSV Export (generic)</option>
            <option value="EXACT">Exact Online</option>
            <option value="TWINFIELD">Twinfield</option>
            <option value="SAP">SAP</option>
            <option value="NETSUITE">NetSuite</option>
          </select>
        </div>
        {msg && (
          <p
            style={{
              fontSize: 12,
              color: msg.includes('failed') ? '#AB382E' : '#2F7D4F',
              marginBottom: 12,
            }}
          >
            {msg}
          </p>
        )}
        <SaveBtn loading={saving} onClick={save} />
      </SectionCard>

      <SectionCard title={t('integrations.export_pos')}>
        <p style={{ fontSize: 12.5, color: '#41546A', marginBottom: 16 }}>
          {t('integrations.export_pos_desc')}
        </p>
        <div
          style={{
            display: 'flex',
            gap: 12,
            flexWrap: 'wrap',
            alignItems: 'flex-end',
            marginBottom: 16,
          }}
        >
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: '#41546A',
                marginBottom: 5,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {t('integrations.from')}
            </label>
            <input
              type="date"
              value={exportFrom}
              onChange={(e) => setExportFrom(e.target.value)}
              style={{
                padding: '7px 10px',
                border: '1px solid #E5E3DA',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: '#41546A',
                marginBottom: 5,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {t('integrations.to')}
            </label>
            <input
              type="date"
              value={exportTo}
              onChange={(e) => setExportTo(e.target.value)}
              style={{
                padding: '7px 10px',
                border: '1px solid #E5E3DA',
                borderRadius: 6,
                fontSize: 13,
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: '#41546A',
                marginBottom: 5,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
              }}
            >
              {t('integrations.format')}
            </label>
            <select
              value={exportFormat}
              onChange={(e) => setExportFormat(e.target.value as 'csv' | 'exact' | 'xlsx')}
              style={{
                padding: '7px 10px',
                border: '1px solid #E5E3DA',
                borderRadius: 6,
                fontSize: 13,
                color: '#0A1F33',
              }}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV</option>
              <option value="exact">Exact Online XML</option>
            </select>
          </div>
        </div>
        <button
          onClick={triggerExport}
          disabled={exporting}
          style={{
            padding: '8px 20px',
            background: '#0A1F33',
            color: '#fff',
            border: 'none',
            borderRadius: 7,
            fontSize: 12.5,
            fontWeight: 500,
            cursor: exporting ? 'not-allowed' : 'pointer',
            opacity: exporting ? 0.7 : 1,
          }}
        >
          {exporting ? t('integrations.downloading') : t('integrations.download_export')}
        </button>
      </SectionCard>
    </>
  );
}

// ── Class Societies Tab ───────────────────────────────────────────────────────

interface ClassConnector {
  id: string;
  society: ClassSociety;
  apiKey: string | null;
  apiEndpoint: string | null;
  vesselRegistrations: Record<string, string>;
  enabled: boolean;
}

interface ClassSubmission {
  id: string;
  society: ClassSociety;
  reportType: ReportType;
  status: string;
  submittedAt: string | null;
  responseCode: number | null;
  responseMessage: string | null;
  createdAt: string;
}

function ClassSocietiesTab() {
  const { t } = useTranslation();
  const [connectors, setConnectors] = useState<ClassConnector[]>([]);
  const [submissions, setSubmissions] = useState<ClassSubmission[]>([]);
  const [activeSociety, setActiveSociety] = useState<ClassSociety>('DNV');
  const [editApi, setEditApi] = useState('');
  const [editEndpoint, setEditEndpoint] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedVesselId, setSelectedVesselId] = useState('');
  const [selectedReport, setSelectedReport] = useState<ReportType>('PMS_EVIDENCE');
  const [msg, setMsg] = useState<string | null>(null);
  const [vessels, setVessels] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      api.get<ClassConnector[]>('/class-society/connectors').catch(() => []),
      api.get<ClassSubmission[]>('/class-society/submissions').catch(() => []),
      api.get<{ id: string; name: string }[]>('/vessels').catch(() => []),
    ]).then(([c, s, v]) => {
      setConnectors(Array.isArray(c) ? c : []);
      setSubmissions(Array.isArray(s) ? s : []);
      setVessels(Array.isArray(v) ? v : []);
      if (Array.isArray(v) && v.length > 0) setSelectedVesselId(v[0]!.id);
    });
  }, []);

  const active = connectors.find((c) => c.society === activeSociety);

  useEffect(() => {
    setEditApi(active?.apiKey ?? '');
    setEditEndpoint(active?.apiEndpoint ?? '');
  }, [activeSociety, active]);

  async function saveConnector() {
    setSaving(true);
    setMsg(null);
    try {
      const saved = await api.post<ClassConnector>('/class-society/connectors', {
        society: activeSociety,
        apiKey: editApi || null,
        apiEndpoint: editEndpoint || null,
        enabled: true,
      });
      setConnectors((prev) => {
        const idx = prev.findIndex((c) => c.society === activeSociety);
        return idx >= 0 ? prev.map((c, i) => (i === idx ? saved : c)) : [...prev, saved];
      });
      setMsg('Saved.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function submit(doSubmit: boolean) {
    if (!selectedVesselId) {
      setMsg('Select a vessel first.');
      return;
    }
    setSubmitting(true);
    setMsg(null);
    try {
      const rec = await api.post<ClassSubmission>('/class-society/submit', {
        vesselId: selectedVesselId,
        society: activeSociety,
        reportType: selectedReport,
        submit: doSubmit,
      });
      setSubmissions((prev) => [rec, ...prev]);
      setMsg(
        doSubmit
          ? `Submitted — status: ${rec.status}${rec.responseCode ? ` (HTTP ${rec.responseCode})` : ''}`
          : 'Report package saved as DRAFT.',
      );
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Failed');
    } finally {
      setSubmitting(false);
    }
  }

  function downloadExport() {
    if (!selectedVesselId) return;
    const params = new URLSearchParams({
      vesselId: selectedVesselId,
      society: activeSociety,
      reportType: selectedReport,
    });
    const a = document.createElement('a');
    a.href = `/api/v1/class-society/export?${params}`;
    a.download = `${activeSociety.toLowerCase()}-report.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  const STATUS_COLOR: Record<string, { bg: string; fg: string }> = {
    DRAFT: { bg: '#F4F2EC', fg: '#41546A' },
    SUBMITTED: { bg: '#DFE8F4', fg: '#1F5B9D' },
    ACCEPTED: { bg: '#E2EEE6', fg: '#2F7D4F' },
    REJECTED: { bg: '#F2DDD8', fg: '#AB382E' },
    ERROR: { bg: '#F2DDD8', fg: '#AB382E' },
  };

  return (
    <div
      style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'start' }}
    >
      {/* Society selector */}
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
            padding: '9px 12px',
            background: '#F4F2EC',
            borderBottom: '1px solid #EEEBE2',
            fontSize: 10.5,
            fontWeight: 600,
            color: '#8893A0',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}
        >
          {t('integrations.society_label')}
        </div>
        {CLASS_SOCIETIES.map((s) => {
          const configured = connectors.some((c) => c.society === s && c.apiKey);
          return (
            <button
              key={s}
              onClick={() => setActiveSociety(s)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                padding: '9px 12px',
                borderTop: '1px solid #EEEBE2',
                border: 'none',
                background: activeSociety === s ? '#EFEDE6' : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 500, color: '#0A1F33' }}>{s}</span>
              {configured && (
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#2F7D4F',
                    flexShrink: 0,
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Right panel */}
      <div>
        <SectionCard title={`${activeSociety} — ${SOCIETY_NAMES[activeSociety]}`}>
          <p style={{ fontSize: 12.5, color: '#41546A', marginBottom: 14 }}>
            Configure API credentials to enable direct submission to {SOCIETY_NAMES[activeSociety]}
            's digital platform. Without credentials, reports can still be exported as JSON for
            manual upload.
          </p>
          <LabeledInput
            label="API Key"
            type="password"
            value={editApi}
            onChange={setEditApi}
            placeholder={`Your ${activeSociety} platform API key`}
          />
          <LabeledInput
            label="API Endpoint (optional)"
            value={editEndpoint}
            onChange={setEditEndpoint}
            placeholder="Leave blank to use default"
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
            <StatusBadge ok={Boolean(active?.apiKey)} />
            {msg && (
              <span
                style={{
                  fontSize: 12,
                  color:
                    msg === 'Saved.' || msg.includes('DRAFT') || msg.includes('status')
                      ? '#2F7D4F'
                      : '#AB382E',
                }}
              >
                {msg}
              </span>
            )}
          </div>
          <SaveBtn loading={saving} onClick={saveConnector} />
        </SectionCard>

        <SectionCard title={t('integrations.submit_report')}>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#41546A',
                  marginBottom: 5,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {t('integrations.vessel_label')}
              </label>
              <select
                value={selectedVesselId}
                onChange={(e) => setSelectedVesselId(e.target.value)}
                style={{
                  padding: '7px 10px',
                  border: '1px solid #E5E3DA',
                  borderRadius: 6,
                  fontSize: 13,
                  color: '#0A1F33',
                }}
              >
                {vessels.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: 11,
                  fontWeight: 600,
                  color: '#41546A',
                  marginBottom: 5,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                }}
              >
                {t('integrations.report_type')}
              </label>
              <select
                value={selectedReport}
                onChange={(e) => setSelectedReport(e.target.value as ReportType)}
                style={{
                  padding: '7px 10px',
                  border: '1px solid #E5E3DA',
                  borderRadius: 6,
                  fontSize: 13,
                  color: '#0A1F33',
                }}
              >
                {REPORT_TYPES.map((r) => (
                  <option key={r} value={r}>
                    {REPORT_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              onClick={() => submit(true)}
              disabled={submitting || !active?.apiKey}
              title={!active?.apiKey ? 'Configure API key first' : undefined}
              style={{
                padding: '8px 18px',
                background: '#0A1F33',
                color: '#fff',
                border: 'none',
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: submitting || !active?.apiKey ? 'not-allowed' : 'pointer',
                opacity: submitting || !active?.apiKey ? 0.5 : 1,
              }}
            >
              {submitting
                ? t('integrations.submitting')
                : `${t('integrations.submit_report')} ${activeSociety}`}
            </button>
            <button
              onClick={() => submit(false)}
              disabled={submitting}
              style={{
                padding: '8px 18px',
                background: 'transparent',
                color: '#0A1F33',
                border: '1px solid #E5E3DA',
                borderRadius: 7,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {t('integrations.save_draft')}
            </button>
            <button
              onClick={downloadExport}
              disabled={!selectedVesselId}
              style={{
                padding: '8px 18px',
                background: 'transparent',
                color: '#41546A',
                border: '1px solid #E5E3DA',
                borderRadius: 7,
                fontSize: 12.5,
                cursor: !selectedVesselId ? 'not-allowed' : 'pointer',
              }}
            >
              {t('integrations.download_json')}
            </button>
          </div>
        </SectionCard>

        {/* Submission history */}
        {submissions.filter((s) => s.society === activeSociety).length > 0 && (
          <SectionCard title={t('integrations.submission_history')}>
            {submissions
              .filter((s) => s.society === activeSociety)
              .slice(0, 20)
              .map((s) => {
                const col = STATUS_COLOR[s.status] ?? STATUS_COLOR.DRAFT!;
                return (
                  <div
                    key={s.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr auto auto',
                      alignItems: 'center',
                      gap: 12,
                      padding: '9px 0',
                      borderBottom: '1px solid #EEEBE2',
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 12.5, color: '#0A1F33', fontWeight: 500 }}>
                        {REPORT_LABELS[s.reportType] ?? s.reportType}
                      </div>
                      <div style={{ fontSize: 11, color: '#8893A0' }}>
                        {new Date(s.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                        {s.responseCode ? ` · HTTP ${s.responseCode}` : ''}
                      </div>
                    </div>
                    <span
                      style={{
                        background: col.bg,
                        color: col.fg,
                        fontSize: 10.5,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 4,
                      }}
                    >
                      {s.status}
                    </span>
                  </div>
                );
              })}
          </SectionCard>
        )}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export function IntegrationsPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('sso');

  const tabs: { key: Tab; label: string }[] = [
    { key: 'sso', label: t('integrations.tab_sso') },
    { key: 'tech-library', label: t('integrations.tab_tech_library') },
    { key: 'accounting', label: t('integrations.tab_accounting') },
    { key: 'class-societies', label: t('integrations.tab_class') },
  ];

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <h1
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: '#0A1F33',
          marginBottom: 20,
          letterSpacing: '-0.011em',
        }}
      >
        {t('integrations.title')}
      </h1>

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
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '6px 14px',
              borderRadius: 6,
              border: 'none',
              background: tab === t.key ? '#0A1F33' : 'transparent',
              color: tab === t.key ? '#fff' : '#41546A',
              fontSize: 12.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'sso' && <SsoTab />}
      {tab === 'tech-library' && <TechLibraryTab />}
      {tab === 'accounting' && <AccountingTab />}
      {tab === 'class-societies' && <ClassSocietiesTab />}
    </div>
  );
}
