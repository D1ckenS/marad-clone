import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface SafetyEquipmentEditable {
  id: string;
  category: 'FFA' | 'LSA' | 'OTH';
  name: string;
  location: string;
  quantity: string;
  lastCheck: string | null;
  nextCheck: string | null;
  status: 'GREEN' | 'AMBER' | 'RED';
  flag: string | null;
}

interface Props {
  equipment: SafetyEquipmentEditable;
  onClose: () => void;
  onSaved: () => void;
}

function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export function EditSafetyEquipmentModal({ equipment, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    category: equipment.category,
    name: equipment.name,
    location: equipment.location,
    quantity: equipment.quantity,
    lastCheck: toDateInput(equipment.lastCheck),
    nextCheck: toDateInput(equipment.nextCheck),
    status: equipment.status,
    flag: equipment.flag ?? '',
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryOptions = useMemo(
    () => [
      { value: 'FFA', label: t('safety.equipment_modal.category_ffa') },
      { value: 'LSA', label: t('safety.equipment_modal.category_lsa') },
      { value: 'OTH', label: t('safety.equipment_modal.category_oth') },
    ],
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { value: 'GREEN', label: t('safety.equipment_modal.status_green') },
      { value: 'AMBER', label: t('safety.equipment_modal.status_amber') },
      { value: 'RED', label: t('safety.equipment_modal.status_red') },
    ],
    [t],
  );

  useEffect(() => {
    setForm({
      category: equipment.category,
      name: equipment.name,
      location: equipment.location,
      quantity: equipment.quantity,
      lastCheck: toDateInput(equipment.lastCheck),
      nextCheck: toDateInput(equipment.nextCheck),
      status: equipment.status,
      flag: equipment.flag ?? '',
    });
    setError(null);
  }, [equipment]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.quantity.trim()) {
      setError(t('safety.equipment_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/safety-equipment/${equipment.id}`, {
        category: form.category,
        name: form.name.trim(),
        location: form.location.trim(),
        quantity: form.quantity.trim(),
        lastCheck: form.lastCheck ? new Date(form.lastCheck).toISOString() : null,
        nextCheck: form.nextCheck ? new Date(form.nextCheck).toISOString() : null,
        status: form.status,
        flag: form.flag.trim() || null,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('safety.equipment_modal.error_update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t('safety.equipment_modal.title_edit')}
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
          <Select
            id="se-category"
            label={t('safety.equipment_modal.field_category')}
            options={categoryOptions}
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v as typeof f.category }))}
          />
          <Select
            id="se-status"
            label={t('safety.equipment_modal.field_status')}
            options={statusOptions}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v as typeof f.status }))}
          />
        </div>
        <Input
          id="se-name"
          label={`${t('safety.equipment_modal.field_name')} *`}
          value={form.name}
          onChange={set('name')}
          autoFocus
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="se-loc"
            label={`${t('safety.equipment_modal.field_location')} *`}
            value={form.location}
            onChange={set('location')}
          />
          <Input
            id="se-qty"
            label={`${t('safety.equipment_modal.field_quantity')} *`}
            value={form.quantity}
            onChange={set('quantity')}
          />
          <Input
            id="se-last"
            label={t('safety.equipment_modal.field_last_check')}
            type="date"
            value={form.lastCheck}
            onChange={set('lastCheck')}
          />
          <Input
            id="se-next"
            label={t('safety.equipment_modal.field_next_check')}
            type="date"
            value={form.nextCheck}
            onChange={set('nextCheck')}
          />
        </div>
        <Input
          id="se-flag"
          label={t('safety.equipment_modal.field_flag')}
          value={form.flag}
          onChange={set('flag')}
        />
      </div>
    </Modal>
  );
}
