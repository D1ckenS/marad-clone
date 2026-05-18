import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Badge, type BadgeColor, Button, Spinner, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { CreateRequisitionModal } from '../components/CreateRequisitionModal.js';
import { CreateSupplierModal } from '../components/CreateSupplierModal.js';
import { EditSupplierModal } from '../components/EditSupplierModal.js';
import { RejectRequisitionModal } from '../components/RejectRequisitionModal.js';

// ─── Shared types ────────────────────────────────────────────────────────────

export type ReqStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type POStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';

export interface RequisitionLine {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  estimatedUnitPrice: string | null;
  estimatedTotalPrice: string | null;
  currency: string | null;
}

export interface Requisition {
  id: string;
  title: string;
  notes: string | null;
  status: ReqStatus;
  totalAmount: string;
  currency: string;
  requestedAt: string;
  rejectionReason: string | null;
  lines: RequisitionLine[];
}

export interface POLine {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
  currency: string;
}

export interface Supplier {
  id: string;
  name: string;
}

export interface GoodsReceiptLine {
  id: string;
  poLineId: string;
  description: string;
  quantityOrdered: string;
  quantityReceived: string;
  unit: string;
}

export interface GoodsReceipt {
  id: string;
  receivedAt: string;
  notes: string | null;
  lines: GoodsReceiptLine[];
}

export interface PurchaseOrder {
  id: string;
  title: string;
  notes: string | null;
  status: POStatus;
  poNumber: string | null;
  totalAmount: string;
  currency: string;
  supplierId: string | null;
  supplier: Supplier | null;
  requisitionId: string | null;
  expectedDeliveryAt: string | null;
  createdAt: string;
  lines: POLine[];
  receipts?: GoodsReceipt[];
}

export interface Rfq {
  id: string;
  title: string;
  notes: string | null;
  requisitionId: string | null;
  status: string;
  issuedAt: string | null;
  dueAt: string | null;
  createdAt: string;
}

