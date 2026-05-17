import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { CreatePartModal } from '../components/CreatePartModal.js';
import { EditPartModal, type PartItem } from '../components/EditPartModal.js';
import { AddStockLevelModal } from '../components/AddStockLevelModal.js';
import { PostStockMovementModal } from '../components/PostStockMovementModal.js';
import { ManageBarcodesModal } from '../components/ManageBarcodesModal.js';

// ── Types ──────────────────────────────────────────────────────────────────
interface StockLevel {
  id: string;
  locationId: string;
  locationName: string;
  minStock: string;
  maxStock: string | null;
  reorderPoint: string | null;
  rob: string;
  status: 'green' | 'amber' | 'red' | 'purple';
}
interface Part {
  id: string;
  partNumber: string | null;
  name: string;
  unit: string;
  description?: string | null;
  stockLevels: StockLevel[];
}
interface Location {
  id: string;
  name: string;
}
interface Movement {
  id: string;
  movementType: string;
  quantity: string;
  notes: string | null;
  recordedAt: string;
  locationId: string;
}

// ── Bearing palette ────────────────────────────────────────────────────────
const T = {
  green: '#2F7D4F',
  greenBg: '#E2EEE6',
  amber: '#B5731E',
  amberBg: '#F4E7D0',
  red: '#AB382E',
  redBg: '#F2DDD8',
  purple: '#5E479F',
  purpleBg: '#E7E0F1',
  ink: '#0A1F33',
  ink2: '#41546A',
  ink3: '#8893A0',
  ink4: '#B6BDC6',
  border: '#E5E3DA',
  hairline: '#EEEBE2',
  surface: '#fff',
  surface2: '#F4F2EC',
  surfaceSunk: '#EFEDE6',
  navy: '#0A1F33',
};
const STATUS_C = { green: T.green, amber: T.amber, red: T.red, purple: T.purple };
const STATUS_BG = { green: T.greenBg, amber: T.amberBg, red: T.redBg, purple: T.purpleBg };
const STATUS_LABEL = { green: 'IN STOCK', amber: 'BELOW MIN', red: 'AT REORDER', purple: 'ZERO' };
const MOVE_C: Record<string, string> = {
  RECEIPT: T.green,
  CONSUMPTION: T.red,
  ADJUSTMENT: T.amber,
  TRANSFER_IN: T.green,
  TRANSFER_OUT: T.red,
};
type StatusFilter = 'all' | 'green' | 'amber' | 'red' | 'purple';

function worstStatus(levels: StockLevel[]): StockLevel['status'] {
  if (!levels.length) return 'purple';
  for (const s of ['purple', 'red', 'amber'] as const) {
    if (levels.some((l) => l.status === s)) return s;
  }
  return 'green';
}

// ── Status dot ────────────────────────────────────────────────────────────
function Dot({ status }: { status: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        flexShrink: 0,
        background: STATUS_C[status as keyof typeof STATUS_C] ?? T.ink4,
      }}
    />
  );
}

