import { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';
import { partsFromJson, type TypicalPart } from './TypicalPartsList.js';

interface Part {
  id: string;
  name: string;
  unit: string;
}
interface Location {
  id: string;
  name: string;
}

interface ConsumedLine {
  partId: string;
  partName: string;
  locationId: string;
  locationName: string;
  quantity: string;
  unit: string;
}

interface SignOffModalProps {
  jobInstanceId: string | null;
  typicalPartsJson?: string | null | undefined;
  onClose: () => void;
  onSuccess: () => void;
}

export function SignOffModal({
  jobInstanceId,
  typicalPartsJson,
  onClose,
  onSuccess,
}: SignOffModalProps) {
  const [hoursWorked, setHoursWorked] = useState('');
  const [notes, setNotes] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [consumed, setConsumed] = useState<ConsumedLine[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [showAddLine, setShowAddLine] = useState(false);
  const [addPartId, setAddPartId] = useState('');
  const [addLocationId, setAddLocationId] = useState('');
  const [addQty, setAddQty] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Load catalogue data and pre-populate from BOM when modal opens.
  useEffect(() => {
    if (!jobInstanceId) return;
    Promise.all([api.get<Part[]>('/parts'), api.get<Location[]>('/stock-locations')])
      .then(([ps, ls]) => {
        setParts(ps);
        setLocations(ls);
        // Pre-populate consumed lines from the job's typical BOM.
        const bom: TypicalPart[] = partsFromJson(typicalPartsJson);
        const firstLoc = ls[0];
        if (bom.length > 0 && firstLoc) {
          setConsumed(
            bom.map((b) => ({
              partId: b.partId,
              partName: b.partName,
              locationId: firstLoc.id,
              locationName: firstLoc.name,
              quantity: b.typicalQuantity,
              unit: b.unit,
            })),
          );
        }
      })
      .catch(() => undefined);
  }, [jobInstanceId, typicalPartsJson]);

  function reset() {
    setHoursWorked('');
    setNotes('');
    setPhotos([]);
    setConsumed([]);
    setShowAddLine(false);
    setAddPartId('');
    setAddLocationId('');
    setAddQty('');
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  const addLine = () => {
    const part = parts.find((p) => p.id === addPartId);
    const loc = locations.find((l) => l.id === addLocationId);
    if (!part || !loc || !addQty || parseFloat(addQty) <= 0) return;
    if (consumed.some((c) => c.partId === addPartId && c.locationId === addLocationId)) return;
    setConsumed((prev) => [
      ...prev,
      {
        partId: addPartId,
        partName: part.name,
        locationId: addLocationId,
        locationName: loc.name,
        quantity: addQty,
        unit: part.unit,
      },
    ]);
    setAddPartId('');
    setAddLocationId('');
    setAddQty('');
    setShowAddLine(false);
  };

  const updateQty = (idx: number, qty: string) =>
    setConsumed((prev) => prev.map((c, i) => (i === idx ? { ...c, quantity: qty } : c)));

  const updateLocation = (idx: number, locationId: string) => {
    const loc = locations.find((l) => l.id === locationId);
    setConsumed((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, locationId, locationName: loc?.name ?? locationId } : c,
      ),
    );
  };

  const removeLine = (idx: number) => setConsumed((prev) => prev.filter((_, i) => i !== idx));

  async function handleSubmit() {
    if (!jobInstanceId) return;
    setError(null);
    setLoading(true);
    try {
      const form = new FormData();
      if (hoursWorked) form.append('hoursWorked', hoursWorked);
      if (notes) form.append('notes', notes);
      if (consumed.length > 0) {
        form.append(
          'partsConsumedJson',
          JSON.stringify(
            consumed.map((c) => ({
              partId: c.partId,
              locationId: c.locationId,
              quantity: c.quantity,
            })),
          ),
        );
      }
      for (const photo of photos) form.append('photos', photo);
      await api.postForm(`/job-instances/${jobInstanceId}/sign-off`, form);
      reset();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-off failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal
      open={jobInstanceId !== null}
      title="Sign Off Job"
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={loading}>
            Cancel
          </Button>
          <Button loading={loading} onClick={handleSubmit}>
            Sign Off
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{error}</p>}

        <Input
          id="hoursWorked"
          label="Hours worked"
          type="number"
          min="0"
          step="0.5"
          placeholder="e.g. 2.5"
          value={hoursWorked}
          onChange={(e) => setHoursWorked(e.target.value)}
        />

        <TextArea
          id="notes"
          label="Notes"
          placeholder="Observations, findings…"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />

        {/* ── Parts consumed ─────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-700">Parts consumed</span>
            <button
              type="button"
              onClick={() => setShowAddLine((v) => !v)}
              className="text-xs text-blue-600 hover:underline"
            >
              {showAddLine ? 'Cancel' : '+ Add part'}
            </button>
          </div>

          {consumed.length === 0 && !showAddLine && (
            <p className="text-xs text-slate-400 italic">
              No parts recorded. Leave empty if none used.
            </p>
          )}

          {consumed.map((line, idx) => (
            <div
              key={`${line.partId}-${line.locationId}`}
              className="flex items-center gap-2 py-1.5 border-b border-slate-100 last:border-0"
            >
              <span className="flex-1 text-sm text-slate-700">{line.partName}</span>
              {/* Location selector */}
              <select
                value={line.locationId}
                onChange={(e) => updateLocation(idx, e.target.value)}
                className="text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-400 max-w-[120px]"
              >
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              {/* Quantity */}
              <input
                type="number"
                min="0.01"
                step="0.01"
                value={line.quantity}
                onChange={(e) => updateQty(idx, e.target.value)}
                className="w-16 text-sm text-right border border-slate-200 rounded px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <span className="text-xs text-slate-400 w-8">{line.unit}</span>
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
            <div className="mt-2 flex items-end gap-2 bg-slate-50 p-2 rounded-md">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">Part</label>
                <select
                  value={addPartId}
                  onChange={(e) => setAddPartId(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">— Select —</option>
                  {parts.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-32">
                <label className="block text-xs text-slate-500 mb-1">Location</label>
                <select
                  value={addLocationId}
                  onChange={(e) => setAddLocationId(e.target.value)}
                  className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="">— Select —</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-20">
                <label className="block text-xs text-slate-500 mb-1">Qty</label>
                <Input
                  id="add-qty"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={addQty}
                  onChange={(e) => setAddQty(e.target.value)}
                />
              </div>
              <Button
                size="sm"
                onClick={addLine}
                disabled={!addPartId || !addLocationId || !addQty}
              >
                Add
              </Button>
            </div>
          )}
        </div>

        {/* ── Photos ─────────────────────────────────────────────── */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-slate-700">Photos</label>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 border border-dashed border-slate-300 rounded-md px-4 py-3 text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors"
          >
            📷{' '}
            {photos.length > 0
              ? `${photos.length} file(s) selected`
              : 'Add photos (up to 10, 8 MB each)'}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          />
        </div>
      </div>
    </Modal>
  );
}
