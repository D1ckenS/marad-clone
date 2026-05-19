import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../api/client.js';
import { useVessel } from '../context/useVessel.js';

// ── Types ────────────────────────────────────────────────────────────────────

interface Tank {
  id: string;
  name: string;
  tankType: string;
  capacityM3: number | null;
  framePosition: string | null;
}

interface TankReading {
  id: string;
  tankId: string;
  readingDate: string;
  quantityMt: number;
  quantityM3: number | null;
  notes: string | null;
}

interface Bdn {
  id: string;
  bdnNumber: string | null;
  deliveryDate: string;
  quantityMt: number;
  sulphurPct: number | null;
  grade: string | null;
  supplierName: string | null;
}

type Tab = 'tanks' | 'soundings' | 'bdn';

// ── Helpers ──────────────────────────────────────────────────────────────────

const SIG = {
  green: { bg: '#E2EEE6', fg: '#2F7D4F' },
  amber: { bg: '#F4E7D0', fg: '#B5731E' },
  neutral: { bg: '#F4F2EC', fg: '#41546A' },
} as const;

function TabBtn({
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

// ── Page ─────────────────────────────────────────────────────────────────────

export function FlgoPage() {
  const { t } = useTranslation();
  const { selectedVesselId } = useVessel();
  const [tab, setTab] = useState<Tab>('tanks');
  const [tanks, setTanks] = useState<Tank[]>([]);
  const [readings, setReadings] = useState<TankReading[]>([]);
  const [bdns, setBdns] = useState<Bdn[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedVesselId) return;
    setLoading(true);
    Promise.all([
      api.get<Tank[]>(`/tanks?vesselId=${selectedVesselId}`).catch(() => []),
      api.get<TankReading[]>(`/tank-readings?vesselId=${selectedVesselId}`).catch(() => []),
      api.get<Bdn[]>(`/bunker-delivery-notes?vesselId=${selectedVesselId}`).catch(() => []),
    ])
      .then(([t, r, b]) => {
        setTanks(t as Tank[]);
        setReadings(r as TankReading[]);
        setBdns(b as Bdn[]);
      })
      .finally(() => setLoading(false));
  }, [selectedVesselId]);

  if (!selectedVesselId) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '60vh',
          color: '#8893A0',
          fontSize: 13,
        }}
      >
        {t('flgo.select_vessel')}
      </div>
    );
  }

  // Index latest reading per tank
  const latestByTank: Record<string, TankReading> = {};
  for (const r of readings) {
    if (!latestByTank[r.tankId] || r.readingDate > latestByTank[r.tankId]!.readingDate) {
      latestByTank[r.tankId] = r;
    }
  }

  return (
    <div style={{ maxWidth: 1080, margin: '0 auto' }}>
      {/* Sub-header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 18,
          padding: '6px 8px',
          background: '#F4F2EC',
          borderRadius: 8,
          border: '1px solid #EEEBE2',
        }}
      >
        {(['tanks', 'soundings', 'bdn'] as Tab[]).map((tabId) => (
          <TabBtn
            key={tabId}
            label={
              tabId === 'tanks'
                ? t('flgo.tab_tanks')
                : tabId === 'soundings'
                  ? t('flgo.tab_soundings')
                  : t('flgo.tab_bdn')
            }
            active={tab === tabId}
            onClick={() => setTab(tabId)}
          />
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#8893A0', padding: 40 }}>
          {t('common.loading')}
        </div>
      ) : (
        <>
          {/* ── Tanks tab ───────────────────────────────────────────────── */}
          {tab === 'tanks' && (
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
                  display: 'grid',
                  gridTemplateColumns: '2fr 1fr 1fr 1fr',
                  padding: '8px 16px',
                  background: '#F4F2EC',
                  borderBottom: '1px solid #EEEBE2',
                }}
              >
                {[
                  t('flgo.col_tank'),
                  t('flgo.col_type'),
                  t('flgo.col_capacity'),
                  t('flgo.col_rob_mt'),
                ].map((h) => (
                  <span
                    key={h}
                    style={{
                      fontSize: 10.5,
                      fontWeight: 500,
                      color: '#8893A0',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>
              {tanks.length === 0 ? (
                <div
                  style={{
                    padding: '28px 16px',
                    textAlign: 'center',
                    color: '#8893A0',
                    fontSize: 12,
                  }}
                >
                  {t('flgo.no_tanks')}
                </div>
              ) : (
                tanks.map((t) => {
                  const rob = latestByTank[t.id]?.quantityMt;
                  const pct = rob != null && t.capacityM3 ? (rob / t.capacityM3) * 100 : null;
                  const { bg, fg } = pct != null && pct < 20 ? SIG.amber : SIG.green;
                  return (
                    <div
                      key={t.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '2fr 1fr 1fr 1fr',
                        alignItems: 'center',
                        padding: '10px 16px',
                        borderTop: '1px solid #EEEBE2',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: '#0A1F33' }}>
                        {t.name}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          background: SIG.neutral.bg,
                          color: SIG.neutral.fg,
                          padding: '2px 7px',
                          borderRadius: 4,
                          display: 'inline-block',
                        }}
                      >
                        {t.tankType}
                      </span>
                      <span style={{ fontSize: 12, color: '#41546A' }}>
                        {t.capacityM3 != null ? t.capacityM3.toFixed(1) : '—'}
                      </span>
                      <span>
                        {rob != null ? (
                          <span
                            style={{
                              background: bg,
                              color: fg,
                              fontSize: 12,
                              fontWeight: 500,
                              padding: '2px 8px',
                              borderRadius: 4,
                            }}
                          >
                            {rob.toFixed(2)} MT
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: '#8893A0' }}>—</span>
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ── Soundings tab ───────────────────────────────────────────── */}
          {tab === 'soundings' && (
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
                  display: 'grid',
                  gridTemplateColumns: '2fr 2fr 1fr 1fr',
                  padding: '8px 16px',
                  background: '#F4F2EC',
                  borderBottom: '1px solid #EEEBE2',
                }}
              >
                {[t('flgo.col_date'), t('flgo.col_tank'), t('flgo.col_mt'), t('flgo.col_m3')].map(
                  (h) => (
                    <span
                      key={h}
                      style={{
                        fontSize: 10.5,
                        fontWeight: 500,
                        color: '#8893A0',
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {h}
                    </span>
                  ),
                )}
              </div>
              {readings.length === 0 ? (
                <div
                  style={{
                    padding: '28px 16px',
                    textAlign: 'center',
                    color: '#8893A0',
                    fontSize: 12,
                  }}
                >
                  {t('flgo.no_soundings')}
                </div>
              ) : (
                [...readings]
                  .sort((a, b) => b.readingDate.localeCompare(a.readingDate))
                  .slice(0, 100)
                  .map((r) => {
                    const tank = tanks.find((t) => t.id === r.tankId);
                    return (
                      <div
                        key={r.id}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 2fr 1fr 1fr',
                          alignItems: 'center',
                          padding: '9px 16px',
                          borderTop: '1px solid #EEEBE2',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12,
                            color: '#0A1F33',
                            fontFamily: '"Geist Mono", monospace',
                          }}
                        >
                          {r.readingDate}
                        </span>
                        <span style={{ fontSize: 12, color: '#41546A' }}>
                          {tank?.name ?? r.tankId.slice(-8)}
                        </span>
                        <span style={{ fontSize: 12, color: '#0A1F33', fontWeight: 500 }}>
                          {Number(r.quantityMt).toFixed(2)}
                        </span>
                        <span style={{ fontSize: 12, color: '#41546A' }}>
                          {r.quantityM3 != null ? Number(r.quantityM3).toFixed(2) : '—'}
                        </span>
                      </div>
                    );
                  })
              )}
            </div>
          )}

          {/* ── BDN tab ─────────────────────────────────────────────────── */}
          {tab === 'bdn' && (
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
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                  padding: '8px 16px',
                  background: '#F4F2EC',
                  borderBottom: '1px solid #EEEBE2',
                }}
              >
                {[
                  t('flgo.col_date'),
                  t('flgo.col_bdn_no'),
                  t('flgo.col_qty_mt'),
                  t('flgo.col_sulphur'),
                  t('flgo.col_grade'),
                ].map((h) => (
                  <span
                    key={h}
                    style={{
                      fontSize: 10.5,
                      fontWeight: 500,
                      color: '#8893A0',
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {h}
                  </span>
                ))}
              </div>
              {bdns.length === 0 ? (
                <div
                  style={{
                    padding: '28px 16px',
                    textAlign: 'center',
                    color: '#8893A0',
                    fontSize: 12,
                  }}
                >
                  {t('flgo.no_bdn')}
                </div>
              ) : (
                [...bdns]
                  .sort((a, b) => b.deliveryDate.localeCompare(a.deliveryDate))
                  .map((b) => (
                    <div
                      key={b.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr',
                        alignItems: 'center',
                        padding: '9px 16px',
                        borderTop: '1px solid #EEEBE2',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12,
                          color: '#0A1F33',
                          fontFamily: '"Geist Mono", monospace',
                        }}
                      >
                        {b.deliveryDate}
                      </span>
                      <span style={{ fontSize: 12, color: '#41546A' }}>{b.bdnNumber ?? '—'}</span>
                      <span style={{ fontSize: 12, fontWeight: 500, color: '#0A1F33' }}>
                        {Number(b.quantityMt).toFixed(2)}
                      </span>
                      <span style={{ fontSize: 12, color: '#41546A' }}>
                        {b.sulphurPct != null ? `${b.sulphurPct}%` : '—'}
                      </span>
                      <span style={{ fontSize: 12, color: '#41546A' }}>{b.grade ?? '—'}</span>
                    </div>
                  ))
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
