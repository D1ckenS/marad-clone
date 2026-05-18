import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select, Spinner } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Location {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  partId: string;
  partName: string;
  onClose: () => void;
  onPosted: () => void;
}

const MOVEMENT_TYPES = ['RECEIPT', 'CONSUMPTION', 'ADJUSTMENT'] as const;
type MovementType = (typeof MOVEMENT_TYPES)[number];

const TYPE_HELP: Record<MovementType, string> = {
  RECEIPT: 'Stock received / delivered on board. Always positive.',
  CONSUMPTION: 'Stock used during a job. Enter as positive — automatically deducted.',
  ADJUSTMENT: 'Manual correction. Use negative to reduce ROB (e.g. "-5").',
};

export function PostStockMovementModal({ open, partId, partName, onClose, onPosted }: Props) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [movementType, setMovementType] = useState<MovementType>('RECEIPT');
  const [quantity, setQuantity] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocationId('');
    setMovementType('RECEIPT');
    setQuantity('');
    setNotes('');
    setError(null);
    setLoadingLocs(true);
    api
      .get<Location[]>('/stock-locations')
      .then(setLocations)
      .catch(() => setError('Could not load locations.'))
      .finally(() => setLoadingLocs(false));
  }, [open]);

  const handleClose = () => {
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!locationId) {
      setError('Select a location.');
      return;
    }
    const qty = parseFloat(quantity);
    if (!quantity || isNaN(qty) || qty === 0) {
      setError('Enter a non-zero quantity.');
      return;
    }

    // CONSUMPTION is entered as a positive number but stored as negative.
    const signedQty = movementType === 'CONSUMPTION' ? (-Math.abs(qty)).toString() : qty.toString();

    setSaving(true);
    setError(null);
    try {
      await api.post('/stock-movements', {
        partId,
        locationId,
        movementType,
        quantity: signedQty,
        notes: notes.trim() || undefined,
        recordedAt: new Date().toISOString(),
      });
      onPosted();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to post movement.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Post Stock Movement — ${partName}`}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Post
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Movement type *</label>
          <div className="flex rounded-md border border-slate-200 overflow-hidden text-sm">
            {MOVEMENT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => setMovementType(t)}
                className={`flex-1 py-1.5 px-2 transition-colors ${movementType === t ? 'bg-blue-600 text-white font-medium' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {t.charAt(0) + t.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-slate-500">{TYPE_HELP[movementType]}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="sm-loc">
            Location *
          </label>
          {loadingLocs ? (
            <Spinner />
          ) : (
            <Select
              value={locationId}
              onChange={setLocationId}
              options={locations.map((l) => ({ value: l.id, label: l.name }))}
              placeholder="— Select location —"
            />
          )}
        </div>

        <Input
          id="sm-qty"
          label={movementType === 'ADJUSTMENT' ? 'Quantity (signed)' : 'Quantity *'}
          type="number"
          step="0.01"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder={movementType === 'ADJUSTMENT' ? '-5 or +10' : '50'}
        />

        <Input
          id="sm-notes"
          label="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional reference or reason"
        />
      </div>
    </Modal>
  );
}