// ── ROB stock bar (detail pane) ───────────────────────────────────────────
function StockBar({
  rob,
  min,
  max,
  reorder,
}: {
  rob: number;
  min: number;
  max: number;
  reorder: number;
}) {
  if (max <= 0) return null;
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  const robPct = Math.min(100, (rob / max) * 100);
  const robColor = rob <= reorder ? T.red : rob < min ? T.amber : T.ink;
  return (
    <div style={{ padding: '14px 16px 10px' }}>
      <div style={{ position: 'relative', height: 32 }}>
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 13,
            height: 6,
            background: T.surfaceSunk,
            borderRadius: 3,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: 0,
            width: pct(reorder),
            top: 13,
            height: 6,
            background: T.redBg,
            borderRadius: '3px 0 0 3px',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: pct(reorder),
            width: `calc(${pct(min)} - ${pct(reorder)})`,
            top: 13,
            height: 6,
            background: T.amberBg,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: pct(min),
            right: 0,
            top: 13,
            height: 6,
            background: T.greenBg,
            borderRadius: '0 3px 3px 0',
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${robPct}%`,
            top: 7,
            transform: 'translateX(-50%)',
            width: 2,
            height: 18,
            background: robColor,
            borderRadius: 1,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: `${robPct}%`,
            top: 0,
            transform: 'translateX(-50%)',
            fontFamily: '"Geist Mono",monospace',
            fontSize: 10,
            fontWeight: 700,
            color: robColor,
            whiteSpace: 'nowrap',
          }}
        >
          {rob}
        </div>
      </div>
      <div
        style={{
          position: 'relative',
          height: 14,
          fontSize: 9.5,
          fontFamily: '"Geist Mono",monospace',
          color: T.ink3,
          marginTop: 2,
        }}
      >
        <span style={{ position: 'absolute', left: 0 }}>0</span>
        {reorder > 0 && (
          <span style={{ position: 'absolute', left: pct(reorder), transform: 'translateX(-50%)' }}>
            reorder·{reorder}
          </span>
        )}
        <span style={{ position: 'absolute', left: pct(min), transform: 'translateX(-50%)' }}>
          min·{min}
        </span>
        <span style={{ position: 'absolute', right: 0 }}>max·{max}</span>
      </div>
    </div>
  );
}

// ── Detail pane ───────────────────────────────────────────────────────────
function DetailPane({
  part,
  onClose,
  onMovement,
  onStockConfig,
  onBarcodes,
}: {
  part: Part | null;
  onClose: () => void;
  onMovement: (id: string, name: string) => void;
  onStockConfig: (id: string, name: string) => void;
  onBarcodes: (id: string, name: string) => void;
}) {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [loadingMov, setLoadingMov] = useState(false);

  useEffect(() => {
    if (!part) return;
    setLoadingMov(true);
    api
      .get<Movement[]>(`/stock-movements?partId=${part.id}`)
      .then(setMovements)
      .catch(() => setMovements([]))
      .finally(() => setLoadingMov(false));
  }, [part?.id]);

  if (!part)
    return (
      <aside
        style={{
          width: 300,
          flexShrink: 0,
          background: T.surface,
          borderLeft: `1px solid ${T.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 24,
        }}
      >
        <p style={{ fontSize: 12.5, color: T.ink3, textAlign: 'center' }}>
          Click a part to see stock levels and movement history.
        </p>
      </aside>
    );

  const status = worstStatus(part.stockLevels);
  const first = part.stockLevels[0];
  const rob = first ? parseFloat(first.rob) : 0;
  const min = first ? parseFloat(first.minStock) : 0;
  const max = first ? parseFloat(first.maxStock ?? '0') : 0;
  const reorder = first ? parseFloat(first.reorderPoint ?? '0') : 0;

  return (
    <aside
      style={{
        width: 300,
        flexShrink: 0,
        background: T.surface,
        borderLeft: `1px solid ${T.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {/* Header */}
        <div style={{ padding: '14px 14px 12px', borderBottom: `1px solid ${T.hairline}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            {part.partNumber && (
              <span style={{ fontFamily: '"Geist Mono",monospace', fontSize: 10.5, color: T.ink3 }}>
                {part.partNumber}
              </span>
            )}
            <span
              style={{
                background: STATUS_BG[status],
                color: STATUS_C[status],
                fontSize: 10,
                fontWeight: 600,
                padding: '1px 6px',
                borderRadius: 3,
              }}
            >
              {STATUS_LABEL[status]}
            </span>
            <div style={{ flex: 1 }} />
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: T.ink3,
                fontSize: 18,
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: '-0.005em',
              color: T.ink,
            }}
          >
            {part.name}
          </h3>
          <p style={{ margin: '3px 0 0', fontSize: 11, color: T.ink3 }}>{part.unit}</p>
        </div>

        {/* Stock bar */}
        {first ? (
          <StockBar rob={rob} min={min} max={max} reorder={reorder} />
        ) : (
          <p style={{ padding: '14px 16px', fontSize: 12, color: T.ink3 }}>
            No stock levels configured.
          </p>
        )}

        {/* Per-location breakdown */}
        {part.stockLevels.length > 0 && (
          <div style={{ paddingBottom: 12 }}>
            <div
              style={{
                padding: '6px 16px 4px',
                fontSize: 10.5,
                fontWeight: 500,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: T.ink3,
              }}
            >
              Stock by location
            </div>
            {part.stockLevels.map((l) => (
              <div
                key={l.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 56px 36px',
                  gap: 8,
                  padding: '7px 16px',
                  borderTop: `1px solid ${T.hairline}`,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontSize: 12.5, color: T.ink, fontWeight: 500 }}>
                    {l.locationName}
                  </div>
                  <div
                    style={{ fontSize: 10, fontFamily: '"Geist Mono",monospace', color: T.ink3 }}
                  >
                    min {l.minStock} · max {l.maxStock ?? '—'}
                  </div>
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    justifyContent: 'flex-end',
                  }}
                >
                  <Dot status={l.status} />
                  <span
                    style={{
                      fontFamily: '"Geist Mono",monospace',
                      fontSize: 13,
                      fontWeight: 600,
                      color: STATUS_C[l.status],
                    }}
                  >
                    {parseFloat(l.rob).toFixed(1)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: T.ink3 }}>{part.unit}</div>
              </div>
            ))}
          </div>
        )}

        {/* Movement ledger */}
        <div style={{ borderTop: `1px solid ${T.hairline}`, paddingTop: 4 }}>
          <div
            style={{
              padding: '6px 16px 4px',
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: T.ink3,
            }}
          >
            Movements
          </div>
          {loadingMov && (
            <p style={{ padding: '8px 16px', fontSize: 11.5, color: T.ink3 }}>Loading…</p>
          )}
          {!loadingMov && movements.length === 0 && (
            <p style={{ padding: '8px 16px', fontSize: 11.5, color: T.ink3 }}>
              No movements recorded.
            </p>
          )}
          {movements.slice(0, 8).map((m) => {
            const qty = parseFloat(m.quantity);
            const tc = MOVE_C[m.movementType] ?? T.ink3;
            return (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 16px',
                  borderTop: `1px solid ${T.hairline}`,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      background: tc + '22',
                      color: tc,
                      padding: '1px 5px',
                      borderRadius: 3,
                      fontFamily: '"Geist Mono",monospace',
                    }}
                  >
                    {m.movementType.replace('_', ' ')}
                  </span>
                  {m.notes && (
                    <span style={{ fontSize: 10.5, color: T.ink3, marginLeft: 6 }}>{m.notes}</span>
                  )}
                  <div
                    style={{
                      fontSize: 10.5,
                      fontFamily: '"Geist Mono",monospace',
                      color: T.ink3,
                      marginTop: 2,
                    }}
                  >
                    {new Date(m.recordedAt).toLocaleDateString('en-GB', {
                      day: '2-digit',
                      month: 'short',
                      year: '2-digit',
                    })}
                  </div>
                </div>
                <span
                  style={{
                    fontFamily: '"Geist Mono",monospace',
                    fontSize: 13,
                    fontWeight: 600,
                    color: qty > 0 ? T.green : T.red,
                    flexShrink: 0,
                  }}
                >
                  {qty > 0 ? '+' : ''}
                  {qty.toLocaleString('en', { maximumFractionDigits: 2 })}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: `1px solid ${T.hairline}`,
          display: 'flex',
          gap: 6,
          flexWrap: 'wrap',
        }}
      >
        <Button size="sm" onClick={() => onMovement(part.id, part.name)}>
          Post movement
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onStockConfig(part.id, part.name)}>
          Stock config
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onBarcodes(part.id, part.name)}>
          Barcodes
        </Button>
      </div>
    </aside>
  );
}

