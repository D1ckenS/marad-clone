import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  vesselId: string;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  severity: 'CONDITION',
  title: '',
  detail: '',
  raisedAt: '',
  openedAt: '',
  dueAt: '',
};

export function CreateConditionOfClassModal({ open, vesselId, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const severityOptions = useMemo(
    () => [
      { value: 'CONDITION', label: t('certificates.coc_modal.severity_condition') },
      { value: 'RECOMMENDATION', label: t('certificates.coc_modal.severity_recommendation') },
      { value: 'MEMORANDUM', label: t('certificates.coc_modal.severity_memorandum') },
      { value: 'CLOSED', label: t('certificates.coc_modal.severity_closed') },
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
    if (!form.title.trim() || !form.detail.trim() || !form.raisedAt || !form.openedAt) {
      setError(t('certificates.coc_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/conditions-of-class', {
        vesselId,
        severity: form.severity,
        title: form.title.trim(),
        detail: form.detail.trim(),
        raisedAt: new Date(form.raisedAt).toISOString(),
        openedAt: new Date(form.openedAt).toISOString(),
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('certificates.coc_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('certificates.coc_modal.title_create')}
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
        <Select
          id="coc-severity"
          label={t('certificates.coc_modal.field_severity')}
          options={severityOptions}
          value={form.severity}
          onChange={(v) => setForm((f) => ({ ...f, severity: v }))}
        />
        <Input
          id="coc-title"
          label={`${t('certificates.coc_modal.field_title')} *`}
          value={form.title}
          onChange={set('title')}
          autoFocus
        />
        <TextArea
          id="coc-detail"
          label={`${t('certificates.coc_modal.field_detail')} *`}
          rows={3}
          value={form.detail}
          onChange={set('detail')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            id="coc-raised"
            label={`${t('certificates.coc_modal.field_raised_at')} *`}
            type="datetime-local"
            value={form.raisedAt}
            onChange={set('raisedAt')}
          />
          <Input
            id="coc-opened"
            label={`${t('certificates.coc_modal.field_opened_at')} *`}
            type="datetime-local"
            value={form.openedAt}
            onChange={set('openedAt')}
          />
          <Input
            id="coc-due"
            label={t('certificates.coc_modal.field_due_at')}
            type="datetime-local"
            value={form.dueAt}
            onChange={set('dueAt')}
          />
        </div>
      </div>
    </Modal>
  );
}
