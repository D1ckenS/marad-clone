import { useEffect, useState } from 'react';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface VoyageLegEditable {
  id: string;
  route: string;
  departureAt: string;
  arrivalAt: string;
  nm: string;
  fuelTonnes: string;
  co2Tonnes: string;
  soxTonnes: string;
  noxTonnes: string;
  hours: string;
  mode: 'LADEN' | 'BALLAST';
  cargo: string | null;
}

interface Props {
  leg: VoyageLegEditable;
  onClose: () => void;
  onSaved: () => void;
}

const MODE_OPTIONS = [
  { value: 'LADEN', label: 'Laden' },
  { value: 'BALLAST', label: 'Ballast' },
];

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditVoyageLegModal({ leg, onClose, onSaved }: Props) {
  const [form, setForm] = useState(() => ({
    route: leg.route,
    departureAt: toLocalInput(leg.departureAt),
    arrivalAt: toLocalInput(leg.arrivalAt),
    nm: leg.nm,
    fuelTonnes: leg.fuelTonnes,
    co2Tonnes: leg.co2Tonnes,
    soxTonnes: leg.soxTonnes,
    noxTonnes: leg.noxTonnes,
    hours: leg.hours,
    mode: leg.mode,
    cargo: leg.cargo ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      route: leg.route,
      departureAt: toLocalInput(leg.departureAt),
      arrivalAt: toLocalInput(leg.arrivalAt),
      nm: leg.nm,
      fuelTonnes: leg.fuelTonnes,
      co2Tonnes: leg.co2Tonnes,
      soxTonnes: leg.soxTonnes,
      noxTonnes: leg.noxTonnes,
      hours: leg.hours,
      mode: leg.mode,
      cargo: leg.cargo ?? '',
    });
    setError(null);
  }, [leg]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

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
      await api.patch(`/voyage-legs/${leg.id}`, {
        route: form.route.trim(),
        departureAt: new Date(form.departureAt).toISOString(),
        arrivalAt: new Date(form.arrivalAt).toISOString(),
        nm: form.nm,
        fuelTonnes: form.fuelTonnes,
        co2Tonnes: form.co2Tonnes,
        soxTonnes: form.soxTonnes,
        noxTonnes: form.noxTonnes,
        hours: form.hours,
        mode: form.mode,
        cargo: form.cargo.trim() || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update voyage leg.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title="Edit voyage leg"
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            Save
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
          />
          <Select
            options={MODE_OPTIONS}
            value={form.mode}
            onChange={(v) => setForm((f) => ({ ...f, mode: v as typeof f.mode }))}
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
        <Input id="vl-cargo" label="Cargo" value={form.cargo} onChange={set('cargo')} />
      </div>
    </Modal>
  );
}
