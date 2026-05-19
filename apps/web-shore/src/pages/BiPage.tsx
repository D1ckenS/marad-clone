import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { embedDashboard } from '@superset-ui/embedded-sdk';
import { api } from '../api/client.js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Dashboard {
  id: string;
  supersetDashboardId: string;
  title: string;
  description: string | null;
  category: string | null;
  sortOrder: number;
  enabled: boolean;
}

interface BiConfig {
  supersetUrl: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CATEGORY_ICONS: Record<string, string> = {
  Maintenance: '🔧',
  Inventory: '📦',
  Purchase: '🛒',
  Certificates: '📋',
  Safety: '⚠️',
  Crewing: '👥',
  FLGO: '⛽',
  Fleet: '🚢',
};

function categoryIcon(cat: string | null) {
  return cat ? (CATEGORY_ICONS[cat] ?? '📊') : '📊';
}

const SIG = {
  green: { bg: '#E2EEE6', fg: '#2F7D4F' },
  amber: { bg: '#F4E7D0', fg: '#B5731E' },
  blue: { bg: '#DFE8F4', fg: '#1F5B9D' },
  neutral: { bg: '#F4F2EC', fg: '#41546A' },
} as const;

// ── Embedded viewer ───────────────────────────────────────────────────────────

function EmbeddedDashboard({
  dashboard,
  supersetUrl,
  onBack,
}: {
  dashboard: Dashboard;
  supersetUrl: string;
  onBack: () => void;
}) {
  const { t } = useTranslation();
  const mountRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mountRef.current) return;
    let cancelled = false;

    const mount = mountRef.current;

    embedDashboard({
      id: dashboard.supersetDashboardId,
      supersetDomain: supersetUrl,
      mountPoint: mount,
      fetchGuestToken: async () => {
        const res = await api.get<{ token: string }>(`/bi/guest-token/${dashboard.id}`);
        return res.token;
      },
      dashboardUiConfig: {
        hideTitle: true,
        hideChartControls: false,
        filters: { visible: true, expanded: false },
      },
    })
      .then(() => {
        if (!cancelled) setLoading(false);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load dashboard');
        setLoading(false);
      });

