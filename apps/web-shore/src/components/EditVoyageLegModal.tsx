import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
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

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditVoyageLegModal({ leg, onClose, onSaved }: Props) {
  const { t } = useTranslation();
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

  const modeOptions = useMemo(
    () => [
      { value: 'LADEN', label: t('qhse.voyage_modal.mode_laden') },
      { value: 'BALLAST', label: t('qhse.voyage_modal.mode_ballast') },
    ],
    [t],
  );

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
      setError(t('qhse.voyage_modal.error_required'));
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
      setError(e instanceof Error ? e.message : t('qhse.voyage_modal.error_update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t('qhse.voyage_modal.title_edit')}
      onClose={onClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>
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
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="vl-route"
            label={`${t('qhse.voyage_modal.field_route')} *`}
            value={form.route}
            onChange={set('route')}
            autoFocus
          />
          <Select
            id="vl-mode"
            label={t('qhse.voyage_modal.field_mode')}
            options={modeOptions}
            value={form.mode}
            onChange={(v) => setForm((f) => ({ ...f, mode: v as typeof f.mode }))}
          />
          <Input
            id="vl-dep"
            label={`${t('qhse.voyage_modal.field_departure')} *`}
            type="datetime-local"
            value={form.departureAt}
            onChange={set('departureAt')}
          />
          <Input
            id="vl-arr"
            label={`${t('qhse.voyage_modal.field_arrival')} *`}
            type="datetime-local"
            value={form.arrivalAt}
            onChange={set('arrivalAt')}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            id="vl-nm"
            label={`${t('qhse.voyage_modal.field_distance_nm')} *`}
            type="number"
            step="0.01"
            value={form.nm}
            onChange={set('nm')}
          />
          <Input
            id="vl-hours"
            label={`${t('qhse.voyage_modal.field_hours')} *`}
            type="number"
            step="0.01"
            value={form.hours}
            onChange={set('hours')}
          />
          <Input
            id="vl-fuel"
            label={`${t('qhse.voyage_modal.field_fuel')} *`}
            type="number"
            step="0.001"
            value={form.fuelTonnes}
            onChange={set('fuelTonnes')}
          />
          <Input
            id="vl-co2"
            label={`${t('qhse.voyage_modal.field_co2')} *`}
            type="number"
            step="0.001"
            value={form.co2Tonnes}
            onChange={set('co2Tonnes')}
          />
          <Input
            id="vl-sox"
            label={`${t('qhse.voyage_modal.field_sox')} *`}
            type="number"
            step="0.001"
            value={form.soxTonnes}
            onChange={set('soxTonnes')}
          />
          <Input
            id="vl-nox"
            label={`${t('qhse.voyage_modal.field_nox')} *`}
            type="number"
            step="0.001"
            value={form.noxTonnes}
            onChange={set('noxTonnes')}
          />
        </div>
        <Input
          id="vl-cargo"
          label={t('qhse.voyage_modal.field_cargo')}
          value={form.cargo}
          onChange={set('cargo')}
        />
      </div>
    </Modal>
  );
}
