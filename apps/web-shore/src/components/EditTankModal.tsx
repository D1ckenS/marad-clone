// M4 — Edit modal for Tank. PATCH semantics — only changed fields are
// sent. `fuelProductId` can be cleared by selecting the empty option
// (we PATCH null to drop the link).

import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface TankEditable {
  id: string;
  name: string;
  tankType: string;
  fuelProductId?: string | null;
  capacityM3: number | string | null;
  framePosition: string | null;
}

interface FuelProductRow {
  id: string;
  name: string;
  grade?: string | null;
}

interface Props {
  tank: TankEditable;
  onClose: () => void;
  onSaved: () => void;
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

export function EditTankModal({ tank, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    name: tank.name,
    tankType: tank.tankType,
    fuelProductId: tank.fuelProductId ?? '',
    capacityM3: tank.capacityM3 == null ? '' : String(tank.capacityM3),
    framePosition: tank.framePosition ?? '',
  }));
  const [fuelProducts, setFuelProducts] = useState<FuelProductRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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
  }, []);

  useEffect(() => {
    setForm({
      name: tank.name,
      tankType: tank.tankType,
      fuelProductId: tank.fuelProductId ?? '',
      capacityM3: tank.capacityM3 == null ? '' : String(tank.capacityM3),
      framePosition: tank.framePosition ?? '',
    });
    setError(null);
  }, [tank]);

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
      await api.patch(`/tanks/${tank.id}`, {
        name: form.name.trim(),
        tankType: form.tankType,
        // null intentionally clears the link on the server side
        fuelProductId: form.fuelProductId || null,
        capacityM3: form.capacityM3 || null,
        framePosition: form.framePosition.trim() || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('flgo.tank_modal.error_update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t('flgo.tank_modal.title_edit')}
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
        <Input
          id="tk-name"
          label={`${t('flgo.tank_modal.field_name')} *`}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          autoFocus
        />
        <Select
          id="tk-type"
          label={`${t('flgo.tank_modal.field_tank_type')} *`}
          options={tankTypeOptions}
          value={form.tankType}
          onChange={(v) => setForm((f) => ({ ...f, tankType: v }))}
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
          />
          <Input
            id="tk-frame"
            label={t('flgo.tank_modal.field_frame_position')}
            value={form.framePosition}
            onChange={(e) => setForm((f) => ({ ...f, framePosition: e.target.value }))}
          />
        </div>
      </div>
    </Modal>
  );
}