    return () => {
      cancelled = true;
      // Remove any iframe the SDK injected
      while (mount.firstChild) mount.removeChild(mount.firstChild);
    };
  }, [dashboard.id, dashboard.supersetDashboardId, supersetUrl]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 0',
          marginBottom: 12,
          borderBottom: '1px solid #EEEBE2',
        }}
      >
        <button
          onClick={onBack}
          style={{
            background: 'none',
            border: '1px solid #E5E3DA',
            borderRadius: 6,
            padding: '5px 12px',
            fontSize: 12.5,
            color: '#41546A',
            cursor: 'pointer',
          }}
        >
          ← {t('common.back')}
        </button>
        <span style={{ fontSize: 15, fontWeight: 600, color: '#0A1F33' }}>
          {categoryIcon(dashboard.category)} {dashboard.title}
        </span>
        {dashboard.description && (
          <span style={{ fontSize: 12, color: '#8893A0' }}>{dashboard.description}</span>
        )}
      </div>

      {/* Embed area */}
      {error ? (
        <div
          style={{
            background: '#F2DDD8',
            borderRadius: 8,
            padding: '20px 24px',
            color: '#AB382E',
            fontSize: 13,
          }}
        >
          <strong>{t('analytics.load_error')}</strong> {error}
          <p style={{ marginTop: 8, fontSize: 12, color: '#8893A0' }}>
            Make sure Superset is running at <code>{supersetUrl}</code> and the dashboard ID{' '}
            <code>{dashboard.supersetDashboardId}</code> exists.
          </p>
        </div>
      ) : (
        <div style={{ position: 'relative', flex: 1, minHeight: 600 }}>
          {loading && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#FAFAF7',
                color: '#8893A0',
                fontSize: 13,
              }}
            >
              {t('common.loading')}
            </div>
          )}
          <div ref={mountRef} style={{ width: '100%', height: '100%', minHeight: 600 }} />
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function BiPage() {
  const { t } = useTranslation();
  const [dashboards, setDashboards] = useState<Dashboard[]>([]);
  const [config, setConfig] = useState<BiConfig | null>(null);
  const [selected, setSelected] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get<Dashboard[]>('/bi/dashboards').catch(() => []),
      api.get<BiConfig>('/bi/config').catch(() => ({ supersetUrl: null })),
    ]).then(([d, c]) => {
      setDashboards(Array.isArray(d) ? d : []);
      setConfig(c);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div
        style={{
          height: '60vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#8893A0',
          fontSize: 13,
        }}
      >
        {t('common.loading')}
      </div>
    );
  }

  // Embedded view
  if (selected && config?.supersetUrl) {
    return (
      <EmbeddedDashboard
        dashboard={selected}
        supersetUrl={config.supersetUrl}
        onBack={() => setSelected(null)}
      />
    );
  }

  // ── Not configured ─────────────────────────────────────────────────────────
  if (!config?.supersetUrl) {
    return (
      <div style={{ maxWidth: 620, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0A1F33', marginBottom: 8 }}>
          {t('analytics.not_configured')}
        </h2>
        <p style={{ fontSize: 13, color: '#8893A0', lineHeight: 1.6, marginBottom: 24 }}>
          FleetOps embeds Apache Superset for interactive fleet analytics. To enable it:
        </p>
        <ol
          style={{
            textAlign: 'left',
            fontSize: 13,
            color: '#41546A',
            lineHeight: 1.8,
            paddingLeft: 20,
            marginBottom: 24,
          }}
        >
          <li>
            Start Superset:{' '}
            <code style={{ background: '#F4F2EC', padding: '1px 5px', borderRadius: 4 }}>
              docker compose -f infra/docker-compose.dev.yml up superset
            </code>
          </li>
          <li>
            Set{' '}
            <code style={{ background: '#F4F2EC', padding: '1px 5px', borderRadius: 4 }}>
              SUPERSET_URL=http://localhost:8088
            </code>{' '}
            in{' '}
            <code style={{ background: '#F4F2EC', padding: '1px 5px', borderRadius: 4 }}>
              apps/api-shore/.env
            </code>{' '}
            and restart the API.
          </li>
          <li>
            Log in to Superset at <strong>http://localhost:8088</strong> (admin /
            fleetops_superset_dev), add a FleetOps database connection, create dashboards, and
            register them below.
          </li>
        </ol>
        <p style={{ fontSize: 12, color: '#8893A0' }}>
          Superset connects directly to the FleetOps PostgreSQL database on{' '}
          <code style={{ background: '#F4F2EC', padding: '1px 5px', borderRadius: 4 }}>
            postgresql://fleetops:fleetops_dev@host.docker.internal:5433/fleetops_shore
          </code>
        </p>
      </div>
    );
  }

  // ── No dashboards registered ───────────────────────────────────────────────
  if (dashboards.length === 0) {
    return (
      <div style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📊</div>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#0A1F33', marginBottom: 8 }}>
          {t('analytics.no_dashboards')}
        </h2>
        <p style={{ fontSize: 13, color: '#8893A0', lineHeight: 1.6 }}>
          Superset is running at <strong>{config.supersetUrl}</strong>. Create dashboards in
          Superset, then register them using the API (
          <code style={{ background: '#F4F2EC', padding: '1px 5px', borderRadius: 4 }}>
            POST /api/v1/bi/dashboards
          </code>
          ) or via your preferred admin tool.
        </p>
      </div>
    );
  }

  // ── Dashboard gallery ──────────────────────────────────────────────────────

  // Group by category
  const groups = dashboards.reduce<Record<string, Dashboard[]>>((acc, d) => {
    const key = d.category ?? 'General';
    (acc[key] ??= []).push(d);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 600,
            color: '#0A1F33',
            margin: '0 0 4px',
            letterSpacing: '-0.011em',
          }}
        >
          {t('nav.analytics')}
        </h1>
        <p style={{ fontSize: 13, color: '#8893A0', margin: 0 }}>{t('analytics.subtitle')}</p>
      </div>

      {Object.entries(groups).map(([category, cards]) => (
        <div key={category} style={{ marginBottom: 28 }}>
          <h2
            style={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#8893A0',
              marginBottom: 12,
            }}
          >
            {categoryIcon(category)} {category}
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
              gap: 12,
            }}
          >
            {cards.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d)}
                style={{
                  background: '#fff',
                  border: '1px solid #E5E3DA',
                  borderRadius: 10,
                  padding: '18px 20px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#0A1F33';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow =
                    '0 2px 8px rgba(10,31,51,0.08)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLButtonElement).style.borderColor = '#E5E3DA';
                  (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
                }}
              >
                <span style={{ fontSize: 22 }}>{categoryIcon(d.category)}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#0A1F33' }}>{d.title}</span>
                {d.description && (
                  <span style={{ fontSize: 12, color: '#8893A0', lineHeight: 1.5 }}>
                    {d.description}
                  </span>
                )}
                <span
                  style={{
                    marginTop: 4,
                    alignSelf: 'flex-start',
                    ...SIG.blue,
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                  }}
                >
                  {t('analytics.open_link')}
                </span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