// ── Column definitions — append here to add more ───────────────────────────
const COLUMNS = [
  { key: 'status', label: '', width: 28 },
  { key: 'code', label: 'Part code', width: 110 },
  { key: 'name', label: 'Description', width: 240 },
  { key: 'location', label: 'Location', width: 130 },
  { key: 'rob', label: 'ROB', width: 70, align: 'right' },
  { key: 'unit', label: 'Unit', width: 50 },
  { key: 'min', label: 'Min', width: 55, align: 'right' },
  { key: 'reorder', label: 'Reorder', width: 65, align: 'right' },
  { key: 'max', label: 'Max', width: 55, align: 'right' },
] as const;
type ColKey = (typeof COLUMNS)[number]['key'];

const FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'green', label: '≥ min' },
  { id: 'amber', label: '< min' },
  { id: 'red', label: '≤ reorder' },
  { id: 'purple', label: 'Zero' },
];

// ── Main page ──────────────────────────────────────────────────────────────
type ActiveModal =
  | { kind: 'none' }
  | { kind: 'stockLevel'; partId: string; partName: string }
  | { kind: 'movement'; partId: string; partName: string }
  | { kind: 'editPart'; part: PartItem }
  | { kind: 'barcodes'; partId: string; partName: string };

export function InventoryPage() {
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [activeLoc, setActiveLoc] = useState('all');
  const [selected, setSelected] = useState<Part | null>(null);
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(COLUMNS.map((c) => c.key));
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [modal, setModal] = useState<ActiveModal>({ kind: 'none' });
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Part[]>('/parts/inventory-summary'),
      api.get<Location[]>('/stock-locations'),
    ])
      .then(([p, l]) => {
        setParts(p);
        setLocations(l);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  const closeModal = () => setModal({ kind: 'none' });

  // Status counts for the location legend
  const statusCounts = { green: 0, amber: 0, red: 0, purple: 0 };
  const countByLoc = new Map<string, number>();
  for (const p of parts) {
    statusCounts[worstStatus(p.stockLevels)]++;
    for (const l of p.stockLevels)
      countByLoc.set(l.locationId, (countByLoc.get(l.locationId) ?? 0) + 1);
  }

  const visible = parts.filter((p) => {
    if (filter !== 'all' && worstStatus(p.stockLevels) !== filter) return false;
    if (activeLoc !== 'all' && !p.stockLevels.some((l) => l.locationId === activeLoc)) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!p.name.toLowerCase().includes(q) && !(p.partNumber ?? '').toLowerCase().includes(q))
        return false;
    }
    return true;
  });

  const activeCols = COLUMNS.filter((c) => visibleCols.includes(c.key));
  const totalWidth = activeCols.reduce((s, c) => s + c.width, 0);

  function cell(p: Part, key: ColKey): React.ReactNode {
    const l = p.stockLevels[0];
    const s = worstStatus(p.stockLevels);
    switch (key) {
      case 'status':
        return <Dot status={s} />;
      case 'code':
        return (
          <span
            style={{
              fontFamily: '"Geist Mono",monospace',
              fontSize: 11,
              color: T.ink2,
              whiteSpace: 'nowrap',
            }}
          >
            {p.partNumber ?? '—'}
          </span>
        );
      case 'name':
        return (
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 12.5,
                fontWeight: 500,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: T.ink,
              }}
            >
              {p.name}
            </div>
            {p.description && (
              <div
                style={{
                  fontSize: 10.5,
                  color: T.ink3,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {p.description}
              </div>
            )}
          </div>
        );
      case 'location':
        return (
          <span
            style={{
              fontSize: 11.5,
              color: T.ink3,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: 'block',
            }}
          >
            {l?.locationName ?? '—'}
          </span>
        );
      case 'rob':
        return (
          <span
            style={{
              fontFamily: '"Geist Mono",monospace',
              fontSize: 13,
              fontWeight: 600,
              color: STATUS_C[s],
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {l ? parseFloat(l.rob).toFixed(1) : '—'}
          </span>
        );
      case 'unit':
        return <span style={{ fontSize: 11, color: T.ink3 }}>{p.unit}</span>;
      case 'min':
        return (
          <span style={{ fontFamily: '"Geist Mono",monospace', fontSize: 11, color: T.ink3 }}>
            {l?.minStock ?? '—'}
          </span>
        );
      case 'reorder':
        return (
          <span style={{ fontFamily: '"Geist Mono",monospace', fontSize: 11, color: T.ink3 }}>
            {l?.reorderPoint ?? '—'}
          </span>
        );
      case 'max':
        return (
          <span style={{ fontFamily: '"Geist Mono",monospace', fontSize: 11, color: T.ink3 }}>
            {l?.maxStock ?? '—'}
          </span>
        );
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        height: 'calc(100vh - 48px)',
        margin: '-24px -28px',
        overflow: 'hidden',
        fontFamily: '"Geist",system-ui,sans-serif',
        color: T.ink,
      }}
    >
      {/* ── Location rail ──────────────────────────────────────────── */}
      <aside
        style={{
          width: 200,
          flexShrink: 0,
          background: T.surface,
          borderRight: `1px solid ${T.border}`,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '12px 12px 6px' }}>
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: T.ink3,
            }}
          >
            Locations
          </span>
        </div>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '0 6px 8px',
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
          }}
        >
          {[
            { id: 'all', name: 'All locations', count: parts.length },
            ...locations.map((l) => ({ id: l.id, name: l.name, count: countByLoc.get(l.id) ?? 0 })),
          ].map((l) => (
            <button
              key={l.id}
              onClick={() => setActiveLoc(l.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '5px 8px',
                background: activeLoc === l.id ? T.surface2 : 'transparent',
                border: 'none',
                borderRadius: 5,
                cursor: 'pointer',
                textAlign: 'left',
                color: activeLoc === l.id ? T.ink : T.ink2,
                fontSize: 12.5,
                fontWeight: activeLoc === l.id ? 600 : 400,
                height: 28,
              }}
            >
              <span
                style={{
                  flex: 1,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {l.name}
              </span>
              <span style={{ fontFamily: '"Geist Mono",monospace', fontSize: 10.5, color: T.ink3 }}>
                {l.count}
              </span>
            </button>
          ))}
        </div>
        <div
          style={{
            padding: '10px 12px',
            borderTop: `1px solid ${T.hairline}`,
            background: T.surface2,
          }}
        >
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: T.ink3,
              marginBottom: 6,
            }}
          >
            By status
          </div>
          {(['green', 'amber', 'red', 'purple'] as const).map((s) => (
            <div
              key={s}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 0' }}
            >
              <Dot status={s} />
              <span style={{ flex: 1, fontSize: 11.5, color: T.ink2 }}>
                {{ green: '≥ min', amber: '< min', red: '≤ reorder', purple: 'zero' }[s]}
              </span>
              <span style={{ fontFamily: '"Geist Mono",monospace', fontSize: 10.5, color: T.ink }}>
                {statusCounts[s]}
              </span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── Centre: toolbar + scrollable table ───────────────────── */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        {/* Toolbar */}
        <div
          style={{
            padding: '10px 14px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            flexWrap: 'wrap',
            background: T.surface,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>Inventory</span>
          <span style={{ color: T.ink3, fontSize: 11.5 }}>
            · {visible.length} of {parts.length}
          </span>
          <div style={{ flex: 1 }} />
          {/* Filter chips */}
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                height: 26,
                padding: '0 10px',
                fontSize: 11.5,
                fontWeight: 500,
                border: `1px solid ${filter === f.id ? T.navy : T.border}`,
                borderRadius: 5,
                cursor: 'pointer',
                fontFamily: 'inherit',
                background: filter === f.id ? T.navy : T.surface,
                color: filter === f.id ? '#fff' : T.ink2,
              }}
            >
              {f.label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            style={{
              height: 28,
              padding: '0 10px',
              fontSize: 12.5,
              border: `1px solid ${T.border}`,
              borderRadius: 5,
              outline: 'none',
              fontFamily: 'inherit',
              color: T.ink,
              width: 140,
            }}
          />
          {/* Columns picker */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setColPickerOpen((v) => !v)}
              style={{
                height: 28,
                padding: '0 10px',
                fontSize: 12.5,
                border: `1px solid ${T.border}`,
                borderRadius: 5,
                cursor: 'pointer',
                background: T.surface,
                color: T.ink2,
                fontFamily: 'inherit',
              }}
            >
              Columns · {visibleCols.length}
            </button>
            {colPickerOpen && (
              <>
                <div
                  onClick={() => setColPickerOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 32,
                    right: 0,
                    zIndex: 11,
                    background: T.surface,
                    border: `1px solid ${T.border}`,
                    borderRadius: 6,
                    boxShadow: '0 8px 24px rgba(10,31,51,.10)',
                    minWidth: 180,
                    padding: 4,
                  }}
                >
                  {COLUMNS.filter((c) => c.label).map((c) => (
                    <label
                      key={c.key}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '5px 8px',
                        borderRadius: 4,
                        fontSize: 12,
                        color: T.ink,
                        cursor: 'pointer',
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={visibleCols.includes(c.key)}
                        onChange={() =>
                          setVisibleCols((v) =>
                            v.includes(c.key) ? v.filter((k) => k !== c.key) : [...v, c.key],
                          )
                        }
                        style={{ accentColor: T.navy }}
                      />
                      {c.label}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            + New Part
          </Button>
        </div>

        {/* Scrollable table (both axes, always-visible bars) */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflow: 'scroll',
            scrollbarWidth: 'thin',
            scrollbarColor: `${T.ink4} ${T.surface2}`,
          }}
        >
          <div style={{ minWidth: totalWidth + 1 }}>
            {/* Sticky header */}
            <div
              style={{
                display: 'flex',
                height: 36,
                background: T.surface2,
                borderBottom: `1px solid ${T.border}`,
                position: 'sticky',
                top: 0,
                zIndex: 2,
              }}
            >
              {activeCols.map((c) => (
                <div
                  key={c.key}
                  style={{
                    width: c.width,
                    flexShrink: 0,
                    padding: '0 10px',
                    display: 'flex',
                    alignItems: 'center',
                    fontSize: 10.5,
                    fontWeight: 500,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: T.ink3,
                    justifyContent: 'align' in c && c.align === 'right' ? 'flex-end' : 'flex-start',
                  }}
                >
                  {c.label}
                </div>
              ))}
              <div style={{ flex: 1 }} />
            </div>

            {loading && (
              <div style={{ padding: 40, textAlign: 'center', color: T.ink3, fontSize: 13 }}>
                Loading…
              </div>
            )}
            {!loading && visible.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: T.ink3, margin: '0 0 12px' }}>
                  {parts.length === 0 ? 'No parts yet.' : 'No parts match the current filter.'}
                </p>
                {parts.length === 0 && (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    + New Part
                  </Button>
                )}
              </div>
            )}

            {visible.map((p) => {
              const isSel = selected?.id === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelected(isSel ? null : p)}
                  style={{
                    display: 'flex',
                    height: 44,
                    alignItems: 'center',
                    borderTop: `1px solid ${T.hairline}`,
                    background: isSel ? T.surface2 : T.surface,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSel) e.currentTarget.style.background = T.surfaceSunk;
                  }}
                  onMouseLeave={(e) => {
                    if (!isSel) e.currentTarget.style.background = T.surface;
                  }}
                >
                  {activeCols.map((c) => (
                    <div
                      key={c.key}
                      style={{
                        width: c.width,
                        flexShrink: 0,
                        padding: '0 10px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent:
                          'align' in c && c.align === 'right' ? 'flex-end' : 'flex-start',
                      }}
                    >
                      {cell(p, c.key)}
                    </div>
                  ))}
                  <div style={{ flex: 1 }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Detail pane ────────────────────────────────────────────── */}
      <DetailPane
        part={selected}
        onClose={() => setSelected(null)}
        onMovement={(id, name) => setModal({ kind: 'movement', partId: id, partName: name })}
        onStockConfig={(id, name) => setModal({ kind: 'stockLevel', partId: id, partName: name })}
        onBarcodes={(id, name) => setModal({ kind: 'barcodes', partId: id, partName: name })}
      />

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <CreatePartModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(id, name) => {
          setCreateOpen(false);
          setModal({ kind: 'stockLevel', partId: id, partName: name });
          load();
        }}
      />
      <EditPartModal
        open={modal.kind === 'editPart'}
        part={modal.kind === 'editPart' ? modal.part : null}
        onClose={closeModal}
        onSaved={() => {
          closeModal();
          load();
        }}
      />
      <AddStockLevelModal
        open={modal.kind === 'stockLevel'}
        partId={modal.kind === 'stockLevel' ? modal.partId : ''}
        partName={modal.kind === 'stockLevel' ? modal.partName : ''}
        onClose={closeModal}
        onSaved={() => {
          closeModal();
          load();
        }}
      />
      <PostStockMovementModal
        open={modal.kind === 'movement'}
        partId={modal.kind === 'movement' ? modal.partId : ''}
        partName={modal.kind === 'movement' ? modal.partName : ''}
        onClose={closeModal}
        onPosted={() => {
          closeModal();
          load();
        }}
      />
      <ManageBarcodesModal
        open={modal.kind === 'barcodes'}
        partId={modal.kind === 'barcodes' ? modal.partId : ''}
        partName={modal.kind === 'barcodes' ? modal.partName : ''}
        onClose={closeModal}
      />
    </div>
  );
}
