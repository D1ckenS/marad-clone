// M4 — Create/Edit modal for Tank (FLGO). Previously the FlgoPage
// could only display tanks; data had to be seeded via the API. This
// modal mirrors the deferred-stub pattern (CreateSurveyModal etc.) and
// surfaces the `fuelProductId` Select so an operator can link a tank
// to the fuel grade flowing through it.

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

interface FuelProductRow {
  id: string;
  name: string;
  grade?: string | null;
}

const TANK_TYPES = [
  'HFO',
  'MGO',
  'LSGO',
  'LSFO',
  'BIOFUEL',
  'LUBE_OIL',
  'FRESH_WATER',
  'BALLAST',
] as const;

const EMPTY = {
  name: '',
  tankType: 'HFO' as (typeof TANK_TYPES)[number],
  fuelProductId: '',
  capacityM3: '',
  framePosition: '',
};

export function CreateTankModal({ open, vesselId, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [fuelProducts, setFuelProducts] = useState<FuelProductRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    api
      .get<FuelProductRow[]>('/fuel-products')
      .then((rows) => {
        if (!cancelled) setFuelProducts(rows);
      })
      .catch(() => {
        if (!cancelled) setFuelProducts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  const tankTypeOptions = useMemo(
    () =>
      TANK_TYPES.map((tt) => ({
        value: tt,
        label: t(`flgo.tank_modal.type_${tt.toLowerCase()}`, { defaultValue: tt }),
      })),
    [t],
  );

  const fuelProductOptions = useMemo(
    () => [
      { value: '', label: t('flgo.tank_modal.no_fuel_product') },
      ...fuelProducts.map((p) => ({
        value: p.id,
        label: p.grade ? `${p.name} · ${p.grade}` : p.name,
      })),
    ],
    [fuelProducts, t],
  );

  const handleClose = () => {
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.tankType) {
      setError(t('flgo.tank_modal.error_required'));
      return;
    }
    if (form.capacityM3 !== '' && Number.isNaN(Number(form.capacityM3))) {
      setError(t('flgo.tank_modal.error_capacity_number'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/tanks', {
        vesselId,
        name: form.name.trim(),
        tankType: form.tankType,
        fuelProductId: form.fuelProductId || undefined,
        capacityM3: form.capacityM3 || undefined,
        framePosition: form.framePosition.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('flgo.tank_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('flgo.tank_modal.title_create')}
      onClose={handleClose}
      onSubmit={handleSubmit}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>
            {t('common.cancel')}
          </Button>
          <Button loading={saving} onClick={handleSubmit}>
            {t('common.create')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">{error}</div>
        )}
        <Input
          id="tk-name"
          label={`${t('flgo.tank_modal.field_name')} *`}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="HFO P1"
          autoFocus
        />
        <Select
          id="tk-type"
          label={`${t('flgo.tank_modal.field_tank_type')} *`}
          options={tankTypeOptions}
          value={form.tankType}
          onChange={(v) => setForm((f) => ({ ...f, tankType: v as (typeof TANK_TYPES)[number] }))}
        />
        <Select
          id="tk-fuel-product"
          label={t('flgo.tank_modal.field_fuel_product')}
          options={fuelProductOptions}
          value={form.fuelProductId}
          onChange={(v) => setForm((f) => ({ ...f, fuelProductId: v }))}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="tk-capacity"
            label={t('flgo.tank_modal.field_capacity_m3')}
            value={form.capacityM3}
            onChange={(e) => setForm((f) => ({ ...f, capacityM3: e.target.value }))}
            placeholder="500.0"
          />
          <Input
            id="tk-frame"
            label={t('flgo.tank_modal.field_frame_position')}
            value={form.framePosition}
            onChange={(e) => setForm((f) => ({ ...f, framePosition: e.target.value }))}
            placeholder="Fr 45–55"
          />
        </div>
      </div>
    </Modal>
  );
}
