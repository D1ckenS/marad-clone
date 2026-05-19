import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  onSaved: () => void;
}

const NEW_LOC = '__new__';

export function AddStockLevelModal({ open, partId, partName, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<Location[]>([]);
  const [loadingLocs, setLoadingLocs] = useState(false);
  const [locationId, setLocationId] = useState('');
  const [newLocName, setNewLocName] = useState('');
  const [minStock, setMinStock] = useState('');
  const [reorderPoint, setReorderPoint] = useState('');
  const [maxStock, setMaxStock] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLocationId('');
    setNewLocName('');
    setMinStock('');
    setReorderPoint('');
    setMaxStock('');
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
      setError('Select or create a location.');
      return;
    }
    if (locationId === NEW_LOC && !newLocName.trim()) {
      setError('Enter a location name.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let resolvedLocationId = locationId;
      if (locationId === NEW_LOC) {
        const loc = await api.post<Location>('/stock-locations', { name: newLocName.trim() });
        resolvedLocationId = loc.id;
      }
      await api.post('/stock-levels', {
        partId,
        locationId: resolvedLocationId,
        minStock: minStock || undefined,
        reorderPoint: reorderPoint || undefined,
        maxStock: maxStock || undefined,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save stock level.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={`Stock Config — ${partName}`}
      onClose={handleClose}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {t('common.save')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="sl-loc">
            Location *
          </label>
          {loadingLocs ? (
            <Spinner />
          ) : (
            <Select
              value={locationId}
              onChange={setLocationId}
              options={[
                ...locations.map((l) => ({ value: l.id, label: l.name })),
                { value: NEW_LOC, label: '+ Create new location…' },
              ]}
              placeholder="— Select —"
            />
          )}
        </div>

        {locationId === NEW_LOC && (
          <Input
            id="sl-locname"
            label="New location name *"
            value={newLocName}
            onChange={(e) => setNewLocName(e.target.value)}
            placeholder="Engine Room Store"
            autoFocus
          />
        )}

        <div className="grid grid-cols-3 gap-3">
          <Input
            id="sl-min"
            label="Min stock"
            type="number"
            min="0"
            step="0.1"
            value={minStock}
            onChange={(e) => setMinStock(e.target.value)}
            placeholder="20"
          />
          <Input
            id="sl-reorder"
            label="Reorder point"
            type="number"
            min="0"
            step="0.1"
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
            placeholder="40"
          />
          <Input
            id="sl-max"
            label="Max stock"
            type="number"
            min="0"
            step="0.1"
            value={maxStock}
            onChange={(e) => setMaxStock(e.target.value)}
            placeholder="200"
          />
        </div>

        <div className="text-xs text-slate-500 bg-slate-50 px-3 py-2 rounded-md space-y-1">
          <p>
            <span className="font-medium">Min:</span> chip turns red below this level.
          </p>
          <p>
            <span className="font-medium">Reorder:</span> chip turns amber; auto-requisition created
            on sign-off.
          </p>
          <p>
            <span className="font-medium">Max:</span> informational upper limit.
          </p>
        </div>
      </div>
    </Modal>
  );
}
