import { useCallback, useEffect, useState } from 'react';
import { Badge, type BadgeColor, Button, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { CreateRequisitionModal } from '../components/CreateRequisitionModal.js';
import { PODetailModal } from '../components/PODetailModal.js';
import { RejectRequisitionModal } from '../components/RejectRequisitionModal.js';

// --- Shared types ---
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

// --- Helpers ---
const titleCase = (s: string) =>
  s
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

const fmtAmount = (amount: string, currency: string) =>
  `${parseFloat(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;

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

// --- Requisitions Tab ---
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
    <div>
      <div className="mb-4 flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {REQ_FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f === 'ALL' ? 'All' : titleCase(f)}
            </button>
          ))}
        </div>
        <Button onClick={() => setCreating(true)}>+ New Requisition</Button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {error && <div className="p-6 text-sm text-red-600">{error}</div>}
        {!loading && !error && reqs.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">No requisitions found.</div>
        )}
        {!loading && !error && reqs.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Requested</th>
                <th className="py-3 px-4">Lines</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {reqs.map((r) => (
                <tr key={r.id} className="border-t border-slate-100 hover:bg-slate-50">
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800 text-sm">{r.title}</div>
                    {r.rejectionReason && (
                      <div className="text-xs text-red-500 mt-0.5">{r.rejectionReason}</div>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge color={REQ_STATUS_COLOR[r.status]}>{titleCase(r.status)}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm font-mono text-slate-700">
                    {fmtAmount(r.totalAmount, r.currency)}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">{fmtDate(r.requestedAt)}</td>
                  <td className="py-3 px-4 text-sm text-slate-500">{r.lines.length}</td>
                  <td className="py-3 px-4">
                    <div className="flex gap-2">
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
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
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

// --- Purchase Orders Tab ---
const PO_FILTERS = [
  'ALL',
  'DRAFT',
  'SENT',
  'IN_TRANSIT',
  'PARTIALLY_RECEIVED',
  'RECEIVED',
] as const;
type POFilter = (typeof PO_FILTERS)[number];

const canReceive = (s: POStatus) =>
  (['SENT', 'ACKNOWLEDGED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'] as POStatus[]).includes(s);

function PurchaseOrdersTab() {
  const [pos, setPOs] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<POFilter>('ALL');
  const [selected, setSelected] = useState<PurchaseOrder | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    const url = filter === 'ALL' ? '/purchase-orders' : `/purchase-orders?status=${filter}`;
    api
      .get<PurchaseOrder[]>(url)
      .then(setPOs)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const sendPO = async (po: PurchaseOrder, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!po.supplierId) {
      alert('A supplier must be set before sending a purchase order.');
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

  const openDetail = async (po: PurchaseOrder) => {
    try {
      const detail = await api.get<PurchaseOrder>(`/purchase-orders/${po.id}`);
      setSelected(detail);
    } catch {
      setSelected(po);
    }
  };

  return (
    <div>
      <div className="mb-4 flex gap-2 flex-wrap">
        {PO_FILTERS.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f
                ? 'bg-slate-800 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            {f === 'ALL' ? 'All' : titleCase(f)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading && (
          <div className="p-8 flex justify-center">
            <Spinner />
          </div>
        )}
        {error && <div className="p-6 text-sm text-red-600">{error}</div>}
        {!loading && !error && pos.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">No purchase orders found.</div>
        )}
        {!loading && !error && pos.length > 0 && (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <th className="py-3 px-4">Title / PO#</th>
                <th className="py-3 px-4">Supplier</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Amount</th>
                <th className="py-3 px-4">Expected</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pos.map((po) => (
                <tr
                  key={po.id}
                  className="border-t border-slate-100 hover:bg-slate-50 cursor-pointer"
                  onClick={() => openDetail(po)}
                >
                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-800 text-sm">{po.title}</div>
                    {po.poNumber && (
                      <div className="text-xs text-slate-400 font-mono mt-0.5">{po.poNumber}</div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-600">
                    {po.supplier ? (
                      po.supplier.name
                    ) : (
                      <span className="text-slate-400 italic">Not set</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    <Badge color={PO_STATUS_COLOR[po.status]}>{titleCase(po.status)}</Badge>
                  </td>
                  <td className="py-3 px-4 text-sm font-mono text-slate-700">
                    {fmtAmount(po.totalAmount, po.currency)}
                  </td>
                  <td className="py-3 px-4 text-sm text-slate-500">
                    {po.expectedDeliveryAt ? fmtDate(po.expectedDeliveryAt) : '—'}
                  </td>
                  <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {po.status === 'DRAFT' && (
                        <Button
                          size="sm"
                          loading={actionLoading === po.id}
                          onClick={(e) => sendPO(po, e)}
                        >
                          Send
                        </Button>
                      )}
                      {canReceive(po.status) && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(po);
                          }}
                        >
                          Receive
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <PODetailModal
          po={selected}
          onClose={() => setSelected(null)}
          onGrnPosted={() => {
            setSelected(null);
            load();
          }}
        />
      )}
    </div>
  );
}

// --- Main Page ---
type Tab = 'requisitions' | 'purchase-orders';

export function PurchasePage() {
  const [tab, setTab] = useState<Tab>('requisitions');

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">Purchase</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Requisitions, purchase orders, and goods receipts
        </p>
      </div>

      <div className="flex gap-0 mb-6 border-b border-slate-200">
        {(['requisitions', 'purchase-orders'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              tab === t
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'requisitions' ? 'Requisitions' : 'Purchase Orders'}
          </button>
        ))}
      </div>

      {tab === 'requisitions' ? <RequisitionsTab /> : <PurchaseOrdersTab />}
    </div>
  );
}
