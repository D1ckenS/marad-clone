import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  kind: 'Annual',
  scheduledAt: '',
  chair: '',
  attendees: '0',
  status: 'SCHEDULED',
  actionsTotal: '0',
  actionsDone: '0',
  summary: '',
};

export function CreateManagementReviewModal({ open, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const statusOptions = useMemo(
    () => [
      { value: 'SCHEDULED', label: t('qhse.review_modal.status_scheduled') },
      { value: 'IN_PROGRESS', label: t('qhse.review_modal.status_in_progress') },
      { value: 'CLOSED', label: t('qhse.review_modal.status_closed') },
      { value: 'CANCELLED', label: t('qhse.review_modal.status_cancelled') },
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
    if (!form.kind.trim() || !form.scheduledAt || !form.chair.trim()) {
      setError(t('qhse.review_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/management-reviews', {
        kind: form.kind.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        chair: form.chair.trim(),
        attendees: Math.max(0, Number(form.attendees) || 0),
        status: form.status,
        actionsTotal: Math.max(0, Number(form.actionsTotal) || 0),
        actionsDone: Math.max(0, Number(form.actionsDone) || 0),
        summary: form.summary.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('qhse.review_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('qhse.review_modal.title_create')}
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
            id="mr-kind"
            label={`${t('qhse.review_modal.field_kind')} *`}
            value={form.kind}
            onChange={set('kind')}
            autoFocus
            placeholder="Annual / Quarterly"
          />
          <Select
            id="mr-status"
            label={t('qhse.review_modal.field_status')}
            options={statusOptions}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
          <Input
            id="mr-when"
            label={`${t('qhse.review_modal.field_scheduled_at')} *`}
            type="datetime-local"
            value={form.scheduledAt}
            onChange={set('scheduledAt')}
          />
          <Input
            id="mr-chair"
            label={`${t('qhse.review_modal.field_chair')} *`}
            value={form.chair}
            onChange={set('chair')}
            placeholder="CEO / DPA"
          />
          <Input
            id="mr-att"
            label={t('qhse.review_modal.field_attendees')}
            type="number"
            min="0"
            value={form.attendees}
            onChange={set('attendees')}
          />
          <Input
            id="mr-actions"
            label={t('qhse.review_modal.field_actions_total')}
            type="number"
            min="0"
            value={form.actionsTotal}
            onChange={set('actionsTotal')}
          />
          <Input
            id="mr-done"
            label={t('qhse.review_modal.field_actions_done')}
            type="number"
            min="0"
            value={form.actionsDone}
            onChange={set('actionsDone')}
          />
        </div>
        <TextArea
          id="mr-summary"
          label={t('qhse.review_modal.field_summary')}
          rows={3}
          value={form.summary}
          onChange={set('summary')}
        />
      </div>
    </Modal>
  );
}
