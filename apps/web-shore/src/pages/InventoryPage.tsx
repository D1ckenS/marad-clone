import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { CreatePartModal, type Category } from '../components/CreatePartModal.js';
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
  categoryId: string | null;
  categoryName: string | null;
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

// ── Rail checkbox ─────────────────────────────────────────────────────────
function RailCheckbox({
  label,
  checked,
  onChange,
  count,
  italic = false,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
  count: number;
  italic?: boolean;
}) {
  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '5px 8px', borderRadius: 5, cursor: 'pointer', height: 28,
        background: checked ? T.surfaceSunk : 'transparent',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        style={{ accentColor: T.navy, width: 13, height: 13, flexShrink: 0, cursor: 'pointer' }}
      />
      <span
        style={{
          flex: 1, fontSize: 12.5,
          color: checked ? T.ink : italic ? T.ink3 : T.ink2,
          fontWeight: checked ? 600 : 400,
          fontStyle: italic ? 'italic' : undefined,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}
      >
        {label}
      </span>
      <span style={{ fontFamily: '"Geist Mono",monospace', fontSize: 10.5, color: T.ink3 }}>
        {count}
      </span>
    </label>
  );
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
  onEdit,
  onMovement,
  onStockConfig,
  onBarcodes,
}: {
  part: Part | null;
  onClose: () => void;
  onEdit: (part: Part) => void;
  onMovement: (id: string, name: string) => void;
  onStockConfig: (id: string, name: string) => void;
  onBarcodes: (id: string, name: string) => void;
}) {
  const { t } = useTranslation();
  const STATUS_LABEL = {
    green: t('inventory.status_green'),
    amber: t('inventory.status_amber'),
    red: t('inventory.status_red'),
    purple: t('inventory.status_purple'),
  };
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
          {t('inventory.select_part_hint')}
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
            {t('inventory.no_parts')}
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
              {t('inventory.stock_by_location')}
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
            {t('inventory.movements_header')}
          </div>
          {loadingMov && (
            <p style={{ padding: '8px 16px', fontSize: 11.5, color: T.ink3 }}>
              {t('common.loading')}
            </p>
          )}
          {!loadingMov && movements.length === 0 && (
            <p style={{ padding: '8px 16px', fontSize: 11.5, color: T.ink3 }}>
              {t('inventory.no_movements')}
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
          {t('inventory.post_movement')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onStockConfig(part.id, part.name)}>
          {t('inventory.add_stock_level')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onBarcodes(part.id, part.name)}>
          {t('inventory.manage_barcodes')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onEdit(part)}>
          Edit Part
        </Button>
      </div>
    </aside>
  );
}

// ── Column definitions — append here to add more ───────────────────────────
const COLUMNS = [
  { key: 'status', labelKey: '', width: 28 },
  { key: 'code', labelKey: 'inventory.col_code', width: 110 },
  { key: 'name', labelKey: 'inventory.col_description', width: 240 },
  { key: 'location', labelKey: 'inventory.location', width: 130 },
  { key: 'rob', labelKey: 'inventory.rob', width: 70, align: 'right' },
  { key: 'unit', labelKey: 'inventory.unit', width: 50 },
  { key: 'min', labelKey: 'inventory.col_min', width: 55, align: 'right' },
  { key: 'reorder', labelKey: 'inventory.col_reorder', width: 65, align: 'right' },
  { key: 'max', labelKey: 'inventory.col_max', width: 55, align: 'right' },
] as const;
type ColKey = (typeof COLUMNS)[number]['key'];

const FILTER_KEYS = [
  { id: 'all' as StatusFilter, labelKey: 'inventory.filter_all' },
  { id: 'green' as StatusFilter, labelKey: 'inventory.filter_in_stock' },
  { id: 'amber' as StatusFilter, labelKey: 'inventory.filter_below_min' },
  { id: 'red' as StatusFilter, labelKey: 'inventory.filter_at_reorder' },
  { id: 'purple' as StatusFilter, labelKey: 'inventory.filter_zero' },
];

// ── Add Category modal ────────────────────────────────────────────────────
function AddCategoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    try {
      await api.post<unknown>('/part-categories', { name: name.trim() });
      onCreated();
      onClose();
    } catch {
      setErr('Failed to create category');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(10,31,51,.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.surface, borderRadius: 10, width: 320, padding: 20,
          boxShadow: '0 16px 48px rgba(10,31,51,.18)',
          border: `1px solid ${T.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ margin: '0 0 14px', fontSize: 13.5, fontWeight: 600, color: T.ink }}>
          Add Category
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. Lubricants"
          style={{
            width: '100%', boxSizing: 'border-box',
            height: 34, padding: '0 10px', fontSize: 13,
            border: `1px solid ${T.border}`, borderRadius: 6,
            outline: 'none', fontFamily: 'inherit', color: T.ink,
          }}
        />
        {err && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: T.red }}>{err}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              height: 30, padding: '0 14px', fontSize: 12.5, borderRadius: 5,
              border: `1px solid ${T.border}`, background: T.surface,
              color: T.ink2, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              height: 30, padding: '0 14px', fontSize: 12.5, borderRadius: 5,
              border: 'none', background: T.navy,
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Add Location modal ────────────────────────────────────────────────────
function AddLocationModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const submit = async () => {
    if (!name.trim()) { setErr('Name is required'); return; }
    setSaving(true);
    try {
      await api.post<unknown>('/stock-locations', { name: name.trim() });
      onCreated();
      onClose();
    } catch {
      setErr('Failed to create location');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: 'rgba(10,31,51,.35)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: T.surface, borderRadius: 10, width: 320, padding: 20,
          boxShadow: '0 16px 48px rgba(10,31,51,.18)',
          border: `1px solid ${T.border}`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p style={{ margin: '0 0 14px', fontSize: 13.5, fontWeight: 600, color: T.ink }}>
          Add Location
        </p>
        <input
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="e.g. Engine Room Store"
          style={{
            width: '100%', boxSizing: 'border-box',
            height: 34, padding: '0 10px', fontSize: 13,
            border: `1px solid ${T.border}`, borderRadius: 6,
            outline: 'none', fontFamily: 'inherit', color: T.ink,
          }}
        />
        {err && <p style={{ margin: '6px 0 0', fontSize: 11.5, color: T.red }}>{err}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
          <button
            onClick={onClose}
            style={{
              height: 30, padding: '0 14px', fontSize: 12.5, borderRadius: 5,
              border: `1px solid ${T.border}`, background: T.surface,
              color: T.ink2, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={saving}
            style={{
              height: 30, padding: '0 14px', fontSize: 12.5, borderRadius: 5,
              border: 'none', background: T.navy,
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit', opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────
type ActiveModal =
  | { kind: 'none' }
  | { kind: 'stockLevel'; partId: string; partName: string }
  | { kind: 'movement'; partId: string; partName: string }
  | { kind: 'editPart'; part: PartItem }
  | { kind: 'barcodes'; partId: string; partName: string };

export function InventoryPage() {
  const { t } = useTranslation();
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [search, setSearch] = useState('');
  const [activeLocs, setActiveLocs] = useState<Set<string>>(new Set());
  const [activeCats, setActiveCats] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Part | null>(null);
  const [visibleCols, setVisibleCols] = useState<ColKey[]>(COLUMNS.map((c) => c.key));
  const [colPickerOpen, setColPickerOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [addLocOpen, setAddLocOpen] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [modal, setModal] = useState<ActiveModal>({ kind: 'none' });
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      api.get<Part[]>('/parts/inventory-summary'),
      api.get<Location[]>('/stock-locations'),
      api.get<Category[]>('/part-categories'),
    ])
      .then(([p, l, c]) => {
        setParts(p);
        setLocations(l);
        setCategories(c);
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
    if (activeLocs.size > 0 && !p.stockLevels.some((l) => activeLocs.has(l.locationId))) return false;
    if (activeCats.size > 0) {
      const matchesCat = activeCats.has('__none__') && !p.categoryId
        ? true
        : p.categoryId !== null && activeCats.has(p.categoryId);
      if (!matchesCat) return false;
    }
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
        <div style={{ padding: '12px 12px 6px', display: 'flex', alignItems: 'center' }}>
          <span
            style={{
              flex: 1,
              fontSize: 10.5,
              fontWeight: 500,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: T.ink3,
            }}
          >
            {t('inventory.locations')}
          </span>
          <button
            onClick={() => setAddLocOpen(true)}
            title="Add location"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: T.ink3, fontSize: 18, lineHeight: 1, padding: '0 2px',
            }}
          >
            +
          </button>
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
          {/* All Locations — clears filter */}
          <RailCheckbox
            label="All Locations"
            checked={activeLocs.size === 0}
            onChange={() => setActiveLocs(new Set())}
            count={parts.length}
          />
          {locations.map((l) => {
            const checked = activeLocs.has(l.id);
            const toggle = () => setActiveLocs((prev) => {
              const next = new Set(prev);
              if (checked) next.delete(l.id); else next.add(l.id);
              return next;
            });
            return (
              <RailCheckbox
                key={l.id}
                label={l.name}
                checked={checked}
                onChange={toggle}
                count={countByLoc.get(l.id) ?? 0}
              />
            );
          })}
        </div>
        {/* Categories section */}
        <div style={{ borderTop: `1px solid ${T.hairline}`, padding: '8px 6px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '0 6px 4px' }}>
            <span style={{ flex: 1, fontSize: 10.5, fontWeight: 500, letterSpacing: '0.08em', textTransform: 'uppercase', color: T.ink3 }}>
              Categories
            </span>
            <button
              onClick={() => setAddCatOpen(true)}
              title="Add category"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, fontSize: 18, lineHeight: 1, padding: '0 2px' }}
            >
              +
            </button>
          </div>
          {/* Categories relevant to current location selection */}
          {(() => {
            const locParts = activeLocs.size === 0 ? parts : parts.filter((p) => p.stockLevels.some((l) => activeLocs.has(l.locationId)));
            const catIdsInLoc = new Set(locParts.map((p) => p.categoryId).filter(Boolean));
            const visibleCats = categories.filter((c) => catIdsInLoc.has(c.id));
            const uncategorisedCount = locParts.filter((p) => !p.categoryId).length;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {/* All Categories — clears filter */}
                <RailCheckbox
                  label="All"
                  checked={activeCats.size === 0}
                  onChange={() => setActiveCats(new Set())}
                  count={locParts.length}
                />
                {visibleCats.map((c) => {
                  const checked = activeCats.has(c.id);
                  const count = locParts.filter((p) => p.categoryId === c.id).length;
                  const toggle = () => setActiveCats((prev) => {
                    const next = new Set(prev);
                    if (checked) next.delete(c.id); else next.add(c.id);
                    return next;
                  });
                  return (
                    <RailCheckbox
                      key={c.id}
                      label={c.name}
                      checked={checked}
                      onChange={toggle}
                      count={count}
                    />
                  );
                })}
                {uncategorisedCount > 0 && (() => {
                  const checked = activeCats.has('__none__');
                  return (
                    <RailCheckbox
                      label="Uncategorised"
                      checked={checked}
                      onChange={() => setActiveCats((prev) => { const next = new Set(prev); if (checked) next.delete('__none__'); else next.add('__none__'); return next; })}
                      count={uncategorisedCount}
                      italic
                    />
                  );
                })()}
              </div>
            );
          })()}
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
            {t('inventory.by_status')}
          </div>
          {(['green', 'amber', 'red', 'purple'] as const).map((s) => (
            <div
              key={s}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 0' }}
            >
              <Dot status={s} />
              <span style={{ flex: 1, fontSize: 11.5, color: T.ink2 }}>
                {
                  {
                    green: t('inventory.filter_in_stock'),
                    amber: t('inventory.filter_below_min'),
                    red: t('inventory.filter_at_reorder'),
                    purple: t('inventory.filter_zero'),
                  }[s]
                }
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
          <span style={{ fontSize: 13, fontWeight: 600, color: T.ink }}>
            {t('inventory.title')}
          </span>
          <span style={{ color: T.ink3, fontSize: 11.5 }}>
            · {visible.length} of {parts.length}
          </span>
          <div style={{ flex: 1 }} />
          {/* Filter chips */}
          {FILTER_KEYS.map((f) => (
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
              {t(f.labelKey)}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('common.search') + '…'}
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
              {t('inventory.columns_picker')} · {visibleCols.length}
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
                  {COLUMNS.filter((c) => c.labelKey).map((c) => (
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
                      {t(c.labelKey)}
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            {t('inventory.new_part')}
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
                  {c.labelKey ? t(c.labelKey) : ''}
                </div>
              ))}
              <div style={{ flex: 1 }} />
            </div>

            {loading && (
              <div style={{ padding: 40, textAlign: 'center', color: T.ink3, fontSize: 13 }}>
                {t('common.loading')}
              </div>
            )}
            {!loading && visible.length === 0 && (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <p style={{ fontSize: 13, color: T.ink3, margin: '0 0 12px' }}>
                  {parts.length === 0 ? t('inventory.no_parts') : t('inventory.no_parts')}
                </p>
                {parts.length === 0 && (
                  <Button size="sm" onClick={() => setCreateOpen(true)}>
                    {t('inventory.new_part')}
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
        onEdit={(p) => setModal({ kind: 'editPart', part: p })}
        onMovement={(id, name) => setModal({ kind: 'movement', partId: id, partName: name })}
        onStockConfig={(id, name) => setModal({ kind: 'stockLevel', partId: id, partName: name })}
        onBarcodes={(id, name) => setModal({ kind: 'barcodes', partId: id, partName: name })}
      />

      {/* ── Modals ─────────────────────────────────────────────────── */}
      <CreatePartModal
        open={createOpen}
        categories={categories}
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
        categories={categories}
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
      {addLocOpen && (
        <AddLocationModal onClose={() => setAddLocOpen(false)} onCreated={load} />
      )}
      {addCatOpen && (
        <AddCategoryModal onClose={() => setAddCatOpen(false)} onCreated={load} />
      )}
    </div>
  );
}