export interface Quote {
  id: string;
  rfqId: string;
  supplierId: string | null;
  supplier: Supplier | null;
  totalAmount: string | null;
  currency: string | null;
  notes: string | null;
  validUntil: string | null;
  status: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const titleCase = (s: string) =>
  s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

const fmtAmt = (amount: string, currency: string) =>
  `${parseFloat(amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;

const REQ_STATUS_COLOR: Record<ReqStatus, BadgeColor> = {
  DRAFT: 'slate',
  SUBMITTED: 'amber',
  APPROVED: 'green',
  REJECTED: 'red',
};

const PO_STATUS_COLOR: Record<POStatus, BadgeColor> = {
  DRAFT: 'slate',
  SENT: 'blue',
  ACKNOWLEDGED: 'blue',
  IN_TRANSIT: 'amber',
  PARTIALLY_RECEIVED: 'amber',
  RECEIVED: 'green',
  CANCELLED: 'red',
  CLOSED: 'slate',
};

const canReceive = (s: POStatus) =>
  (['SENT', 'ACKNOWLEDGED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'] as POStatus[]).includes(s);

// ─── Shared atom: filter chip ─────────────────────────────────────────────────

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={
        active
          ? { background: 'var(--ink)', color: '#fff' }
          : {
              background: 'var(--surface)',
              color: 'var(--ink-2)',
              border: '1px solid var(--border)',
            }
      }
      className="h-[22px] px-2 rounded-1 text-[11px] font-medium transition-colors whitespace-nowrap"
    >
      {children}
    </button>
  );
}

// ─── Lifecycle stepper ───────────────────────────────────────────────────────

const LIFECYCLE = [
  { id: 'DRAFT', label: 'Draft' },
  { id: 'SENT', label: 'Sent' },
  { id: 'ACKNOWLEDGED', label: 'Confirmed' },
  { id: 'IN_TRANSIT', label: 'In Transit' },
  { id: 'PARTIALLY_RECEIVED', label: 'Partial' },
  { id: 'RECEIVED', label: 'Received' },
  { id: 'CLOSED', label: 'Closed' },
] as const;

type LifecycleId = (typeof LIFECYCLE)[number]['id'];

function LifecycleStepper({ status }: { status: POStatus }) {
  if (status === 'CANCELLED') {
    return (
      <div className="flex items-center gap-2 py-1">
        <span
          className="text-xs font-semibold px-2 py-0.5 rounded-1"
          style={{ background: 'var(--sig-red-bg)', color: 'var(--sig-red)' }}
        >
          CANCELLED
        </span>
      </div>
    );
  }
  const idx = LIFECYCLE.findIndex((s) => s.id === (status as LifecycleId));
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto' }}>
      {LIFECYCLE.map((s, i) => {
        const done = i < idx;
        const current = i === idx;
        return (
          <div key={s.id} style={{ flex: 1, display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                flex: 1,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  background: current
                    ? 'var(--navy)'
                    : done
                      ? 'var(--sig-green-bg)'
                      : 'var(--surface)',
                  border: `1.5px solid ${done ? 'var(--sig-green)' : current ? 'var(--navy)' : 'var(--border)'}`,
                  color: current ? '#fff' : done ? 'var(--sig-green)' : 'var(--ink-3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 9,
                  fontWeight: 600,
                }}
              >
                {done ? '✓' : i + 1}
              </div>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: current ? 600 : 500,
                  color: current ? 'var(--ink)' : 'var(--ink-3)',
                  whiteSpace: 'nowrap',
                }}
              >
                {s.label}
              </span>
            </div>
            {i < LIFECYCLE.length - 1 && (
              <div
                style={{
                  height: 2,
                  flex: 1,
                  marginBottom: 18,
                  background: i < idx ? 'var(--sig-green)' : 'var(--surface-sunk)',
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── GRN form (inline within PO detail pane) ─────────────────────────────────

function GrnForm({ po, onPosted }: { po: PurchaseOrder; onPosted: () => void }) {
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries(po.lines.map((l) => [l.id, l.quantity])),
  );
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePost = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.post(`/purchase-orders/${po.id}/receive`, {
        notes: notes.trim() || undefined,
        lines: po.lines.map((l) => ({
          poLineId: l.id,
          quantityReceived: qtys[l.id] ?? '0',
        })),
      });
      onPosted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'GRN failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border-t pt-4 mt-2" style={{ borderColor: 'var(--hairline)' }}>
      <div
        className="text-[10.5px] font-semibold uppercase tracking-widest mb-3"
        style={{ color: 'var(--ink-3)' }}
      >
        Post Goods Receipt
      </div>
      {error && (
        <div
          className="mb-3 text-xs px-3 py-2 rounded-2"
          style={{ background: 'var(--sig-red-bg)', color: 'var(--sig-red)' }}
        >
          {error}
        </div>
      )}
      <table className="w-full text-left text-xs mb-3">
        <thead>
          <tr style={{ color: 'var(--ink-3)' }}>
            <th className="pb-1.5 font-medium">Description</th>
            <th className="pb-1.5 text-right font-medium">Ordered</th>
            <th className="pb-1.5 text-right font-medium w-20">Received</th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((line) => (
            <tr key={line.id} style={{ borderTop: '1px solid var(--hairline)' }}>
              <td className="py-1.5 pr-3" style={{ color: 'var(--ink)' }}>
                {line.description}
              </td>
              <td className="py-1.5 pr-2 text-right font-mono" style={{ color: 'var(--ink-3)' }}>
                {parseFloat(line.quantity).toLocaleString()} {line.unit}
              </td>
              <td className="py-1.5">
                <input
                  type="number"
                  min="0"
                  step="0.001"
                  value={qtys[line.id] ?? line.quantity}
                  onChange={(e) => setQtys((q) => ({ ...q, [line.id]: e.target.value }))}
                  className="w-full rounded-1 border px-2 py-1 text-xs font-mono text-right"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <TextArea
        id="grn-notes"
        label="Notes"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Delivery note number, condition remarks…"
      />
      <div className="mt-3 flex justify-end">
        <Button size="sm" loading={saving} onClick={handlePost}>
          Post GRN
        </Button>
      </div>
    </div>
  );
}

// ─── PO detail pane (inline side panel) ──────────────────────────────────────

function PODetailPane({
  poId,
  onClose,
  onUpdated,
}: {
  poId: string;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [po, setPo] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<PurchaseOrder>(`/purchase-orders/${poId}`)
      .then(setPo)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [poId]);

  useEffect(() => {
    load();
  }, [load]);

  const doAction = async (action: string) => {
    if (!po) return;
    setActionLoading(true);
    try {
      await api.post(`/purchase-orders/${po.id}/${action}`, {});
      load();
      onUpdated();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <aside
      style={{
        width: 400,
        flexShrink: 0,
        background: 'var(--surface)',
        borderLeft: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {loading && (
        <div className="flex-1 flex items-center justify-center">
          <Spinner />
        </div>
      )}
      {!loading && po && (
        <>
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto">
            {/* Header */}
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {po.id.slice(0, 8)}
                </span>
                {po.poNumber && (
                  <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    · {po.poNumber}
                  </span>
                )}
                <Badge color={PO_STATUS_COLOR[po.status]}>{titleCase(po.status)}</Badge>
                <div className="flex-1" />
                <button
                  onClick={onClose}
                  className="w-6 h-6 flex items-center justify-center rounded-1 text-sm transition-colors"
                  style={{ color: 'var(--ink-3)', background: 'transparent' }}
                >
                  ×
                </button>
              </div>
              <div className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                {po.supplier?.name ?? po.title}
              </div>
              <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                {po.supplier && <span>{po.title} · </span>}
                {po.expectedDeliveryAt ? `ETA ${fmtDate(po.expectedDeliveryAt)}` : 'No ETA set'}
              </div>
            </div>

            {/* Lifecycle */}
            <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <LifecycleStepper status={po.status} />
            </div>

            {/* Money tiles */}
            <div
              className="grid grid-cols-2"
              style={{
                gap: 1,
                background: 'var(--hairline)',
                borderBottom: '1px solid var(--hairline)',
              }}
            >
              <div className="px-4 py-3" style={{ background: 'var(--surface)' }}>
                <div
                  className="text-[10.5px] font-semibold uppercase tracking-widest mb-1"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Total
                </div>
                <div
                  className="font-mono text-[17px] font-semibold"
                  style={{ color: 'var(--ink)' }}
                >
                  {fmtAmt(po.totalAmount, po.currency)}
                </div>
              </div>
              <div className="px-4 py-3" style={{ background: 'var(--surface)' }}>
                <div
                  className="text-[10.5px] font-semibold uppercase tracking-widest mb-1"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Lines · received
                </div>
                <div
                  className="font-mono text-[17px] font-semibold"
                  style={{ color: 'var(--ink)' }}
                >
                  {po.receipts ? po.receipts.reduce((n, r) => n + r.lines.length, 0) : '—'} /{' '}
                  {po.lines.length}
                </div>
              </div>
            </div>

            {/* Lines */}
            {po.lines.length > 0 && (
              <div>
                <div
                  className="px-4 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Lines
                </div>
                {po.lines.map((l) => {
                  const received =
                    po.receipts?.reduce(
                      (sum, r) =>
                        sum +
                        r.lines
                          .filter((rl) => rl.poLineId === l.id)
                          .reduce((s, rl) => s + parseFloat(rl.quantityReceived || '0'), 0),
                      0,
                    ) ?? 0;
                  const ordered = parseFloat(l.quantity);
                  const status =
                    received >= ordered ? 'RECEIVED' : received > 0 ? 'PARTIAL' : 'OPEN';
                  const statusColor: BadgeColor =
                    status === 'RECEIVED' ? 'green' : status === 'PARTIAL' ? 'amber' : 'slate';
                  return (
                    <div
                      key={l.id}
                      className="px-4 py-2"
                      style={{ borderTop: '1px solid var(--hairline)' }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="text-[12px] truncate" style={{ color: 'var(--ink)' }}>
                            {l.description}
                          </div>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge color={statusColor}>{status}</Badge>
                            <span
                              className="font-mono text-[10.5px]"
                              style={{ color: 'var(--ink-3)' }}
                            >
                              {received}/{ordered} {l.unit}
                            </span>
                          </div>
                        </div>
                        <span
                          className="font-mono text-[11.5px] whitespace-nowrap"
                          style={{ color: 'var(--ink-2)' }}
                        >
                          {fmtAmt(l.totalPrice, l.currency)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Existing receipts */}
            {po.receipts && po.receipts.length > 0 && (
              <div style={{ borderTop: '1px solid var(--hairline)' }}>
                <div
                  className="px-4 pt-3 pb-1 text-[10.5px] font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Goods Receipts
                </div>
                {po.receipts.map((r) => (
                  <div
                    key={r.id}
                    className="px-4 py-2"
                    style={{ borderTop: '1px solid var(--hairline)' }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium" style={{ color: 'var(--ink)' }}>
                        GRN — {fmtDate(r.receivedAt)}
                      </span>
                      {r.notes && (
                        <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                          {r.notes}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {r.lines.map((rl) => (
                        <div key={rl.id} className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
                          {rl.description}: received{' '}
                          <span className="font-mono font-medium" style={{ color: 'var(--ink)' }}>
                            {parseFloat(rl.quantityReceived).toLocaleString()} {rl.unit}
                          </span>{' '}
                          of {parseFloat(rl.quantityOrdered).toLocaleString()}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Notes */}
            {po.notes && (
              <div className="px-4 py-3" style={{ borderTop: '1px solid var(--hairline)' }}>
                <div
                  className="text-[10.5px] font-semibold uppercase tracking-widest mb-1"
                  style={{ color: 'var(--ink-3)' }}
                >
                  Notes
                </div>
                <div className="text-[12px]" style={{ color: 'var(--ink-2)' }}>
                  {po.notes}
                </div>
              </div>
            )}

            {/* GRN form */}
            {canReceive(po.status) && po.lines.length > 0 && (
              <div className="px-4 pb-4">
                <GrnForm
                  po={po}
                  onPosted={() => {
                    load();
                    onUpdated();
                  }}
                />
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div
            className="flex gap-2 p-3 flex-shrink-0"
            style={{
              borderTop: '1px solid var(--hairline)',
              background: 'var(--surface-2)',
            }}
          >
            {po.status === 'DRAFT' && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  style={{ flex: 1 }}
                  loading={actionLoading}
                  onClick={() => doAction('send')}
                >
                  Send to supplier
                </Button>
              </>
            )}
            {po.status === 'SENT' && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  style={{ flex: 1 }}
                  loading={actionLoading}
                  onClick={() => doAction('send')}
                >
                  Resend
                </Button>
              </>
            )}
            {!['DRAFT', 'SENT', 'CANCELLED', 'CLOSED'].includes(po.status) &&
              !canReceive(po.status) && (
                <div className="flex-1 text-center text-xs" style={{ color: 'var(--ink-3)' }}>
                  No actions available
                </div>
              )}
            {['DRAFT', 'SENT', 'ACKNOWLEDGED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(
              po.status,
            ) || null}
          </div>
        </>
      )}
    </aside>
  );
}

// ─── Requisitions tab ─────────────────────────────────────────────────────────

const REQ_FILTERS = ['ALL', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const;
type ReqFilter = (typeof REQ_FILTERS)[number];

function RequisitionsTab() {
  const [reqs, setReqs] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReqFilter>('ALL');
  const [creating, setCreating] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const url = filter === 'ALL' ? '/requisitions' : `/requisitions?status=${filter}`;
    api
      .get<Requisition[]>(url)
      .then(setReqs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const doAction = async (id: string, action: 'submit' | 'approve') => {
    setActionLoading(`${id}-${action}`);
    try {
      await api.post(`/requisitions/${id}/${action}`, {});
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Toolbar */}
      <div
        className="flex items-center gap-2 px-4 py-2 flex-shrink-0 flex-wrap"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
      >
        <span
          className="text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ color: 'var(--ink-3)' }}
        >
          Status
        </span>
        <div className="flex gap-1.5 flex-wrap">
          {REQ_FILTERS.map((f) => (
            <Chip key={f} active={filter === f} onClick={() => setFilter(f)}>
              {f === 'ALL' ? 'All' : titleCase(f)}
            </Chip>
          ))}
        </div>
        <div className="flex-1" />
        <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
          {reqs.length} {filter !== 'ALL' ? titleCase(filter).toLowerCase() : ''}
        </span>
      </div>

      {/* Table header */}
      <div
        className="grid gap-2 px-4 py-2 flex-shrink-0 text-[10.5px] font-semibold uppercase tracking-widest"
        style={{
          gridTemplateColumns: '80px 1fr 110px 90px 100px 80px',
          background: 'var(--surface-sunk)',
          color: 'var(--ink-3)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Req</span>
        <span>Item / notes</span>
        <span className="text-right">Value</span>
        <span>Status</span>
        <span>Requested</span>
        <span />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface)' }}>
        {loading && (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {error && (
          <div className="p-4 text-xs" style={{ color: 'var(--sig-red)' }}>
            {error}
          </div>
        )}
        {!loading && !error && reqs.length === 0 && (
          <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-3)' }}>
            No requisitions found.
          </div>
        )}
        {!loading &&
          !error &&
          reqs.map((r) => (
            <div key={r.id}>
              <div
                className="grid gap-2 px-4 py-2.5 cursor-pointer transition-colors"
                style={{
                  gridTemplateColumns: '80px 1fr 110px 90px 100px 80px',
                  borderTop: '1px solid var(--hairline)',
                  background: expanded === r.id ? 'var(--surface-sunk)' : 'var(--surface)',
                }}
                onMouseEnter={(e) => {
                  if (expanded !== r.id)
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    expanded === r.id ? 'var(--surface-sunk)' : 'var(--surface)';
                }}
                onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              >
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                  {r.id.slice(0, 8)}
                </span>
                <div className="min-w-0">
                  <div
                    className="text-[12.5px] font-medium truncate"
                    style={{ color: 'var(--ink)' }}
                  >
                    {r.title}
                    {r.lines.length > 0 && (
                      <span
                        className="ml-1.5 font-mono text-[10.5px] font-normal"
                        style={{ color: 'var(--ink-3)' }}
                      >
                        {r.lines.length} line{r.lines.length !== 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                  {r.rejectionReason && (
                    <div className="text-[11px] truncate" style={{ color: 'var(--sig-red)' }}>
                      {r.rejectionReason}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div
                    className="font-mono text-[12.5px] font-semibold"
                    style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtAmt(r.totalAmount, r.currency)}
                  </div>
                </div>
                <Badge color={REQ_STATUS_COLOR[r.status]}>{titleCase(r.status)}</Badge>
                <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {fmtDate(r.requestedAt)}
                </span>
                <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
                  {r.status === 'DRAFT' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={actionLoading === `${r.id}-submit`}
                      onClick={() => doAction(r.id, 'submit')}
                    >
                      Submit
                    </Button>
                  )}
                  {r.status === 'SUBMITTED' && (
                    <>
                      <Button
                        size="sm"
                        loading={actionLoading === `${r.id}-approve`}
                        onClick={() => doAction(r.id, 'approve')}
                      >
                        Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRejectTarget(r.id)}>
                        Reject
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {/* Expanded lines */}
              {expanded === r.id && r.lines.length > 0 && (
                <div
                  className="px-6 pb-3"
                  style={{
                    background: 'var(--surface-sunk)',
                    borderTop: '1px solid var(--hairline)',
                  }}
                >
                  <table className="w-full text-[11px] mt-2">
                    <thead>
                      <tr style={{ color: 'var(--ink-3)' }}>
                        <th className="text-left pb-1.5 font-medium">Description</th>
                        <th className="text-right pb-1.5 font-medium">Qty</th>
                        <th className="text-right pb-1.5 font-medium">Unit</th>
                        <th className="text-right pb-1.5 font-medium">Est. Unit Price</th>
                        <th className="text-right pb-1.5 font-medium">Est. Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.lines.map((l) => (
                        <tr
                          key={l.id}
                          style={{ borderTop: '1px solid var(--hairline)', color: 'var(--ink-2)' }}
                        >
                          <td className="py-1.5 pr-4">{l.description}</td>
                          <td className="py-1.5 text-right font-mono">
                            {parseFloat(l.quantity).toLocaleString()}
                          </td>
                          <td className="py-1.5 text-right">{l.unit}</td>
                          <td className="py-1.5 text-right font-mono">
                            {l.estimatedUnitPrice
                              ? `${parseFloat(l.estimatedUnitPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${l.currency ?? ''}`
                              : '—'}
                          </td>
                          <td
                            className="py-1.5 text-right font-mono font-medium"
                            style={{ color: 'var(--ink)' }}
                          >
                            {l.estimatedTotalPrice
                              ? `${parseFloat(l.estimatedTotalPrice).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${l.currency ?? ''}`
                              : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
      </div>

      <CreateRequisitionModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          load();
        }}
      />
      <RejectRequisitionModal
        requisitionId={rejectTarget}
        onClose={() => setRejectTarget(null)}
        onRejected={() => {
          setRejectTarget(null);
          load();
        }}
      />
    </div>
  );
}

// ─── RFQs tab ─────────────────────────────────────────────────────────────────

function RFQsTab() {
  const [rfqs, setRfqs] = useState<Rfq[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quotesLoading, setQuotesLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<Rfq[]>('/rfqs')
      .then((data) => {
        setRfqs(data);
        if (data.length > 0 && !selectedId) setSelectedId(data[0]?.id ?? null);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    setQuotesLoading(true);
    api
      .get<Quote[]>(`/quotes?rfqId=${selectedId}`)
      .then(setQuotes)
      .catch(() => setQuotes([]))
      .finally(() => setQuotesLoading(false));
  }, [selectedId]);

  const awardQuote = async (quoteId: string) => {
    setActionLoading(quoteId);
    try {
      await api.post(`/quotes/${quoteId}/accept`, {});
      await api.post(`/quotes/${quoteId}/convert-to-po`, {});
      setQuotes((prev) => prev.map((q) => (q.id === quoteId ? { ...q, status: 'ACCEPTED' } : q)));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Award failed');
    } finally {
      setActionLoading(null);
    }
  };

  const selectedRfq = rfqs.find((r) => r.id === selectedId);

  return (
    <div className="flex flex-1 min-h-0 h-full">
      {/* Left rail */}
      <section
        style={{
          width: 300,
          flexShrink: 0,
          background: 'var(--surface)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="px-4 py-2.5 text-[10.5px] font-semibold uppercase tracking-widest"
          style={{ borderBottom: '1px solid var(--hairline)', color: 'var(--ink-3)' }}
        >
          RFQs · {rfqs.filter((r) => r.status !== 'closed').length} open
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="p-6 flex justify-center">
              <Spinner />
            </div>
          )}
          {!loading && rfqs.length === 0 && (
            <div className="p-6 text-xs text-center" style={{ color: 'var(--ink-3)' }}>
              No RFQs yet.
            </div>
          )}
          {!loading &&
            rfqs.map((r) => {
              const isActive = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  onClick={() => setSelectedId(r.id)}
                  className="w-full px-4 py-3 text-left transition-colors"
                  style={{
                    background: isActive ? 'var(--surface-sunk)' : 'transparent',
                    border: 'none',
                    borderTop: '1px solid var(--hairline)',
                    cursor: 'pointer',
                  }}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[11px]" style={{ color: 'var(--ink-2)' }}>
                      {r.id.slice(0, 8)}
                    </span>
                    <Badge color={r.status === 'closed' ? 'slate' : 'blue'}>
                      {r.status.toUpperCase()}
                    </Badge>
                  </div>
                  <div className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
                    {r.title}
                  </div>
                  {r.dueAt && (
                    <div className="text-[11px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                      closes <span className="font-mono">{fmtDate(r.dueAt)}</span>
                    </div>
                  )}
                </button>
              );
            })}
        </div>
      </section>

      {/* Right: quote comparison */}
      <section
        className="flex-1 flex flex-col min-w-0 overflow-auto"
        style={{ background: 'var(--bg)' }}
      >
        {!selectedRfq && (
          <div
            className="flex-1 flex items-center justify-center text-xs"
            style={{ color: 'var(--ink-3)' }}
          >
            Select an RFQ to compare quotes.
          </div>
        )}
        {selectedRfq && (
          <>
            {/* RFQ header */}
            <div
              className="px-5 py-3 flex items-start gap-4 flex-shrink-0"
              style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                    {selectedRfq.id.slice(0, 8)}
                  </span>
                  <Badge color={selectedRfq.status === 'closed' ? 'slate' : 'blue'}>
                    {selectedRfq.status.toUpperCase()}
                  </Badge>
                </div>
                <div className="text-[15px] font-semibold" style={{ color: 'var(--ink)' }}>
                  {selectedRfq.title}
                </div>
                {selectedRfq.issuedAt && (
                  <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--ink-3)' }}>
                    Issued <span className="font-mono">{fmtDate(selectedRfq.issuedAt)}</span>
                    {selectedRfq.dueAt && (
                      <>
                        {' '}
                        · closes <span className="font-mono">{fmtDate(selectedRfq.dueAt)}</span>
                      </>
                    )}
                  </div>
                )}
              </div>
              <Button size="sm" variant="secondary">
                Email suppliers
              </Button>
            </div>

            {/* Quote comparison */}
            <div className="p-5">
              {quotesLoading && (
                <div className="flex justify-center py-8">
                  <Spinner />
                </div>
              )}
              {!quotesLoading && quotes.length === 0 && (
                <div
                  className="rounded-3 p-10 text-center text-xs"
                  style={{
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                    color: 'var(--ink-3)',
                  }}
                >
                  Quotes are still coming in.
                  {selectedRfq.dueAt && ` Closes ${fmtDate(selectedRfq.dueAt)}.`}
                </div>
              )}
              {!quotesLoading &&
                quotes.length > 0 &&
                (() => {
                  const bestIdx = quotes.reduce((best, q, i) => {
                    const v = parseFloat(q.totalAmount ?? '999999999');
                    return v < parseFloat(quotes[best]?.totalAmount ?? '999999999') ? i : best;
                  }, 0);
                  return (
                    <div
                      className="overflow-hidden rounded-3"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: `160px repeat(${quotes.length}, minmax(0, 1fr))`,
                        gap: 1,
                        background: 'var(--hairline)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {/* Header row */}
                      <div className="px-3 py-2.5" style={{ background: 'var(--surface-2)' }}>
                        <span
                          className="text-[10.5px] font-semibold uppercase tracking-widest"
                          style={{ color: 'var(--ink-3)' }}
                        >
                          Compare
                        </span>
                      </div>
                      {quotes.map((q) => (
                        <div
                          key={q.id}
                          className="px-3 py-2.5"
                          style={{ background: 'var(--surface)' }}
                        >
                          <div className="flex items-center gap-2">
                            <span
                              className="text-[12.5px] font-semibold"
                              style={{ color: 'var(--ink)' }}
                            >
                              {q.supplier?.name ?? '—'}
                            </span>
                            {q.status === 'accepted' && <Badge color="green">SELECTED</Badge>}
                          </div>
                          <span
                            className="font-mono text-[10.5px]"
                            style={{ color: 'var(--ink-3)' }}
                          >
                            {q.id.slice(0, 8)}
                          </span>
                        </div>
                      ))}

                      {/* Total row */}
                      <div
                        className="px-3 py-2.5 flex items-center text-[11px] font-medium uppercase tracking-widest"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}
                      >
                        Total
                      </div>
                      {quotes.map((q, i) => {
                        const isBest = i === bestIdx;
                        return (
                          <div
                            key={q.id}
                            className="px-3 py-2.5 flex flex-col gap-1"
                            style={{ background: 'var(--surface)' }}
                          >
                            <span
                              className="font-mono text-[15px] font-semibold"
                              style={{
                                color: isBest ? 'var(--sig-green)' : 'var(--ink)',
                                fontVariantNumeric: 'tabular-nums',
                              }}
                            >
                              {q.totalAmount ? fmtAmt(q.totalAmount, q.currency ?? 'USD') : '—'}
                            </span>
                            {isBest && <Badge color="green">LOWEST</Badge>}
                          </div>
                        );
                      })}

                      {/* Notes row */}
                      <div
                        className="px-3 py-2.5 flex items-center text-[11px] font-medium uppercase tracking-widest"
                        style={{ background: 'var(--surface)', color: 'var(--ink-3)' }}
                      >
                        Notes
                      </div>
                      {quotes.map((q) => (
                        <div
                          key={q.id}
                          className="px-3 py-2.5 text-[12px]"
                          style={{ background: 'var(--surface)', color: 'var(--ink-2)' }}
                        >
                          {q.notes ?? '—'}
                        </div>
                      ))}

                      {/* Valid until row */}
                      <div
                        className="px-3 py-2.5 flex items-center text-[11px] font-medium uppercase tracking-widest"
                        style={{ background: 'var(--surface-2)', color: 'var(--ink-3)' }}
                      >
                        Valid until
                      </div>
                      {quotes.map((q) => (
                        <div
                          key={q.id}
                          className="px-3 py-2.5 text-[12px]"
                          style={{ background: 'var(--surface)', color: 'var(--ink-2)' }}
                        >
                          {q.validUntil ? fmtDate(q.validUntil) : '—'}
                        </div>
                      ))}

                      {/* Actions row */}
                      <div className="px-3 py-2.5" style={{ background: 'var(--surface)' }} />
                      {quotes.map((q) => (
                        <div
                          key={q.id}
                          className="px-3 py-2.5"
                          style={{ background: 'var(--surface)' }}
                        >
                          {q.status === 'accepted' ? (
                            <Button size="sm" style={{ width: '100%' }} disabled>
                              Awarded
                            </Button>
                          ) : q.status === 'rejected' ? (
                            <span className="text-xs" style={{ color: 'var(--ink-4)' }}>
                              Rejected
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="secondary"
                              style={{ width: '100%' }}
                              loading={actionLoading === q.id}
                              onClick={() => awardQuote(q.id)}
                            >
                              Award & convert to PO
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })()}
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// ─── Purchase Orders tab ──────────────────────────────────────────────────────

const PO_STAGE_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'SENT', label: 'Sent' },
  { id: 'ACKNOWLEDGED', label: 'Confirmed' },
  { id: 'IN_TRANSIT', label: 'In Transit' },
  { id: 'PARTIALLY_RECEIVED', label: 'Partial' },
  { id: 'RECEIVED', label: 'Received' },
  { id: 'INVOICED', label: 'Invoiced' },
  { id: 'CLOSED', label: 'Closed' },
];

function PurchaseOrdersTab() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    api
      .get<PurchaseOrder[]>('/purchase-orders')
      .then(setPOs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filteredPOs = filter === 'all' ? pos : pos.filter((p) => p.status === filter);

  const sendPO = async (po: PurchaseOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!po.supplierId) {
      alert('Assign a supplier before sending.');
      return;
    }
    setActionLoading(po.id);
    try {
      await api.post(`/purchase-orders/${po.id}/send`, {});
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Send failed');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="flex flex-1 min-h-0 h-full">
      {/* Left: list */}
      <section className="flex flex-col flex-1 min-w-0 min-h-0">
        {/* Stage filter strip */}
        <div
          className="flex items-center gap-1.5 px-4 py-2 flex-shrink-0 flex-wrap"
          style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
        >
          <span
            className="text-[10.5px] font-semibold uppercase tracking-widest mr-1"
            style={{ color: 'var(--ink-3)' }}
          >
            Stage
          </span>
          {PO_STAGE_FILTERS.map((f) => (
            <Chip key={f.id} active={filter === f.id} onClick={() => setFilter(f.id)}>
              {f.label}
            </Chip>
          ))}
          <div className="flex-1" />
          <span className="text-[11px]" style={{ color: 'var(--ink-3)' }}>
            {filteredPOs.length} of {pos.length}
          </span>
        </div>

        {/* Column headers */}
        <div
          className="grid gap-2 px-4 py-2 flex-shrink-0 text-[10.5px] font-semibold uppercase tracking-widest"
          style={{
            gridTemplateColumns: '90px 1fr 100px 100px 140px 110px',
            background: 'var(--surface-sunk)',
            color: 'var(--ink-3)',
            borderBottom: '1px solid var(--border)',
          }}
        >
          <span>PO</span>
          <span>Supplier / note</span>
          <span>Port</span>
          <span>ETA</span>
          <span>Stage</span>
          <span className="text-right">Total</span>
        </div>

        {/* Rows */}
        <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface)' }}>
          {loading && (
            <div className="p-8 flex justify-center">
              <Spinner />
            </div>
          )}
          {error && (
            <div className="p-4 text-xs" style={{ color: 'var(--sig-red)' }}>
              {error}
            </div>
          )}
          {!loading && !error && filteredPOs.length === 0 && (
            <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-3)' }}>
              No purchase orders found.
            </div>
          )}
          {!loading &&
            !error &&
            filteredPOs.map((po) => (
              <div
                key={po.id}
                className="grid gap-2 px-4 py-2.5 cursor-pointer transition-colors"
                style={{
                  gridTemplateColumns: '90px 1fr 100px 100px 140px 110px',
                  borderTop: '1px solid var(--hairline)',
                  background: selectedId === po.id ? 'var(--surface-sunk)' : 'var(--surface)',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => {
                  if (selectedId !== po.id)
                    (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background =
                    selectedId === po.id ? 'var(--surface-sunk)' : 'var(--surface)';
                }}
                onClick={() => setSelectedId(selectedId === po.id ? null : po.id)}
              >
                <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                  {po.poNumber ?? po.id.slice(0, 8)}
                </span>
                <div className="min-w-0">
                  <div
                    className="text-[12.5px] font-medium truncate"
                    style={{ color: 'var(--ink)' }}
                  >
                    {po.supplier?.name ?? po.title}
                  </div>
                  {po.notes && (
                    <div className="text-[11px] truncate" style={{ color: 'var(--ink-3)' }}>
                      {po.notes}
                    </div>
                  )}
                </div>
                <span className="text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                  —
                </span>
                <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                  {po.expectedDeliveryAt ? fmtDate(po.expectedDeliveryAt) : '—'}
                </span>
                <Badge color={PO_STATUS_COLOR[po.status]}>{titleCase(po.status)}</Badge>
                <div className="text-right">
                  <div
                    className="font-mono text-[12.5px] font-semibold"
                    style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
                  >
                    {fmtAmt(po.totalAmount, po.currency)}
                  </div>
                  {po.status === 'DRAFT' && (
                    <button
                      className="text-[10.5px] font-medium mt-0.5"
                      style={{ color: 'var(--sig-blue)' }}
                      onClick={(e) => sendPO(po, e)}
                    >
                      {actionLoading === po.id ? '…' : 'Send →'}
                    </button>
                  )}
                </div>
              </div>
            ))}
        </div>
      </section>

      {/* Right: detail pane */}
      {selectedId ? (
        <PODetailPane
          key={selectedId}
          poId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={load}
        />
      ) : (
        <aside
          style={{
            width: 400,
            flexShrink: 0,
            background: 'var(--surface)',
            borderLeft: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <p className="text-xs text-center px-8" style={{ color: 'var(--ink-3)' }}>
            Select a purchase order to inspect lines, approvals, and receipt status.
          </p>
        </aside>
      )}
    </div>
  );
}

// ─── Goods Receipts tab ───────────────────────────────────────────────────────

interface FlatGrn {
  grnId: string;
  poId: string;
  poNumber: string | null;
  supplier: string | null;
  receivedAt: string;
  notes: string | null;
  linesReceived: number;
  linesTotal: number;
  hasDiscrepancy: boolean;
}

function GoodsReceiptsTab() {
  const [grns, setGrns] = useState<FlatGrn[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    // Fetch POs that have been received, then load detail to get receipts
    api
      .get<PurchaseOrder[]>('/purchase-orders')
      .then(async (pos) => {
        const receivedPOs = pos.filter((p) =>
          ['PARTIALLY_RECEIVED', 'RECEIVED', 'CLOSED', 'INVOICED'].includes(p.status),
        );
        // Fetch details with receipts (up to 20 to avoid too many requests)
        const details = await Promise.all(
          receivedPOs
            .slice(0, 20)
            .map((p) => api.get<PurchaseOrder>(`/purchase-orders/${p.id}`).catch(() => p)),
        );
        const flat: FlatGrn[] = [];
        for (const po of details) {
          if (!po.receipts) continue;
          for (const r of po.receipts) {
            const linesTotal = r.lines.length;
            const linesReceived = r.lines.filter(
              (l) => parseFloat(l.quantityReceived) >= parseFloat(l.quantityOrdered),
            ).length;
            flat.push({
              grnId: r.id,
              poId: po.id,
              poNumber: po.poNumber,
              supplier: po.supplier?.name ?? null,
              receivedAt: r.receivedAt,
              notes: r.notes,
              linesReceived,
              linesTotal,
              hasDiscrepancy: linesReceived < linesTotal,
            });
          }
        }
        flat.sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
        setGrns(flat);
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Column headers */}
      <div
        className="grid gap-2 px-4 py-2 flex-shrink-0 text-[10.5px] font-semibold uppercase tracking-widest"
        style={{
          gridTemplateColumns: '90px 90px 1fr 100px 110px 90px',
          background: 'var(--surface-sunk)',
          color: 'var(--ink-3)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>GRN</span>
        <span>Against PO</span>
        <span>Supplier</span>
        <span>Date</span>
        <span>Receipt</span>
        <span>Discrepancy</span>
      </div>

      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface)' }}>
        {loading && (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {!loading && grns.length === 0 && (
          <div className="p-10 text-center text-xs" style={{ color: 'var(--ink-3)' }}>
            No goods receipts yet.
          </div>
        )}
        {!loading &&
          grns.map((g) => (
            <div
              key={g.grnId}
              className="grid gap-2 px-4 py-2.5 items-center"
              style={{
                gridTemplateColumns: '90px 90px 1fr 100px 90px 1fr',
                borderTop: '1px solid var(--hairline)',
              }}
            >
              <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                {g.grnId.slice(0, 8)}
              </span>
              <span className="font-mono text-[11.5px]" style={{ color: 'var(--ink-2)' }}>
                {g.poNumber ?? g.poId.slice(0, 8)}
              </span>
              <span className="text-[12.5px]" style={{ color: 'var(--ink)' }}>
                {g.supplier ?? '—'}
              </span>
              <span className="font-mono text-[11px]" style={{ color: 'var(--ink-3)' }}>
                {fmtDate(g.receivedAt)}
              </span>
              <Badge color={g.hasDiscrepancy ? 'amber' : 'green'}>
                {g.linesReceived}/{g.linesTotal} lines
              </Badge>
              <span
                className="text-[11.5px] truncate"
                style={{ color: g.hasDiscrepancy ? 'var(--sig-amber)' : 'var(--ink-3)' }}
              >
                {g.notes ?? (g.hasDiscrepancy ? 'Partial receipt' : 'Full receipt')}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
}

// ─── Suppliers tab ────────────────────────────────────────────────────────────

interface SupplierFull {
  id: string;
  name: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  country: string | null;
  isActive: boolean;
}

function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<SupplierFull[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<SupplierFull | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get<SupplierFull[]>('/suppliers')
      .then(setSuppliers)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete supplier "${name}"?`)) return;
    try {
      await api.delete(`/suppliers/${id}`);
      load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Delete failed');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--hairline)' }}
      >
        <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
          Vendors available when creating purchase orders.
        </span>
        <Button size="sm" onClick={() => setCreating(true)}>
          + New Supplier
        </Button>
      </div>

