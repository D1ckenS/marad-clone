import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  category: 'FFA',
  name: '',
  location: '',
  quantity: '',
  lastCheck: '',
  nextCheck: '',
  status: 'GREEN',
  flag: '',
};

export function CreateSafetyEquipmentModal({ open, vesselId, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
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

  const set =
    (field: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleClose = () => {
    setForm(EMPTY);
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (!form.name.trim() || !form.location.trim() || !form.quantity.trim()) {
      setError(t('safety.equipment_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/safety-equipment', {
        vesselId,
        category: form.category,
        name: form.name.trim(),
        location: form.location.trim(),
        quantity: form.quantity.trim(),
        lastCheck: form.lastCheck ? new Date(form.lastCheck).toISOString() : undefined,
        nextCheck: form.nextCheck ? new Date(form.nextCheck).toISOString() : undefined,
        status: form.status,
        flag: form.flag.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('safety.equipment_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('safety.equipment_modal.title_create')}
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
        <div className="grid grid-cols-2 gap-3">
          <Select
            id="se-category"
            label={t('safety.equipment_modal.field_category')}
            options={categoryOptions}
            value={form.category}
            onChange={(v) => setForm((f) => ({ ...f, category: v }))}
          />
          <Select
            id="se-status"
            label={t('safety.equipment_modal.field_status')}
            options={statusOptions}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
        </div>
        <Input
          id="se-name"
          label={`${t('safety.equipment_modal.field_name')} *`}
          value={form.name}
          onChange={set('name')}
          autoFocus
          placeholder="Foam extinguisher 9L"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="se-loc"
            label={`${t('safety.equipment_modal.field_location')} *`}
            value={form.location}
            onChange={set('location')}
            placeholder="Engine room fwd"
          />
          <Input
            id="se-qty"
            label={`${t('safety.equipment_modal.field_quantity')} *`}
            value={form.quantity}
            onChange={set('quantity')}
            placeholder="4 / 2 sets"
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
