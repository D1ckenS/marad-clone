import { useState } from 'react';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const MODE_OPTIONS = [
  { value: 'LADEN', label: 'Laden' },
  { value: 'BALLAST', label: 'Ballast' },
];

const EMPTY = {
  route: '',
  departureAt: '',
  arrivalAt: '',
  nm: '',
  fuelTonnes: '',
  co2Tonnes: '',
  soxTonnes: '',
  noxTonnes: '',
  hours: '',
  mode: 'LADEN',
  cargo: '',
};

export function CreateVoyageLegModal({ open, vesselId, onClose, onCreated }: Props) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set =
    (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const numStr = (s: string) => {
    const n = Number(s);
    return Number.isFinite(n) ? s : '';
  };

  const handleSubmit = async () => {
    if (
      !form.route.trim() ||
      !form.departureAt ||
      !form.arrivalAt ||
      !form.nm ||
      !form.fuelTonnes ||
      !form.co2Tonnes ||
      !form.soxTonnes ||
      !form.noxTonnes ||
      !form.hours
    ) {
      setError('Route, dates, distance, fuel, emissions and hours are all required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/voyage-legs', {
        vesselId,
        route: form.route.trim(),
        departureAt: new Date(form.departureAt).toISOString(),
        arrivalAt: new Date(form.arrivalAt).toISOString(),
        nm: numStr(form.nm),
        fuelTonnes: numStr(form.fuelTonnes),
        co2Tonnes: numStr(form.co2Tonnes),
        soxTonnes: numStr(form.soxTonnes),
        noxTonnes: numStr(form.noxTonnes),
        hours: numStr(form.hours),
        mode: form.mode,
        cargo: form.cargo.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to log voyage leg.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title="Log voyage leg"
      onClose={handleClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Create
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="vl-route"
            label="Route *"
            value={form.route}
            onChange={set('route')}
            autoFocus
            placeholder="RTM → SIN"
          />
          <Select
            id="vl-mode"
            label="Mode"
            options={MODE_OPTIONS}
            value={form.mode}
            onChange={(v) => setForm((f) => ({ ...f, mode: v }))}
          />
          <Input
            id="vl-dep"
            label="Departure *"
            type="datetime-local"
            value={form.departureAt}
            onChange={set('departureAt')}
          />
          <Input
            id="vl-arr"
            label="Arrival *"
            type="datetime-local"
            value={form.arrivalAt}
            onChange={set('arrivalAt')}
          />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Input
            id="vl-nm"
            label="Distance (nm) *"
            type="number"
            step="0.01"
            value={form.nm}
            onChange={set('nm')}
          />
          <Input
            id="vl-hours"
            label="Hours *"
            type="number"
            step="0.01"
            value={form.hours}
            onChange={set('hours')}
          />
          <Input
            id="vl-fuel"
            label="Fuel (t) *"
            type="number"
            step="0.001"
            value={form.fuelTonnes}
            onChange={set('fuelTonnes')}
          />
          <Input
            id="vl-co2"
            label="CO₂ (t) *"
            type="number"
            step="0.001"
            value={form.co2Tonnes}
            onChange={set('co2Tonnes')}
          />
          <Input
            id="vl-sox"
            label="SOx (t) *"
            type="number"
            step="0.001"
            value={form.soxTonnes}
            onChange={set('soxTonnes')}
          />
          <Input
            id="vl-nox"
            label="NOx (t) *"
            type="number"
            step="0.001"
            value={form.noxTonnes}
            onChange={set('noxTonnes')}
          />
        </div>
        <Input
          id="vl-cargo"
          label="Cargo"
          value={form.cargo}
          onChange={set('cargo')}
          placeholder="Containers / Crude / Ballast"
        />
      </div>
    </Modal>
  );
}