      {/* Column headers */}
      <div
        className="grid gap-2 px-4 py-2 flex-shrink-0 text-[10.5px] font-semibold uppercase tracking-widest"
        style={{
          gridTemplateColumns: '1fr 130px 160px 100px 80px',
          background: 'var(--surface-sunk)',
          color: 'var(--ink-3)',
          borderBottom: '1px solid var(--border)',
        }}
      >
        <span>Name</span>
        <span>Contact</span>
        <span>Email</span>
        <span>Country</span>
        <span />
      </div>

      <div className="flex-1 overflow-y-auto" style={{ background: 'var(--surface)' }}>
        {loading && (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {error && (
          <div className="p-4 text-xs" style={{ color: 'var(--sig-red)' }}>
            {error}
          </div>
        )}
        {!loading && !error && suppliers.length === 0 && (
          <div className="p-10 text-center">
            <p className="text-xs mb-2" style={{ color: 'var(--ink-3)' }}>
              No suppliers yet.
            </p>
            <button
              className="text-xs font-medium underline"
              style={{ color: 'var(--sig-blue)' }}
              onClick={() => setCreating(true)}
            >
              Add the first one
            </button>
          </div>
        )}
        {!loading &&
          !error &&
          suppliers.map((s) => (
            <div
              key={s.id}
              className="group grid gap-2 px-4 py-2.5 transition-colors items-center"
              style={{
                gridTemplateColumns: '1fr 130px 160px 100px 80px',
                borderTop: '1px solid var(--hairline)',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = 'var(--surface-2)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLDivElement).style.background = '';
              }}
            >
              <span className="text-[12.5px] font-medium" style={{ color: 'var(--ink)' }}>
                {s.name}
              </span>
              <span className="text-xs" style={{ color: 'var(--ink-2)' }}>
                {s.contactName ?? '—'}
              </span>
              <span className="text-xs truncate" style={{ color: 'var(--ink-2)' }}>
                {s.contactEmail ?? '—'}
              </span>
              <span className="text-xs" style={{ color: 'var(--ink-3)' }}>
                {s.country ?? '—'}
              </span>
              <div className="flex gap-2 justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="text-xs font-medium"
                  style={{ color: 'var(--ink-2)' }}
                  onClick={() => setEditing(s)}
                >
                  Edit
                </button>
                <button
                  className="text-xs font-medium"
                  style={{ color: 'var(--sig-red)' }}
                  onClick={() => handleDelete(s.id, s.name)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
      </div>

      <CreateSupplierModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => {
          setCreating(false);
          load();
        }}
      />
      {editing && (
        <EditSupplierModal
          supplier={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// ─── Footer stats bar ─────────────────────────────────────────────────────────

function FooterStats({ pos }: { pos: PurchaseOrder[] }) {
  const inTransit = pos.filter((p) =>
    ['IN_TRANSIT', 'PARTIALLY_RECEIVED'].includes(p.status),
  ).length;
  const active = pos.filter((p) => ['SENT', 'ACKNOWLEDGED'].includes(p.status)).length;
  const openValue = pos
    .filter((p) => !['CLOSED', 'CANCELLED'].includes(p.status))
    .reduce((sum, p) => sum + parseFloat(p.totalAmount || '0'), 0);

  return (
    <div
      className="flex items-center gap-3 px-4 py-2 flex-shrink-0 text-[11.5px]"
      style={{
        background: 'var(--surface)',
        borderTop: '1px solid var(--border)',
        color: 'var(--ink-2)',
      }}
    >
      <span>
        <b className="font-mono" style={{ color: 'var(--ink)' }}>
          {pos.length}
        </b>{' '}
        POs
      </span>
      <span style={{ color: 'var(--hairline)' }}>·</span>
      <span>
        <b className="font-mono" style={{ color: 'var(--sig-amber)' }}>
          {inTransit}
        </b>{' '}
        in transit
      </span>
      <span style={{ color: 'var(--hairline)' }}>·</span>
      <span>
        <b className="font-mono" style={{ color: 'var(--sig-blue)' }}>
          {active}
        </b>{' '}
        active
      </span>
      <div className="flex-1" />
      <span style={{ color: 'var(--ink-3)' }}>Open PO value</span>
      <span
        className="font-mono text-[13px] font-semibold"
        style={{ color: 'var(--ink)', fontVariantNumeric: 'tabular-nums' }}
      >
        {openValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Tab = 'requisitions' | 'rfq' | 'po' | 'grn' | 'suppliers';

const TABS: { id: Tab; label: string }[] = [
  { id: 'requisitions', label: 'Requisitions' },
  { id: 'rfq', label: 'RFQs' },
  { id: 'po', label: 'Purchase Orders' },
  { id: 'grn', label: 'Goods Receipts' },
  { id: 'suppliers', label: 'Suppliers' },
];

export function PurchasePage() {
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as Tab | null) ?? 'requisitions';
  const [search, setSearch] = useState('');
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api
      .get<PurchaseOrder[]>('/purchase-orders')
      .then(setPOs)
      .catch(() => undefined);
  }, [tab]);

  const setTab = (t: Tab) => {
    setParams(t === 'requisitions' ? {} : { tab: t });
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
      {/* Sub-header */}
      <div
        className="flex items-center gap-3 px-4 py-2.5 flex-shrink-0"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        <h1
          className="text-[16px] font-semibold m-0"
          style={{ color: 'var(--ink)', letterSpacing: '-0.01em' }}
        >
          Purchase
        </h1>
        <div className="flex-1" />
        {/* Search */}
        <div
          className="flex items-center gap-2 px-3 h-7 rounded-2 text-[12px]"
          style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            color: 'var(--ink-3)',
            width: 220,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
            <path
              d="M10.5 10.5 L14 14"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search PO, supplier, requisition…"
            className="flex-1 bg-transparent outline-none text-[12px]"
            style={{ color: 'var(--ink)', border: 'none' }}
          />
        </div>
        <Button size="sm" onClick={() => setCreating(true)}>
          + New Requisition
        </Button>
      </div>

      {/* Tab bar */}
      <div
        className="flex gap-0 flex-shrink-0 px-4"
        style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-4 py-2.5 text-[13px] font-medium border-b-2 transition-colors flex items-center gap-2"
            style={
              tab === t.id
                ? { borderBottomColor: 'var(--navy)', color: 'var(--navy)', marginBottom: '-1px' }
                : { borderBottomColor: 'transparent', color: 'var(--ink-3)' }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content — fills remaining space */}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'requisitions' && <RequisitionsTab />}
        {tab === 'rfq' && <RFQsTab />}
        {tab === 'po' && <PurchaseOrdersTab />}
        {tab === 'grn' && <GoodsReceiptsTab />}
        {tab === 'suppliers' && <SuppliersTab />}
      </div>

      {/* Footer */}
      <FooterStats pos={pos} />

      <CreateRequisitionModal
        open={creating}
        onClose={() => setCreating(false)}
        onCreated={() => setCreating(false)}
      />
    </div>
  );
}
