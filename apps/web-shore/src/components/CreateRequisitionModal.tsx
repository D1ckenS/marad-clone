import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

interface Part {
  id: string;
  name: string;
  unit: string;
}

interface ReqLine {
  partId?: string;
  partName?: string | undefined;
  description: string;
  quantity: string;
  unit: string;
  estimatedUnitPrice: string;
}

const EMPTY_HEADER = { title: '', notes: '', currency: 'USD' };
const EMPTY_LINE: ReqLine = {
  partId: '',
  description: '',
  quantity: '1',
  unit: 'pcs',
  estimatedUnitPrice: '',
};

export function CreateRequisitionModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [header, setHeader] = useState(EMPTY_HEADER);
  const [lines, setLines] = useState<ReqLine[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [showAddLine, setShowAddLine] = useState(false);
  const [newLine, setNewLine] = useState<ReqLine>(EMPTY_LINE);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open)
      api
        .get<Part[]>('/parts')
        .then(setParts)
        .catch(() => undefined);
  }, [open]);

  const setH =
    (field: keyof typeof EMPTY_HEADER) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setHeader((h) => ({ ...h, [field]: e.target.value }));

  const handleClose = () => {
    setHeader(EMPTY_HEADER);
    setLines([]);
    setNewLine(EMPTY_LINE);
    setShowAddLine(false);
    setError(null);
    onClose();
  };

  const selectedPart = parts.find((p) => p.id === newLine.partId);

  const addLine = () => {
    if (!newLine.description.trim() && !newLine.partId) return;
    const desc = newLine.description.trim() || selectedPart?.name || '';
    if (!desc) {
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        ...newLine,
        description: desc,
        partName: selectedPart?.name,
        unit: newLine.unit || selectedPart?.unit || 'pcs',
      },
    ]);
    setNewLine(EMPTY_LINE);
    setShowAddLine(false);
  };

  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const totalAmount = lines.reduce((sum, l) => {
    const qty = parseFloat(l.quantity) || 0;
    const price = parseFloat(l.estimatedUnitPrice) || 0;
    return sum + qty * price;
  }, 0);

  const handleSubmit = async () => {
    if (!header.title.trim()) {
      setError('Title is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const req = await api.post<{ id: string }>('/requisitions', {
        title: header.title.trim(),
        notes: header.notes.trim() || undefined,
        totalAmount: totalAmount > 0 ? totalAmount.toFixed(2) : '0',
        currency: header.currency.trim() || 'USD',
        requestedAt: new Date().toISOString(),
      });
      // Add lines sequentially.
      for (const line of lines) {
        await api.post(`/requisitions/${req.id}/lines`, {
          partId: line.partId || undefined,
          description: line.description,
          quantity: line.quantity,
          unit: line.unit || undefined,
          estimatedUnitPrice: line.estimatedUnitPrice || undefined,
          estimatedTotalPrice: line.estimatedUnitPrice
            ? (parseFloat(line.quantity) * parseFloat(line.estimatedUnitPrice)).toFixed(2)
            : undefined,
          currency: header.currency || 'USD',
        });
      }
      handleClose();
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create requisition.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="New Requisition"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {t('purchase.new_requisition')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}

        <Input
          id="req-title"
          label="Title *"
          value={header.title}
          onChange={setH('title')}
          placeholder="Engine room spares Q3"
          autoFocus
        />
        <TextArea
          id="req-notes"
          label="Notes"
          rows={2}
          value={header.notes}
          onChange={setH('notes')}
          placeholder="Additional details…"
        />
        <div className="w-28">
          <Input
            id="req-currency"
            label="Currency"
            value={header.currency}
            onChange={setH('currency')}
            placeholder="USD"
            maxLength={3}
          />
        </div>

        {/* ── Line items ─────────────────────────────────────────── */}
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">
              Line items{lines.length > 0 && ` (${lines.length})`}
            </span>
            <button
              type="button"
              onClick={() => setShowAddLine((v) => !v)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showAddLine ? 'Cancel' : '+ Add line'}
            </button>
          </div>

          {lines.length === 0 && !showAddLine && (
            <p className="text-xs text-slate-400 italic">
              No lines yet. Add parts or free-text lines.
            </p>
          )}

          {lines.map((line, idx) => (
            <div
              key={idx}
              className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0 text-sm"
            >
              <span className="flex-1 text-slate-700">{line.description}</span>
              <span className="text-slate-500 tabular-nums">
                {line.quantity} {line.unit}
              </span>
              {line.estimatedUnitPrice && (
                <span className="text-slate-400 tabular-nums">
                  @ {line.estimatedUnitPrice} {header.currency}
                </span>
              )}
              <button
                type="button"
                onClick={() => removeLine(idx)}
                className="text-slate-300 hover:text-red-500 text-xs"
              >
                ✕
              </button>
            </div>
          ))}

          {showAddLine && (
            <div className="mt-2 bg-slate-50 p-3 rounded-md space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">Part (optional)</label>
                  <Select
                    value={newLine.partId ?? ''}
                    onChange={(v) => {
                      const p = parts.find((pt) => pt.id === v);
                      setNewLine((l) => ({
                        ...l,
                        partId: v,
                        description: p?.name ?? l.description,
                        unit: p?.unit ?? l.unit,
                      }));
                    }}
                    options={parts.map((p) => ({ value: p.id, label: p.name }))}
                    placeholder="— Select or type free text —"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-xs text-slate-500 mb-1">Description *</label>
                  <input
                    value={newLine.description}
                    onChange={(e) => setNewLine((l) => ({ ...l, description: e.target.value }))}
                    placeholder="What is being requested?"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="w-16">
                  <label className="block text-xs text-slate-500 mb-1">Qty</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={newLine.quantity}
                    onChange={(e) => setNewLine((l) => ({ ...l, quantity: e.target.value }))}
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="w-16">
                  <label className="block text-xs text-slate-500 mb-1">Unit</label>
                  <input
                    value={newLine.unit}
                    onChange={(e) => setNewLine((l) => ({ ...l, unit: e.target.value }))}
                    placeholder="pcs"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div className="w-24">
                  <label className="block text-xs text-slate-500 mb-1">Unit price</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={newLine.estimatedUnitPrice}
                    onChange={(e) =>
                      setNewLine((l) => ({ ...l, estimatedUnitPrice: e.target.value }))
                    }
                    placeholder="0.00"
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
              <Button
                size="sm"
                onClick={addLine}
                disabled={!newLine.description.trim() && !newLine.partId}
              >
                Add line
              </Button>
            </div>
          )}

          {lines.length > 0 && totalAmount > 0 && (
            <div className="mt-2 text-right text-sm font-medium text-slate-700">
              Estimated total: {totalAmount.toFixed(2)} {header.currency}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
