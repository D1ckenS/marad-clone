import { useState } from 'react';
import { Badge, type BadgeColor, Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

// Locally-defined to avoid circular imports with PurchasePage
interface POLine {
  id: string;
  description: string;
  quantity: string;
  unit: string;
  unitPrice: string;
  totalPrice: string;
  currency: string;
}

interface Supplier {
  id: string;
  name: string;
}

interface GoodsReceiptLine {
  id: string;
  poLineId: string;
  description: string;
  quantityOrdered: string;
  quantityReceived: string;
  unit: string;
}

interface GoodsReceipt {
  id: string;
  receivedAt: string;
  notes: string | null;
  lines: GoodsReceiptLine[];
}

type POStatus =
  | 'DRAFT'
  | 'SENT'
  | 'ACKNOWLEDGED'
  | 'IN_TRANSIT'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED'
  | 'CLOSED';

interface PurchaseOrder {
  id: string;
  title: string;
  notes: string | null;
  status: POStatus;
  poNumber: string | null;
  totalAmount: string;
  currency: string;
  supplier: Supplier | null;
  expectedDeliveryAt: string | null;
  lines: POLine[];
  receipts?: GoodsReceipt[];
}

interface Props {
  po: PurchaseOrder;
  onClose: () => void;
  onGrnPosted: () => void;
}

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

const canReceive = (s: POStatus) =>
  (['SENT', 'ACKNOWLEDGED', 'IN_TRANSIT', 'PARTIALLY_RECEIVED'] as POStatus[]).includes(s);

// --- GRN entry section (shown inline when PO is receivable) ---
interface GrnSectionProps {
  po: PurchaseOrder;
  onPosted: () => void;
}

function GrnSection({ po, onPosted }: GrnSectionProps) {
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
    <div className="mt-6 border-t border-slate-200 pt-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-3">Post Goods Receipt</h3>
      {error && (
        <div className="mb-3 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
      )}
      <table className="w-full text-left text-sm mb-4">
        <thead>
          <tr className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <th className="pb-2">Description</th>
            <th className="pb-2 text-right">Ordered</th>
            <th className="pb-2 text-right w-32">Received</th>
          </tr>
        </thead>
        <tbody>
          {po.lines.map((line) => (
            <tr key={line.id} className="border-t border-slate-100">
              <td className="py-2 pr-4 text-slate-800">{line.description}</td>
              <td className="py-2 pr-4 text-right font-mono text-slate-500">
                {parseFloat(line.quantity).toLocaleString()} {line.unit}
              </td>
              <td className="py-2">
                <Input
                  type="number"
                  min="0"
                  step="0.001"
                  value={qtys[line.id] ?? line.quantity}
                  onChange={(e) => setQtys((q) => ({ ...q, [line.id]: e.target.value }))}
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
        placeholder="Delivery note number, condition remarks..."
      />
      <div className="mt-3 flex justify-end">
        <Button loading={saving} onClick={handlePost}>
          Post GRN
        </Button>
      </div>
    </div>
  );
}

// --- Main Modal ---
export function PODetailModal({ po, onClose, onGrnPosted }: Props) {
  return (
    <Modal open title={po.title} onClose={onClose} size="lg">
      {/* PO header info */}
      <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm mb-5">
        <div>
          <span className="text-slate-500">Status</span>
          <div className="mt-0.5">
            <Badge color={PO_STATUS_COLOR[po.status]}>{titleCase(po.status)}</Badge>
          </div>
        </div>
        {po.poNumber && (
          <div>
            <span className="text-slate-500">PO Number</span>
            <div className="mt-0.5 font-mono text-slate-700">{po.poNumber}</div>
          </div>
        )}
        <div>
          <span className="text-slate-500">Supplier</span>
          <div className="mt-0.5 text-slate-700">
            {po.supplier?.name ?? <span className="text-slate-400 italic">Not set</span>}
          </div>
        </div>
        <div>
          <span className="text-slate-500">Total</span>
          <div className="mt-0.5 font-mono font-medium text-slate-800">
            {parseFloat(po.totalAmount).toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            {po.currency}
          </div>
        </div>
        {po.expectedDeliveryAt && (
          <div>
            <span className="text-slate-500">Expected Delivery</span>
            <div className="mt-0.5 text-slate-700">{fmtDate(po.expectedDeliveryAt)}</div>
          </div>
        )}
        {po.notes && (
          <div className="col-span-2">
            <span className="text-slate-500">Notes</span>
            <div className="mt-0.5 text-slate-700">{po.notes}</div>
          </div>
        )}
      </div>

      {/* PO lines */}
      <h3 className="text-sm font-semibold text-slate-700 mb-2">Order Lines</h3>
      {po.lines.length === 0 ? (
        <p className="text-sm text-slate-400 italic mb-4">No lines on this order.</p>
      ) : (
        <table className="w-full text-left text-sm mb-4">
          <thead>
            <tr className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wide">
              <th className="py-2 px-3">Description</th>
              <th className="py-2 px-3 text-right">Qty</th>
              <th className="py-2 px-3 text-right">Unit Price</th>
              <th className="py-2 px-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {po.lines.map((line) => (
              <tr key={line.id} className="border-t border-slate-100">
                <td className="py-2 px-3 text-slate-800">{line.description}</td>
                <td className="py-2 px-3 text-right font-mono text-slate-600">
                  {parseFloat(line.quantity).toLocaleString()} {line.unit}
                </td>
                <td className="py-2 px-3 text-right font-mono text-slate-600">
                  {parseFloat(line.unitPrice).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  {line.currency}
                </td>
                <td className="py-2 px-3 text-right font-mono text-slate-700 font-medium">
                  {parseFloat(line.totalPrice).toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}{' '}
                  {line.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Receipt history */}
      {po.receipts && po.receipts.length > 0 && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-2">Goods Receipts</h3>
          <div className="space-y-2">
            {po.receipts.map((r) => (
              <div key={r.id} className="border border-slate-200 rounded-lg px-4 py-3 text-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-slate-700">GRN — {fmtDate(r.receivedAt)}</span>
                  {r.notes && <span className="text-slate-500 text-xs">{r.notes}</span>}
                </div>
                <div className="text-xs text-slate-500 space-y-0.5">
                  {r.lines.map((rl) => (
                    <div key={rl.id}>
                      {rl.description}: received{' '}
                      <span className="font-mono font-medium text-slate-700">
                        {parseFloat(rl.quantityReceived).toLocaleString()} {rl.unit}
                      </span>{' '}
                      of {parseFloat(rl.quantityOrdered).toLocaleString()}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GRN entry — only when PO is in a receivable state and has lines */}
      {canReceive(po.status) && po.lines.length > 0 && (
        <GrnSection po={po} onPosted={onGrnPosted} />
      )}
    </Modal>
  );
}
