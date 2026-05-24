import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  kind: '',
  occurredAt: '',
  location: '',
  volume: '',
  notes: '',
  compliant: true,
};

export function CreateDischargeLogModal({ open, vesselId, onClose, onCreated }: Props) {
  const { t } = useTranslation();
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

  const handleSubmit = async () => {
    if (!form.kind.trim() || !form.occurredAt || !form.location.trim() || !form.volume.trim()) {
      setError(t('qhse.discharge_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/discharge-logs', {
        vesselId,
        kind: form.kind.trim(),
        occurredAt: new Date(form.occurredAt).toISOString(),
        location: form.location.trim(),
        volume: form.volume.trim(),
        notes: form.notes.trim() || undefined,
        compliant: form.compliant,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('qhse.discharge_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('qhse.discharge_modal.title_create')}
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
          <Input
            id="dl-kind"
            label={`${t('qhse.discharge_modal.field_kind')} *`}
            value={form.kind}
            onChange={set('kind')}
            autoFocus
            placeholder="Garbage / Oily water / Sewage / Ballast"
          />
          <Input
            id="dl-when"
            label={`${t('qhse.discharge_modal.field_occurred_at')} *`}
            type="datetime-local"
            value={form.occurredAt}
            onChange={set('occurredAt')}
          />
          <Input
            id="dl-loc"
            label={`${t('qhse.discharge_modal.field_location')} *`}
            value={form.location}
            onChange={set('location')}
            placeholder="Port reception / Lat/Lon"
          />
          <Input
            id="dl-vol"
            label={`${t('qhse.discharge_modal.field_volume')} *`}
            value={form.volume}
            onChange={set('volume')}
            placeholder="0.5 m³"
          />
        </div>
        <TextArea
          id="dl-notes"
          label={t('qhse.discharge_modal.field_notes')}
          rows={2}
          value={form.notes}
          onChange={set('notes')}
        />
        <label className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--ink-2)' }}>
          <input
            type="checkbox"
            checked={form.compliant}
            onChange={(e) => setForm((f) => ({ ...f, compliant: e.target.checked }))}
          />
          {t('qhse.discharge_modal.field_compliant')}
        </label>
      </div>
    </Modal>
  );
}
