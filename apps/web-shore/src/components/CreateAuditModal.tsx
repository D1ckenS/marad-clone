import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Modal, Select, TextArea } from '@fleetops/ui-kit';
import { api } from '../api/client.js';

interface Props {
  open: boolean;
  /** Optional vesselId; when omitted, the audit is created at fleet level. */
  vesselId?: string | null;
  onClose: () => void;
  onCreated: () => void;
}

const EMPTY = {
  kind: 'INTERNAL',
  scope: '',
  scheduledAt: '',
  auditor: '',
  status: 'SCHEDULED',
  notes: '',
};

export function CreateAuditModal({ open, vesselId, onClose, onCreated }: Props) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const kindOptions = useMemo(
    () => [
      { value: 'INTERNAL', label: t('qhse.audit_modal.kind_internal') },
      { value: 'EXTERNAL', label: t('qhse.audit_modal.kind_external') },
      { value: 'CLASS', label: t('qhse.audit_modal.kind_class') },
      { value: 'FLAG', label: t('qhse.audit_modal.kind_flag') },
    ],
    [t],
  );

  const statusOptions = useMemo(
    () => [
      { value: 'SCHEDULED', label: t('qhse.audit_modal.status_scheduled') },
      { value: 'IN_PROGRESS', label: t('qhse.audit_modal.status_in_progress') },
      { value: 'COMPLETED', label: t('qhse.audit_modal.status_completed') },
      { value: 'CANCELLED', label: t('qhse.audit_modal.status_cancelled') },
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
    if (!form.scope.trim() || !form.scheduledAt || !form.auditor.trim()) {
      setError(t('qhse.audit_modal.error_required'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api.post('/audits', {
        vesselId: vesselId || undefined,
        kind: form.kind,
        scope: form.scope.trim(),
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        auditor: form.auditor.trim(),
        status: form.status,
        notes: form.notes.trim() || undefined,
      });
      setForm(EMPTY);
      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t('qhse.audit_modal.error_create'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      title={t('qhse.audit_modal.title_create')}
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
            id="aud-kind"
            label={t('qhse.audit_modal.field_kind')}
            options={kindOptions}
            value={form.kind}
            onChange={(v) => setForm((f) => ({ ...f, kind: v }))}
          />
          <Select
            id="aud-status"
            label={t('qhse.audit_modal.field_status')}
            options={statusOptions}
            value={form.status}
            onChange={(v) => setForm((f) => ({ ...f, status: v }))}
          />
        </div>
        <Input
          id="aud-scope"
          label={`${t('qhse.audit_modal.field_scope')} *`}
          value={form.scope}
          onChange={set('scope')}
          autoFocus
          placeholder="PMS module / SMS / Bridge"
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            id="aud-when"
            label={`${t('qhse.audit_modal.field_scheduled_at')} *`}
            type="datetime-local"
            value={form.scheduledAt}
            onChange={set('scheduledAt')}
          />
          <Input
            id="aud-auditor"
            label={`${t('qhse.audit_modal.field_auditor')} *`}
            value={form.auditor}
            onChange={set('auditor')}
            placeholder="Name / org"
          />
        </div>
        <TextArea
          id="aud-notes"
          label={t('qhse.audit_modal.field_notes')}
          rows={2}
          value={form.notes}
          onChange={set('notes')}
        />
        {!vesselId && (
          <div className="text-xs italic" style={{ color: 'var(--ink-3)' }}>
            {t('qhse.audit_modal.hint_no_vessel')}
          </div>
        )}
      </div>
    </Modal>
  );
}
