import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface DischargeLogEditable {
  id: string;
  kind: string;
  occurredAt: string;
  location: string;
  volume: string;
  notes: string | null;
  compliant: boolean;
}

interface Props {
  discharge: DischargeLogEditable;
  onClose: () => void;
  onSaved: () => void;
}

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export function EditDischargeLogModal({ discharge, onClose, onSaved }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(() => ({
    kind: discharge.kind,
    occurredAt: toLocalInput(discharge.occurredAt),
    location: discharge.location,
    volume: discharge.volume,
    notes: discharge.notes ?? '',
    compliant: discharge.compliant,
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      kind: discharge.kind,
      occurredAt: toLocalInput(discharge.occurredAt),
      location: discharge.location,
      volume: discharge.volume,
      notes: discharge.notes ?? '',
      compliant: discharge.compliant,
    });
    setError(null);
  }, [discharge]);

  const set =
    (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.kind.trim() || !form.occurredAt || !form.location.trim() || !form.volume.trim()) {
      setError(t('qhse.discharge_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.patch(`/discharge-logs/${discharge.id}`, {
        kind: form.kind.trim(),
        occurredAt: new Date(form.occurredAt).toISOString(),
        location: form.location.trim(),
        volume: form.volume.trim(),
        notes: form.notes.trim() || null,
        compliant: form.compliant,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('qhse.discharge_modal.error_update'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open
      title={t('qhse.discharge_modal.title_edit')}
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
            id="dl-kind"
            label={`${t('qhse.discharge_modal.field_kind')} *`}
            value={form.kind}
            onChange={set('kind')}
            autoFocus
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
          />
          <Input
            id="dl-vol"
            label={`${t('qhse.discharge_modal.field_volume')} *`}
            value={form.volume}
            onChange={set('volume')}
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
